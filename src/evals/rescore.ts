// Re-runs the current rules on stored extractions (DECISIONS.md, Decision 4): rule
// changes get an eval delta without an API call.
import { createHash } from "node:crypto";
import { runRules } from "../rules/engine.js";
import type { GoldenCase } from "./golden.js";
import type { StoredCase } from "./report.js";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function rescoreCases(cases: StoredCase[], golden: GoldenCase[]): StoredCase[] {
  const byId = new Map(golden.map((g) => [g.id, g]));
  return cases.map((sc) => {
    const gc = byId.get(sc.id);
    if (!gc) throw new Error(`${sc.id} has no labels any more`);
    if (sha256(gc.lease) !== sc.leaseSha256) throw new Error(`${sc.id}: lease text changed since this run; stored spans no longer apply`);
    return {
      ...sc,
      runs: sc.runs.map((r) => {
        if (!r.ok || r.scope === "not_residential") return r;
        const { findings, dropped } = runRules(r.facts, gc.lease);
        return { ...r, findings, dropped };
      }),
    };
  });
}
