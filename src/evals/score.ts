// Deterministic eval scoring (DECISIONS.md, Decision 4). No model involved, so a
// stored run can be re-scored for free whenever rules or labels change.
import { isCitation } from "../corpus/index.js";
import type { Span } from "../facts/schema.js";
import type { LocateLog, OutOfScopeItem } from "../facts/wire.js";
import { type Dropped, spanIsValid } from "../rules/engine.js";
import type { Finding } from "../rules/types.js";
import type { ExpectedFinding, GoldenCase } from "./golden.js";

/** What one pipeline run produced for one lease. */
export interface RunOutput {
  scope: "residential" | "not_residential";
  findings: Finding[];
  dropped: Dropped[];
  outOfScope: OutOfScopeItem[];
  locates: LocateLog[];
}

export interface Match {
  expected: number;
  predicted: number;
  severityOk: boolean;
}

export interface CaseScore {
  scopeOk: boolean;
  matches: Match[];
  /** Required expected findings with no matching prediction. */
  missed: number[];
  /** Predictions matching nothing; `nearMiss` names the compliant clause it fired on, if any. */
  falsePositives: { predicted: number; nearMiss?: string }[];
  /** Extra predictions on a clause already matched for the same rule (noise, not a new error). */
  duplicates: number[];
  /** Matches on optional labels: neither rewarded nor penalized. */
  optionalHits: Match[];
  oos: { expected: number; found: number };
  citations: { checked: number; fabricated: number };
  /** Rendered findings that failed a validity check. Must be 0: runRules filters them. */
  invalidRendered: number;
  quotes: { total: number; unlocated: number };
}

const overlap = (a: Span, b: Span) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

function compatible(e: ExpectedFinding, p: Finding): boolean {
  if (e.ruleId !== p.ruleId || e.citation !== p.citation) return false;
  if (e.span === null) return true;
  return p.span !== undefined && overlap(e.span, p.span) > 0;
}

/** Greedy one-to-one matching: same-severity pairs first, then by overlap length. */
function assign(expected: ExpectedFinding[], which: number[], predicted: Finding[], free: Set<number>): Match[] {
  const pairs: (Match & { rank: number })[] = [];
  for (const e of which)
    for (const p of free)
      if (compatible(expected[e]!, predicted[p]!)) {
        const severityOk = expected[e]!.severity === predicted[p]!.severity;
        const ov = expected[e]!.span && predicted[p]!.span ? overlap(expected[e]!.span!, predicted[p]!.span!) : 0;
        pairs.push({ expected: e, predicted: p, severityOk, rank: (severityOk ? 1e9 : 0) + ov });
      }
  pairs.sort((a, b) => b.rank - a.rank);
  const usedE = new Set<number>();
  const out: Match[] = [];
  for (const { expected: e, predicted: p, severityOk } of pairs) {
    if (usedE.has(e) || !free.has(p)) continue;
    usedE.add(e);
    free.delete(p);
    out.push({ expected: e, predicted: p, severityOk });
  }
  return out;
}

export function scoreCase(gc: GoldenCase, run: RunOutput): CaseScore {
  const E = gc.findings;
  const P = run.findings;
  const free = new Set(P.map((_, i) => i));
  const required = E.flatMap((e, i) => (e.optional ? [] : [i]));
  const optional = E.flatMap((e, i) => (e.optional ? [i] : []));

  const matches = assign(E, required, P, free);
  const optionalHits = assign(E, optional, P, free);
  const matchedE = new Set(matches.map((m) => m.expected));
  const missed = required.filter((i) => !matchedE.has(i));

  const duplicates: number[] = [];
  const falsePositives: CaseScore["falsePositives"] = [];
  for (const p of free) {
    if (matches.some((m) => compatible(E[m.expected]!, P[p]!))) {
      duplicates.push(p);
      continue;
    }
    const span = P[p]!.span;
    const near = span && gc.nearMisses.find((n) => overlap(n.span, span) > 0);
    falsePositives.push(near ? { predicted: p, nearMiss: near.note } : { predicted: p });
  }

  const oosFound = gc.outOfScope.filter((o) => run.outOfScope.some((r) => r.span && overlap(o.span, r.span) > 0)).length;
  const all = [...P, ...run.dropped.map((d) => d.finding)];
  return {
    scopeOk: run.scope === gc.scope,
    matches,
    missed,
    falsePositives,
    duplicates,
    optionalHits,
    oos: { expected: gc.outOfScope.length, found: oosFound },
    citations: { checked: all.length, fabricated: all.filter((f) => !isCitation(f.citation)).length },
    invalidRendered: P.filter((f) => !isCitation(f.citation) || (f.span && !spanIsValid(f.span, gc.lease))).length,
    quotes: { total: run.locates.length, unlocated: run.locates.filter((l) => l.method === "not_found").length },
  };
}

export interface Counts {
  tp: number;
  fp: number;
  fn: number;
}

/**
 * Strict (the headline): a match with the wrong severity is a miss and a false positive,
 * because telling someone a void clause only needs "review" is a wrong answer.
 * Lenient: any match counts.
 */
export function counts(s: CaseScore, mode: "strict" | "lenient"): Counts {
  const wrongSev = mode === "strict" ? s.matches.filter((m) => !m.severityOk).length : 0;
  return { tp: s.matches.length - wrongSev, fp: s.falsePositives.length + wrongSev, fn: s.missed.length + wrongSev };
}

/** Per-rule counts, attributed to the expected finding's rule for misses and the prediction's rule otherwise. */
export function countsByRule(gc: GoldenCase, run: RunOutput, s: CaseScore, mode: "strict" | "lenient"): Map<string, Counts> {
  const m = new Map<string, Counts>();
  const bump = (rule: string, k: keyof Counts) => {
    const c = m.get(rule) ?? { tp: 0, fp: 0, fn: 0 };
    c[k]++;
    m.set(rule, c);
  };
  for (const x of s.matches) {
    const rule = gc.findings[x.expected]!.ruleId;
    if (x.severityOk || mode === "lenient") bump(rule, "tp");
    else {
      bump(rule, "fn");
      bump(rule, "fp");
    }
  }
  for (const i of s.missed) bump(gc.findings[i]!.ruleId, "fn");
  for (const f of s.falsePositives) bump(run.findings[f.predicted]!.ruleId, "fp");
  return m;
}

export function add(a: Counts, b: Counts): Counts {
  return { tp: a.tp + b.tp, fp: a.fp + b.fp, fn: a.fn + b.fn };
}

export const precision = (c: Counts) => (c.tp + c.fp === 0 ? null : c.tp / (c.tp + c.fp));
export const recall = (c: Counts) => (c.tp + c.fn === 0 ? null : c.tp / (c.tp + c.fn));

/**
 * A run's outcome as a comparable string: which labels it hit (with severity) and
 * where its false positives fell. Identical strings across runs = a consistent case.
 */
export function signature(run: RunOutput, s: CaseScore): string {
  const hits = s.matches.map((m) => `E${m.expected}${m.severityOk ? "" : `:${run.findings[m.predicted]!.severity}`}`);
  // Rule + severity only: span offsets shift with how much of a clause the model quotes.
  const fps = s.falsePositives.map((f) => {
    const p = run.findings[f.predicted]!;
    return `FP:${p.ruleId}:${p.severity}`;
  });
  return [...hits, ...fps].sort().join(" ");
}

/** Share of runs that agree with the most common outcome. 1 = fully consistent. */
export function agreement(signatures: string[]): number {
  if (signatures.length === 0) return 1;
  const n = new Map<string, number>();
  for (const s of signatures) n.set(s, (n.get(s) ?? 0) + 1);
  return Math.max(...n.values()) / signatures.length;
}
