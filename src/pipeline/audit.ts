// Full audit: extract facts → run rules → trace. The trace events are what
// recorded replays will store and the UI will play back.
import type { OutOfScopeItem } from "../facts/wire.js";
import { type Dropped, runRules } from "../rules/engine.js";
import type { Finding } from "../rules/types.js";
import { type ExtractOptions, type ExtractResult, extractFacts, type MessagesClient } from "./extract.js";

export interface TraceEvent {
  step: "extract_start" | "extract_done" | "extract_failed" | "locate" | "rules" | "done";
  atMs: number;
  detail: Record<string, unknown>;
}

export type AuditResult =
  | {
      ok: true;
      scope: "residential" | "not_residential";
      findings: Finding[];
      dropped: Dropped[];
      outOfScope: OutOfScopeItem[];
      extraction: Extract<ExtractResult, { ok: true }>;
      trace: TraceEvent[];
    }
  | { ok: false; error: Extract<ExtractResult, { ok: false }>; trace: TraceEvent[] };

export async function audit(
  messages: MessagesClient,
  lease: string,
  opts: ExtractOptions & { onEvent?: (e: TraceEvent) => void } = {},
): Promise<AuditResult> {
  const t0 = Date.now();
  const trace: TraceEvent[] = [];
  const emit = (step: TraceEvent["step"], detail: Record<string, unknown>) => {
    const e = { step, atMs: Date.now() - t0, detail };
    trace.push(e);
    opts.onEvent?.(e);
  };

  emit("extract_start", { chars: lease.length, model: opts.model ?? null, effort: opts.effort ?? null });
  const ex = await extractFacts(messages, lease, opts);
  if (!ex.ok) {
    emit("extract_failed", { kind: ex.kind, message: ex.message });
    return { ok: false, error: ex, trace };
  }
  emit("extract_done", { model: ex.model, latencyMs: ex.latencyMs, ...ex.usage });
  emit("locate", {
    exact: ex.locates.filter((l) => l.method === "exact").length,
    normalized: ex.locates.filter((l) => l.method === "normalized").length,
    fuzzy: ex.locates.filter((l) => l.method === "fuzzy").length,
    notFound: ex.locates.filter((l) => l.method === "not_found").length,
    extractionProblems: ex.problems,
  });

  // A non-residential lease is outside Part II entirely: no rule findings (v1's mistake).
  if (ex.isResidential === "no") {
    emit("done", { findings: 0, scope: "not_residential" });
    return { ok: true, scope: "not_residential", findings: [], dropped: [], outOfScope: ex.outOfScope, extraction: ex, trace };
  }

  const { findings, dropped } = runRules(ex.facts, lease);
  emit("rules", { findings: findings.length, dropped: dropped.length });
  emit("done", { findings: findings.length, scope: "residential" });
  return { ok: true, scope: "residential", findings, dropped, outOfScope: ex.outOfScope, extraction: ex, trace };
}
