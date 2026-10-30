// One structured-output call: lease in, LeaseFacts out. Never fabricates a
// result: every failure becomes a typed error the UI can show.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { LeaseFacts } from "../facts/schema.js";
import { type LocateLog, type OutOfScopeItem, toLeaseFacts, WireFacts } from "../facts/wire.js";
import { costUsd } from "./pricing.js";
import { leaseMessage, SYSTEM_PREFIX } from "./prompt.js";

export const DEFAULT_MODEL = "claude-opus-5-5";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export const MAX_LEASE_CHARS = 200_000;

export type ExtractErrorKind = "too_long" | "empty" | "refusal" | "truncated" | "bad_output" | "auth" | "rate_limit" | "timeout" | "api";

export interface ExtractUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  costUsd: number | null;
}

export type ExtractResult =
  | {
      ok: true;
      isResidential: "yes" | "no" | "unclear";
      facts: LeaseFacts;
      outOfScope: OutOfScopeItem[];
      locates: LocateLog[];
      model: string;
      usage: ExtractUsage;
      latencyMs: number;
    }
  | { ok: false; kind: ExtractErrorKind; message: string; latencyMs: number };

/** Only the method we call, so tests can pass a fake. */
export type MessagesClient = Pick<Anthropic["beta"]["messages"], "parse">;

export interface ExtractOptions {
  model?: string;
  effort?: Effort;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
}

const fail = (kind: ExtractErrorKind, message: string, t0: number): ExtractResult => ({
  ok: false,
  kind,
  message,
  latencyMs: Date.now() - t0,
});

export async function extractFacts(messages: MessagesClient, lease: string, opts: ExtractOptions = {}): Promise<ExtractResult> {
  const t0 = Date.now();
  if (!lease.trim()) return fail("empty", "The lease is empty.", t0);
  if (lease.length > MAX_LEASE_CHARS)
    return fail("too_long", `The lease is ${lease.length.toLocaleString()} characters; the limit is ${MAX_LEASE_CHARS.toLocaleString()}.`, t0);

  const model = opts.model ?? DEFAULT_MODEL;
  let response;
  try {
    response = await messages.parse(
      {
        model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: SYSTEM_PREFIX, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: leaseMessage(lease) }],
        output_config: { format: betaZodOutputFormat(WireFacts), effort: opts.effort ?? "medium" },
      },
      { timeout: opts.timeoutMs ?? 120_000 },
    );
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      return fail("auth", "The API key was rejected.", t0);
    if (e instanceof Anthropic.RateLimitError) return fail("rate_limit", "Rate limited by the API. Try again in a minute.", t0);
    if (e instanceof Anthropic.APIConnectionTimeoutError) return fail("timeout", "The model took too long to respond.", t0);
    if (e instanceof Anthropic.APIError) return fail("api", `API error${e.status ? ` ${e.status}` : ""}: ${e.message}`, t0);
    throw e;
  }

  if (response.stop_reason === "refusal")
    return fail("refusal", `The model declined this request${response.stop_details?.category ? ` (${response.stop_details.category})` : ""}.`, t0);
  if (response.stop_reason === "max_tokens") return fail("truncated", "The model's output was cut off before it finished.", t0);
  const wire = response.parsed_output;
  if (!wire) return fail("bad_output", "The model's output didn't match the expected schema.", t0);

  const { facts, locates, outOfScope } = toLeaseFacts(wire, lease);
  const u = response.usage;
  return {
    ok: true,
    isResidential: wire.is_residential_lease,
    facts,
    outOfScope,
    locates,
    model: response.model,
    usage: {
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      costUsd: costUsd(response.model, u),
    },
    latencyMs: Date.now() - t0,
  };
}
