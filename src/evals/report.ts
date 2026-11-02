// Stored eval results and the report built from them. The /evals page will be
// generated from the same report (BUILD_PROMPT §6).
import type { LeaseFacts } from "../facts/schema.js";
import type { ExtractUsage } from "../pipeline/extract.js";
import { RULES } from "../rules/rules.js";
import type { GoldenCase } from "./golden.js";
import {
  add,
  agreement,
  type CaseScore,
  type Counts,
  counts,
  countsByRule,
  precision,
  recall,
  type RunOutput,
  scoreCase,
  signature,
} from "./score.js";

export type StoredRun =
  | (RunOutput & {
      ok: true;
      /** Kept so `--rescore` can re-run current rules on this extraction without an API call. */
      facts: LeaseFacts;
      problems: string[];
      model: string;
      usage: ExtractUsage;
      latencyMs: number;
    })
  | { ok: false; error: { kind: string; message: string }; latencyMs: number };

export interface StoredCase {
  id: string;
  split: "dev" | "test";
  leaseSha256: string;
  runs: StoredRun[];
}

export interface ResultsMeta {
  createdAt: string;
  model: string;
  effort: string;
  runsPerCase: number;
  split: "dev" | "test" | "all";
  gitCommit: string | null;
  /** Set when these scores come from re-running current rules on an older file's extractions. */
  rescoredFrom?: string;
  labelsApproved: boolean;
  /** First 12 hex chars of sha256(SYSTEM_PREFIX): which prompt and corpus produced these extractions. Absent on runs before 2026-11-02. */
  promptSha?: string;
}

type Split = "dev" | "test" | "all";

export interface RuleRow {
  ruleId: string;
  strict: Counts;
  lenient: Counts;
}

export interface CaseRow {
  id: string;
  split: "dev" | "test";
  summary: string;
  runs: number;
  errors: number;
  strict: Counts;
  agreement: number;
  /** Per expected finding (by label index): share of runs that matched it with the right severity. */
  hitRate: { label: number; ruleId: string; severity: string; optional: boolean; rate: number }[];
  /** Distinct false positives seen across runs, with how many runs produced each. */
  falsePositives: { ruleId: string; severity: string; nearMiss: string | null; runs: number }[];
  wrongSeverity: { ruleId: string; expected: string; got: string; runs: number }[];
  duplicates: number;
}

export interface Report {
  meta: ResultsMeta;
  totals: Record<Split, { strict: Counts; lenient: Counts; cases: number; runs: number } & Rates>;
  rules: Record<Split, RuleRow[]>;
  cases: CaseRow[];
  cost: { totalUsd: number; perRunUsd: number | null; latencyP50Ms: number | null; latencyP90Ms: number | null };
}

interface Rates {
  precision: number | null;
  recall: number | null;
  lenientPrecision: number | null;
  lenientRecall: number | null;
  /** Findings whose citation isn't in the corpus, before filtering, over all findings produced. */
  fabricatedCitationRate: number | null;
  /** Lease quotes the locator couldn't find, over all quotes the model gave. */
  unlocatedQuoteRate: number | null;
  scopeAccuracy: number | null;
  outOfScopeRecall: number | null;
  invalidRendered: number;
  errors: number;
}

const ZERO: Counts = { tp: 0, fp: 0, fn: 0 };
const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
}

export function buildReport(meta: ResultsMeta, golden: GoldenCase[], stored: StoredCase[]): Report {
  const byId = new Map(golden.map((g) => [g.id, g]));
  const scored = stored.map((sc) => {
    const gc = byId.get(sc.id);
    if (!gc) throw new Error(`results include ${sc.id}, which has no labels`);
    const runs = sc.runs.flatMap((r) => (r.ok ? [{ run: r, score: scoreCase(gc, r) }] : []));
    return { gc, sc, runs, errors: sc.runs.length - runs.length };
  });

  const totals = {} as Report["totals"];
  const rules = {} as Report["rules"];
  for (const split of ["dev", "test", "all"] as const) {
    const inSplit = scored.filter((s) => split === "all" || s.gc.split === split);
    let strict = ZERO;
    let lenient = ZERO;
    const perRule = new Map(RULES.map((r) => [r.id, { strict: ZERO, lenient: ZERO }]));
    let cite = 0, fab = 0, quotes = 0, unlocated = 0, scopeOk = 0, runs = 0, oosE = 0, oosF = 0, invalid = 0, errors = 0;
    for (const { gc, runs: rs, errors: e } of inSplit) {
      errors += e;
      for (const { run, score } of rs) {
        runs++;
        strict = add(strict, counts(score, "strict"));
        lenient = add(lenient, counts(score, "lenient"));
        for (const mode of ["strict", "lenient"] as const)
          for (const [rule, c] of countsByRule(gc, run, score, mode)) {
            const row = perRule.get(rule)!;
            row[mode] = add(row[mode], c);
          }
        cite += score.citations.checked;
        fab += score.citations.fabricated;
        quotes += score.quotes.total;
        unlocated += score.quotes.unlocated;
        scopeOk += score.scopeOk ? 1 : 0;
        oosE += score.oos.expected;
        oosF += score.oos.found;
        invalid += score.invalidRendered;
      }
    }
    totals[split] = {
      strict,
      lenient,
      cases: inSplit.length,
      runs,
      precision: precision(strict),
      recall: recall(strict),
      lenientPrecision: precision(lenient),
      lenientRecall: recall(lenient),
      fabricatedCitationRate: ratio(fab, cite),
      unlocatedQuoteRate: ratio(unlocated, quotes),
      scopeAccuracy: ratio(scopeOk, runs),
      outOfScopeRecall: ratio(oosF, oosE),
      invalidRendered: invalid,
      errors,
    };
    rules[split] = [...perRule].map(([ruleId, c]) => ({ ruleId, ...c }));
  }

  const cases = scored.map(({ gc, sc, runs: rs, errors }): CaseRow => {
    const fp = new Map<string, CaseRow["falsePositives"][number]>();
    const sev = new Map<string, CaseRow["wrongSeverity"][number]>();
    let strict = ZERO;
    let duplicates = 0;
    for (const { run, score } of rs) {
      strict = add(strict, counts(score, "strict"));
      duplicates += score.duplicates.length;
      // Count each distinct false positive once per run.
      const seen = new Set<string>();
      for (const f of score.falsePositives) {
        const p = run.findings[f.predicted]!;
        const key = `${p.ruleId}|${p.severity}|${f.nearMiss ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const row = fp.get(key) ?? { ruleId: p.ruleId, severity: p.severity, nearMiss: f.nearMiss ?? null, runs: 0 };
        row.runs++;
        fp.set(key, row);
      }
      for (const m of score.matches.filter((m) => !m.severityOk)) {
        const e = gc.findings[m.expected]!;
        const got = run.findings[m.predicted]!.severity;
        const key = `${e.ruleId}|${e.severity}|${got}`;
        const row = sev.get(key) ?? { ruleId: e.ruleId, expected: e.severity, got, runs: 0 };
        row.runs++;
        sev.set(key, row);
      }
    }
    const hit = (label: number, s: CaseScore) =>
      [...s.matches, ...s.optionalHits].some((m) => m.expected === label && m.severityOk);
    return {
      id: gc.id,
      split: gc.split,
      summary: gc.summary,
      runs: sc.runs.length,
      errors,
      strict,
      agreement: agreement(rs.map(({ run, score }) => signature(run, score))),
      hitRate: gc.findings.map((e, label) => ({
        label,
        ruleId: e.ruleId,
        severity: e.severity,
        optional: e.optional,
        rate: rs.length ? rs.filter(({ score }) => hit(label, score)).length / rs.length : 0,
      })),
      falsePositives: [...fp.values()],
      wrongSeverity: [...sev.values()],
      duplicates,
    };
  });

  const ok = stored.flatMap((s) => s.runs.filter((r) => r.ok));
  const totalUsd = ok.reduce((t, r) => t + (r.usage.costUsd ?? 0), 0);
  const lat = ok.map((r) => r.latencyMs);
  return {
    meta,
    totals,
    rules,
    cases,
    cost: { totalUsd, perRunUsd: ratio(totalUsd, ok.length), latencyP50Ms: percentile(lat, 0.5), latencyP90Ms: percentile(lat, 0.9) },
  };
}

