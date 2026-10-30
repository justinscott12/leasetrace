// Pipeline tests with a fake client: no network, no cost.
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { WireFacts } from "../src/facts/wire.js";
import { audit } from "../src/pipeline/audit.js";
import { extractFacts, type MessagesClient } from "../src/pipeline/extract.js";
import { costUsd } from "../src/pipeline/pricing.js";
import { SYSTEM_PREFIX } from "../src/pipeline/prompt.js";
import { quoteInCitation } from "../src/corpus/index.js";

const LEASE = `RESIDENTIAL LEASE. Unit 4B, Palm Court Apartments, Tampa, Florida.
Tenant shall pay a security deposit of $1,200.
If rent is late, Landlord may change the locks.
Landlord may enter at any time to make repairs.
Notices to Landlord: Palm Court LLC, 100 Main St, Tampa, FL 33602.`;

const absent = { status: "absent", quote: null, note: null, value: null } as const;
const clauseAbsent = { status: "absent", quote: null, note: null } as const;

function wire(over: Partial<WireFacts> = {}): WireFacts {
  return {
    is_residential_lease: "yes",
    property_type: { status: "present", quote: "Unit 4B, Palm Court Apartments", note: null, value: "multi_unit" },
    tenancy_type: absent,
    security_deposit: { status: "present", quote: "Tenant shall pay a security deposit of $1,200.", note: null, value: { amount: 1200 } },
    deposit_holding: absent,
    deposit_disclosure: absent,
    deposit_return_days: absent,
    deposit_claim_notice_days: absent,
    nonpayment_notice: absent,
    repair_entry_notice_hours: absent,
    repair_entry_window: { status: "present", quote: "Landlord may enter at any time to make repairs.", note: null, value: { startMinute: null, endMinute: null } },
    periodic_termination_notice_days: absent,
    end_of_term_notice_days: absent,
    structural_maintenance_waiver: clauseAbsent,
    attorney_fee_waiver: clauseAbsent,
    liability_exculpation: clauseAbsent,
    utility_shutoff_clause: clauseAbsent,
    lockout_clause: { status: "present", quote: "If rent is late, Landlord may change the locks.", note: null },
    flag_ban: clauseAbsent,
    retaliation_clause: clauseAbsent,
    property_removal_clause: absent,
    landlord_notice_address: { status: "present", quote: "Notices to Landlord: Palm Court LLC, 100 Main St, Tampa, FL 33602.", note: null, value: "Palm Court LLC, 100 Main St, Tampa, FL 33602" },
    out_of_scope: [],
    ...over,
  };
}

const usage = { input_tokens: 900, output_tokens: 1200, cache_creation_input_tokens: 0, cache_read_input_tokens: 24000 };

function fakeClient(response: Record<string, unknown> | Error): MessagesClient & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    parse: (async (params: unknown) => {
      calls.push(params);
      if (response instanceof Error) throw response;
      return response;
    }) as unknown as MessagesClient["parse"],
  };
}
const ok = (w: WireFacts | null, stop = "end_turn") =>
  fakeClient({ model: "claude-opus-5-5", stop_reason: stop, stop_details: null, parsed_output: w, usage, content: [] });

describe("prompt", () => {
  it("cached prefix contains the whole corpus and no volatile content", () => {
    expect(SYSTEM_PREFIX).toContain("## 83.49 Deposit money or advance rent");
    expect(SYSTEM_PREFIX).toContain("## 83.684");
    expect(SYSTEM_PREFIX).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
  it("statute text quoted in the instructions matches the corpus", () => {
    expect(quoteInCitation("83.49(2)", "YOUR RENTAL AGREEMENT REQUIRES PAYMENT OF CERTAIN DEPOSITS")).toBe(true);
    expect(quoteInCitation("83.67(5)", "BY SIGNING THIS RENTAL AGREEMENT, THE TENANT AGREES THAT UPON SURRENDER, ABANDONMENT, OR RECOVERY OF POSSESSION")).toBe(true);
  });
});

describe("extractFacts", () => {
  it("sends the cached prefix, the lease after it, structured output and fallbacks", async () => {
    const c = ok(wire());
    await extractFacts(c, LEASE, { effort: "high" });
    const p = c.calls[0] as Record<string, any>;
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(p.system[0].text).toBe(SYSTEM_PREFIX);
    expect(p.messages[0].content).toContain(LEASE);
    expect(p.output_config.effort).toBe("high");
    expect(p.output_config.format).toBeTruthy();
    expect(p.fallbacks).toBe("default");
    expect(p.betas).toContain("server-side-fallback-2026-07-01");
  });

  it("maps facts, locates spans, and prices the call", async () => {
    const r = await extractFacts(ok(wire()), LEASE);
    if (!r.ok) throw new Error(r.message);
    expect(r.facts.lockoutClause.status).toBe("present");
    expect(r.facts.tenancyType).toEqual({ status: "absent" });
    expect(r.usage.costUsd).toBeCloseTo(costUsd("claude-opus-5-5", usage)!, 10);
    expect(r.usage.cacheReadTokens).toBe(24000);
    expect(r.locates.every((l) => l.method === "exact")).toBe(true);
  });

  it("a present fact whose quote isn't in the lease becomes unclear, not invented", async () => {
    const r = await extractFacts(
      ok(wire({ lockout_clause: { status: "present", quote: "Landlord may padlock the door at will.", note: null } })),
      LEASE,
    );
    if (!r.ok) throw new Error(r.message);
    expect(r.facts.lockoutClause).toMatchObject({ status: "unclear", note: expect.stringMatching(/could not be found/) });
    expect(r.locates).toContainEqual({ fact: "lockoutClause", method: "not_found" });
  });

  it.each([
    ["refusal", ok(wire(), "refusal")],
    ["truncated", ok(wire(), "max_tokens")],
    ["bad_output", ok(null)],
  ] as const)("%s → typed error, no result", async (kind, client) => {
    const r = await extractFacts(client, LEASE);
    expect(r).toMatchObject({ ok: false, kind });
  });

  it("maps SDK errors to typed errors", async () => {
    const headers = new Headers();
    const r429 = await extractFacts(fakeClient(new Anthropic.RateLimitError(429, {}, "slow down", headers)), LEASE);
    expect(r429).toMatchObject({ ok: false, kind: "rate_limit" });
    const r401 = await extractFacts(fakeClient(new Anthropic.AuthenticationError(401, {}, "bad key", headers)), LEASE);
    expect(r401).toMatchObject({ ok: false, kind: "auth" });
    const rTimeout = await extractFacts(fakeClient(new Anthropic.APIConnectionTimeoutError()), LEASE);
    expect(rTimeout).toMatchObject({ ok: false, kind: "timeout" });
  });

  it("rejects empty and oversized leases before calling the API", async () => {
    const c = ok(wire());
    expect(await extractFacts(c, "  ")).toMatchObject({ ok: false, kind: "empty" });
    expect(await extractFacts(c, "x".repeat(200_001))).toMatchObject({ ok: false, kind: "too_long" });
    expect(c.calls).toHaveLength(0);
  });
});

describe("audit", () => {
  it("runs rules on extracted facts and records a trace", async () => {
    const events: string[] = [];
    const r = await audit(ok(wire()), LEASE, { onEvent: (e) => events.push(e.step) });
    if (!r.ok) throw new Error("audit failed");
    expect(r.findings.map((f) => f.ruleId).sort()).toEqual(["deposit-disclosure", "lockout", "repair-entry-hours"]);
    const lockout = r.findings.find((f) => f.ruleId === "lockout")!;
    expect(LEASE.slice(lockout.span!.start, lockout.span!.end)).toBe("If rent is late, Landlord may change the locks.");
    expect(events).toEqual(["extract_start", "extract_done", "locate", "rules", "done"]);
  });

  it("a commercial lease gets no Part II findings", async () => {
    const r = await audit(ok(wire({ is_residential_lease: "no" })), LEASE);
    expect(r).toMatchObject({ ok: true, scope: "not_residential", findings: [] });
  });

  it("a failed extraction returns the error and no findings", async () => {
    const r = await audit(ok(wire(), "refusal"), LEASE);
    expect(r.ok).toBe(false);
    expect(r.trace.map((e) => e.step)).toEqual(["extract_start", "extract_failed"]);
  });
});
