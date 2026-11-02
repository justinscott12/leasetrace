// Golden-set integrity and scorer behavior. No API calls.
import { describe, expect, it } from "vitest";
import { type GoldenCase, loadGoldenSet } from "../src/evals/golden.js";
import { buildReport } from "../src/evals/report.js";
import { agreement, counts, type RunOutput, scoreCase, signature } from "../src/evals/score.js";
import type { Span } from "../src/facts/schema.js";
import { RULES } from "../src/rules/rules.js";
import type { Finding } from "../src/rules/types.js";

const golden = loadGoldenSet("evals/leases");
const hard = loadGoldenSet("evals/hard");

describe("hard set", () => {
  it("loads 8 long leases, split 4/4, every label placed", () => {
    expect(hard).toHaveLength(8);
    expect(hard.filter((g) => g.split === "test")).toHaveLength(4);
    for (const g of hard) {
      expect(g.lease.length).toBeGreaterThan(6000);
      for (const f of g.findings) if (f.span) expect(g.lease.slice(f.span.start, f.span.end)).toBe(f.span.quote);
    }
  });
});

describe("golden set", () => {
  it("loads every case with its quotes placed in the lease", () => {
    expect(golden.length).toBeGreaterThanOrEqual(20);
    for (const g of golden)
      for (const f of g.findings) if (f.span) expect(g.lease.slice(f.span.start, f.span.end)).toBe(f.span.quote);
  });

  it("has dev and test cases, and a non-residential lease in each", () => {
    for (const split of ["dev", "test"])
      expect(golden.some((g) => g.split === split && g.scope === "not_residential")).toBe(true);
  });

  it("labels every rule positively at least once, in both splits", () => {
    for (const split of ["dev", "test"]) {
      const labeled = new Set(golden.filter((g) => g.split === split).flatMap((g) => g.findings.filter((f) => !f.optional).map((f) => f.ruleId)));
      const missing = RULES.map((r) => r.id).filter((id) => !labeled.has(id));
      // landlord-address only appears as an optional label in test (case 16): accepted gap.
      expect(missing.filter((id) => !(split === "test" && id === "landlord-address"))).toEqual([]);
    }
  });

  it("includes compliant leases and near-misses", () => {
    expect(golden.filter((g) => g.scope === "residential" && g.findings.length === 0).length).toBeGreaterThanOrEqual(2);
    expect(golden.reduce((n, g) => n + g.nearMisses.length, 0)).toBeGreaterThanOrEqual(20);
  });

  it("a perfect run scores 1.0 on every case", () => {
    for (const g of [...golden, ...hard]) {
      const s = scoreCase(g, perfectRun(g));
      expect(counts(s, "strict"), g.id).toEqual({ tp: g.findings.filter((f) => !f.optional).length, fp: 0, fn: 0 });
      expect(s.scopeOk).toBe(true);
    }
  });
});

const LEASE = "Clause A says one thing. Clause B says another thing. Clause C is fine.";
const at = (q: string): Span => {
  const start = LEASE.indexOf(q);
  return { start, end: start + q.length, quote: q };
};
const gcase = (over: Partial<GoldenCase> = {}): GoldenCase => ({
  id: "t",
  split: "dev",
  summary: "",
  scope: "residential",
  lease: LEASE,
  findings: [
    { ruleId: "lockout", citation: "83.67(2)", severity: "violation", span: at("Clause A says one thing."), note: "", optional: false },
    { ruleId: "landlord-address", citation: "83.50", severity: "notice", span: null, note: "", optional: false },
  ],
  outOfScope: [],
  nearMisses: [{ span: at("Clause C is fine."), note: "compliant" }],
  approved: false,
  ...over,
});
const pred = (ruleId: string, citation: string, severity: Finding["severity"], span?: Span): Finding => ({
  ruleId,
  citation,
  severity,
  title: "",
  problem: "",
  path: "code_rule",
  ...(span && { span }),
});
const run = (findings: Finding[], over: Partial<RunOutput> = {}): RunOutput => ({
  scope: "residential",
  findings,
  dropped: [],
  outOfScope: [],
  locates: [],
  ...over,
});

describe("scoreCase", () => {
  it("matches on rule + citation + span overlap; spanless labels match on rule + citation", () => {
    const s = scoreCase(gcase(), run([pred("lockout", "83.67(2)", "violation", at("one thing.")), pred("landlord-address", "83.50", "notice")]));
    expect(counts(s, "strict")).toEqual({ tp: 2, fp: 0, fn: 0 });
  });

  it("a prediction on the wrong clause is a miss and a false positive", () => {
    const s = scoreCase(gcase(), run([pred("lockout", "83.67(2)", "violation", at("Clause B says another thing."))]));
    expect(s.missed).toEqual([0, 1]);
    expect(s.falsePositives).toHaveLength(1);
  });

  it("wrong severity: strict counts a miss and a false positive, lenient counts a hit", () => {
    const s = scoreCase(gcase(), run([pred("lockout", "83.67(2)", "review", at("Clause A")), pred("landlord-address", "83.50", "notice")]));
    expect(counts(s, "strict")).toEqual({ tp: 1, fp: 1, fn: 1 });
    expect(counts(s, "lenient")).toEqual({ tp: 2, fp: 0, fn: 0 });
  });

  it("prefers the same-severity prediction when two land on one label", () => {
    const s = scoreCase(gcase(), run([pred("lockout", "83.67(2)", "review", at("Clause A says one thing.")), pred("lockout", "83.67(2)", "violation", at("Clause A"))]));
    expect(s.matches[0]).toMatchObject({ expected: 0, predicted: 1, severityOk: true });
    expect(s.duplicates).toEqual([0]);
    expect(s.falsePositives).toEqual([]);
  });

  it("tags false positives that fire on a near-miss", () => {
    const s = scoreCase(gcase(), run([pred("flag-ban", "83.67(4)", "void", at("Clause C"))]));
    expect(s.falsePositives).toEqual([{ predicted: 0, nearMiss: "compliant" }]);
  });

  it("optional labels are neither rewarded nor penalized", () => {
    const g = gcase({ findings: [{ ruleId: "deposit-holding", citation: "83.49(1)", severity: "review", span: at("Clause B"), note: "", optional: true }] });
    expect(counts(scoreCase(g, run([])), "strict")).toEqual({ tp: 0, fp: 0, fn: 0 });
    const hit = scoreCase(g, run([pred("deposit-holding", "83.49(1)", "review", at("Clause B says"))]));
    expect(counts(hit, "strict")).toEqual({ tp: 0, fp: 0, fn: 0 });
    expect(hit.optionalHits).toHaveLength(1);
  });

  it("checks scope, fabricated citations and unlocated quotes", () => {
    const s = scoreCase(
      gcase({ scope: "not_residential", findings: [] }),
      run([], {
        dropped: [{ finding: pred("lockout", "83.99(9)", "violation"), reason: "citation not in corpus" }],
        locates: [{ fact: "lockoutClause", method: "exact" }, { fact: "flagBan", method: "not_found" }],
      }),
    );
    expect(s.scopeOk).toBe(false);
    expect(s.citations).toEqual({ checked: 1, fabricated: 1 });
    expect(s.quotes).toEqual({ total: 2, unlocated: 1 });
  });

  it("finds out-of-scope items by span overlap", () => {
    const g = gcase({ outOfScope: [{ topic: "late fee", span: at("Clause B says another thing.") }] });
    const s = scoreCase(g, run([], { outOfScope: [{ topic: "fees", reason: "", span: at("another") }] }));
    expect(s.oos).toEqual({ expected: 1, found: 1 });
  });
});

describe("consistency", () => {
  it("agreement is the share of runs with the most common outcome", () => {
    expect(agreement(["a", "a", "b"])).toBeCloseTo(2 / 3);
    expect(agreement(["a"])).toBe(1);
  });

  it("signatures ignore how much of a clause a false positive quoted", () => {
    const g = gcase({ findings: [] });
    const r1 = run([pred("flag-ban", "83.67(4)", "void", at("Clause C"))]);
    const r2 = run([pred("flag-ban", "83.67(4)", "void", at("Clause C is fine."))]);
    expect(signature(r1, scoreCase(g, r1))).toBe(signature(r2, scoreCase(g, r2)));
  });
});

describe("buildReport", () => {
  it("reports per-label hit rates across repeated runs", () => {
    const g = gcase();
    const good = run([pred("lockout", "83.67(2)", "violation", at("Clause A")), pred("landlord-address", "83.50", "notice")]);
    const bad = run([pred("landlord-address", "83.50", "notice")]);
    const usage = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, costUsd: 0.25 };
    const stored = (r: RunOutput) => ({ ok: true as const, ...r, facts: {} as never, problems: [], model: "m", usage, latencyMs: 1000 });
    const meta = { createdAt: "", model: "m", effort: "medium", runsPerCase: 2, split: "dev" as const, gitCommit: null, labelsApproved: false };
    const rep = buildReport(meta, [g], [{ id: "t", split: "dev", leaseSha256: "", runs: [stored(good), stored(bad)] }]);
    expect(rep.cases[0]!.hitRate.map((h) => h.rate)).toEqual([0.5, 1]);
    expect(rep.cases[0]!.agreement).toBe(0.5);
    expect(rep.totals.dev.recall).toBeCloseTo(3 / 4);
    expect(rep.cost.totalUsd).toBeCloseTo(0.5);
  });
});

function perfectRun(g: GoldenCase): RunOutput {
  return run(
    g.findings.filter((f) => !f.optional).map((f) => pred(f.ruleId, f.citation, f.severity, f.span ?? undefined)),
    { scope: g.scope },
  );
}
