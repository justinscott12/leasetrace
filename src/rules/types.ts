import type { FactKey, LeaseFacts, Span } from "../facts/schema.js";

/**
 * violation: the clause directs conduct the statute forbids or contradicts a mandatory term.
 * void: the clause is unenforceable (waiver / limitation barred by statute).
 * notice: a required disclosure the lease doesn't make (may be given separately).
 * review: the lease touches the topic but the extracted fact is unclear.
 */
export type Severity = "violation" | "void" | "notice" | "review";

export interface Finding {
  ruleId: string;
  citation: string;
  severity: Severity;
  title: string;
  problem: string;
  span?: Span;
  suggestedFix?: string;
  path: "code_rule";
}

export interface Rule {
  id: string;
  title: string;
  /** Exact statute text the rule is written from. Tests check each quote against the corpus. */
  basis: { citation: string; quote: string }[];
  /** Facts the rule reads. */
  facts: FactKey[];
  check(f: LeaseFacts): Finding[];
}
