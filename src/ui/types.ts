import type { OutOfScopeItem } from "../facts/wire.js";
import type { TraceEvent } from "../pipeline/audit.js";
import type { ExtractUsage } from "../pipeline/extract.js";
import type { Dropped } from "../rules/engine.js";
import type { Finding, Severity } from "../rules/types.js";

/** One recorded or live audit, in the shape the audit view renders. */
export interface Replay {
  id: string;
  recordedAt: string;
  model: string;
  effort: string;
  lease: string;
  scope: "residential" | "not_residential";
  findings: Finding[];
  dropped: Dropped[];
  outOfScope: OutOfScopeItem[];
  trace: TraceEvent[];
  usage: ExtractUsage;
  latencyMs: number;
}

export interface StatuteData {
  title: string;
  year: number;
  retrievedAt: string;
  rules: Record<string, { title: string; basis: { citation: string; quote: string }[] }>;
  citations: Record<string, { section: string; catchline: string; text: string; url: string; parents: string[] }>;
}

export const SEVERITIES: Severity[] = ["violation", "void", "notice", "review"];

export const SEVERITY_LABEL: Record<Severity, { one: string; many: string; blurb: string }> = {
  violation: { one: "violation", many: "violations", blurb: "The lease lets the landlord do something the statute forbids." },
  void: { one: "void term", many: "void terms", blurb: "The term can't be enforced: the statute overrides it." },
  notice: { one: "missing disclosure", many: "missing disclosures", blurb: "Something the landlord must tell the tenant in writing is missing." },
  review: { one: "needs review", many: "need review", blurb: "Close to a line the statute draws; a person should look." },
};
