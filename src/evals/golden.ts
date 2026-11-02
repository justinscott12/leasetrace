// Loads the golden set: fictional leases plus hand-written labels
// (DECISIONS.md, Decision 4). Labels name clauses by quote; the loader turns each
// quote into a span and refuses labels it can't place unambiguously.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { isCitation } from "../corpus/index.js";
import type { Span } from "../facts/schema.js";
import { locateQuote } from "../facts/locate.js";
import { RULES } from "../rules/rules.js";

const RULE_IDS = new Set(RULES.map((r) => r.id));

const LabelFile = z.object({
  lease: z.string(),
  split: z.enum(["dev", "test"]),
  summary: z.string(),
  scope: z.enum(["residential", "not_residential"]),
  findings: z.array(
    z.object({
      ruleId: z.string(),
      citation: z.string(),
      severity: z.enum(["violation", "void", "notice", "review"]),
      /** null: the finding has no clause to point at (e.g. a missing disclosure). */
      quote: z.string().nullable(),
      note: z.string(),
      /** Arguable either way: neither rewarded nor penalized. */
      optional: z.boolean().optional(),
    }),
  ),
  outOfScope: z.array(z.object({ topic: z.string(), quote: z.string() })),
  /** Compliant clauses that look like violations. A false positive on one is tagged. */
  nearMisses: z.array(z.object({ quote: z.string(), note: z.string() })),
  /** Justin flips this after reviewing the labels. */
  approved: z.boolean(),
});

export interface ExpectedFinding {
  ruleId: string;
  citation: string;
  severity: "violation" | "void" | "notice" | "review";
  span: Span | null;
  note: string;
  optional: boolean;
}

export interface GoldenCase {
  id: string;
  split: "dev" | "test";
  summary: string;
  scope: "residential" | "not_residential";
  lease: string;
  findings: ExpectedFinding[];
  outOfScope: { topic: string; span: Span }[];
  nearMisses: { span: Span; note: string }[];
  approved: boolean;
}

/** Exact match that occurs once, else a whitespace/quote-normalized match. */
function place(lease: string, quote: string, where: string): Span {
  const at = lease.indexOf(quote);
  if (at >= 0 && lease.indexOf(quote, at + 1) >= 0) throw new Error(`${where}: quote occurs more than once: "${quote}"`);
  const found = locateQuote(lease, quote);
  if (!found || found.method === "fuzzy") throw new Error(`${where}: quote not in lease: "${quote}"`);
  return found.span;
}

export function loadCase(dir: string, labelFile: string): GoldenCase {
  const id = labelFile.replace(/\.labels\.json$/, "");
  const raw = LabelFile.parse(JSON.parse(readFileSync(join(dir, labelFile), "utf8")));
  const lease = readFileSync(join(dir, raw.lease), "utf8");
  const findings = raw.findings.map((f, i): ExpectedFinding => {
    const where = `${id} finding ${i}`;
    if (!RULE_IDS.has(f.ruleId)) throw new Error(`${where}: unknown rule ${f.ruleId}`);
    if (!isCitation(f.citation)) throw new Error(`${where}: citation ${f.citation} not in corpus`);
    return {
      ruleId: f.ruleId,
      citation: f.citation,
      severity: f.severity,
      span: f.quote === null ? null : place(lease, f.quote, where),
      note: f.note,
      optional: f.optional ?? false,
    };
  });
  if (raw.scope === "not_residential" && findings.length) throw new Error(`${id}: a non-residential lease can't expect findings`);
  return {
    id,
    split: raw.split,
    summary: raw.summary,
    scope: raw.scope,
    lease,
    findings,
    outOfScope: raw.outOfScope.map((o, i) => ({ topic: o.topic, span: place(lease, o.quote, `${id} outOfScope ${i}`) })),
    nearMisses: raw.nearMisses.map((n, i) => ({ note: n.note, span: place(lease, n.quote, `${id} nearMiss ${i}`) })),
    approved: raw.approved,
  };
}

export function loadGoldenSet(dir: string): GoldenCase[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".labels.json"))
    .sort()
    .map((f) => loadCase(dir, f));
}
