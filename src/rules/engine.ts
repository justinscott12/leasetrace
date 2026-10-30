import { isCitation } from "../corpus/index.js";
import type { LeaseFacts, Span } from "../facts/schema.js";
import { RULES } from "./rules.js";
import type { Finding } from "./types.js";

export interface Dropped {
  finding: Finding;
  reason: string;
}

export function spanIsValid(span: Span, leaseText: string): boolean {
  return (
    Number.isInteger(span.start) &&
    Number.isInteger(span.end) &&
    span.start >= 0 &&
    span.start < span.end &&
    span.end <= leaseText.length &&
    leaseText.slice(span.start, span.end) === span.quote
  );
}

/** Runs every rule, then drops any finding with an unknown citation or a span that doesn't match the lease. */
export function runRules(facts: LeaseFacts, leaseText: string): { findings: Finding[]; dropped: Dropped[] } {
  const findings: Finding[] = [];
  const dropped: Dropped[] = [];
  for (const rule of RULES) {
    for (const f of rule.check(facts)) {
      if (!isCitation(f.citation)) dropped.push({ finding: f, reason: `citation ${f.citation} not in corpus` });
      else if (f.span && !spanIsValid(f.span, leaseText))
        dropped.push({ finding: f, reason: `span ${f.span.start}-${f.span.end} does not match lease text` });
      else findings.push(f);
    }
  }
  for (const d of dropped) console.warn(`[leasetrace] dropped ${d.finding.ruleId}: ${d.reason}`);
  return { findings, dropped };
}
