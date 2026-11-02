// Pipeline tests with a fake client: no network, no cost.
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { WireFacts } from "../src/facts/wire.js";
import { audit } from "../src/pipeline/audit.js";
import { extractFacts, type MessagesClient } from "../src/pipeline/extract.js";
import { costUsd } from "../src/pipeline/pricing.js";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { FACT_NAMES, WireFacts as WireSchema } from "../src/facts/wire.js";
import { SYSTEM_PREFIX } from "../src/pipeline/prompt.js";
import { quoteInCitation } from "../src/corpus/index.js";

const LEASE = `RESIDENTIAL LEASE. Unit 4B, Palm Court Apartments, Tampa, Florida.
Tenant shall pay a security deposit of $1,200.
If rent is late, Landlord may change the locks.
Landlord may enter at any time to make repairs.
Notices to Landlord: Palm Court LLC, 100 Main St, Tampa, FL 33602.`;

type Item = WireFacts["facts"][number];
const present = (fact: Item["fact"], quote: string, value: unknown): Item => ({ fact, status: "present", quote, note: "", value_json: JSON.stringify(value) });

/** Every fact absent except the ones given. */
function wire(items: Item[] = DEFAULT_ITEMS, over: Partial<WireFacts> = {}): WireFacts {
  const given = new Set(items.map((i) => i.fact));
  const absent = FACT_NAMES.filter((f) => !given.has(f)).map((fact): Item => ({ fact, status: "absent", quote: "", note: "", value_json: "null" }));
  return { is_residential_lease: "yes", facts: [...items, ...absent], out_of_scope: [], ...over };
}

const DEFAULT_ITEMS: Item[] = [
  present("propertyType", "Unit 4B, Palm Court Apartments", "multi_unit"),
  present("securityDeposit", "Tenant shall pay a security deposit of $1,200.", { amount: 1200 }),
  present("repairEntryWindow", "Landlord may enter at any time to make repairs.", { startMinute: null, endMinute: null }),
  present("lockoutClause", "If rent is late, Landlord may change the locks.", true),
  present("landlordNoticeAddress", "Notices to Landlord: Palm Court LLC, 100 Main St, Tampa, FL 33602.", "Palm Court LLC, 100 Main St, Tampa, FL 33602"),
];

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

describe("schema", () => {
  // Structured outputs reject schemas with more than 16 union-typed parameters
  // (live 400 on 2026-11-01). Sentinels keep the count at zero so facts can grow.
  it("has no union-typed parameters", () => {
    const schema = (betaZodOutputFormat(WireSchema) as unknown as { schema: unknown }).schema;
    const unions: string[] = [];
    const walk = (n: unknown, path: string) => {
      if (!n || typeof n !== "object") return;
      const o = n as Record<string, unknown>;
      if (o.anyOf || Array.isArray(o.type)) unions.push(path);
      for (const [k, v] of Object.entries(o)) walk(v, `${path}/${k}`);
    };
    walk(schema, "");
    expect(unions).toEqual([]);
  });

  it("keeps the schema small: one generic item shape regardless of fact count", () => {
    const schema = (betaZodOutputFormat(WireSchema) as unknown as { schema: unknown }).schema;
    expect(JSON.stringify(schema).length).toBeLessThan(3000);
  });
});

describe("toLeaseFacts validation", () => {
  const without = (f: Item["fact"]) => wire().facts.filter((i) => i.fact !== f);

  it("a fact the model didn't report becomes unclear and is logged", async () => {
    const r = await extractFacts(ok({ ...wire(), facts: without("tenancyType") }), LEASE);
    if (!r.ok) throw new Error(r.message);
    expect(r.facts.tenancyType).toEqual({ status: "unclear", note: "the extractor did not report this fact" });
    expect(r.problems).toContain("tenancyType: not reported");
  });

  it("an invalid value becomes unclear and is logged", async () => {
    const bad = [...DEFAULT_ITEMS.filter((i) => i.fact !== "propertyType"), present("propertyType", "Unit 4B, Palm Court Apartments", "castle")];
    const r = await extractFacts(ok(wire(bad)), LEASE);
    if (!r.ok) throw new Error(r.message);
    expect(r.facts.propertyType).toMatchObject({ status: "unclear", note: "the value could not be read" });
    expect(r.problems[0]).toMatch(/propertyType: invalid value/);
  });

  it("conflicting duplicate entries become unclear", async () => {
    const dup = [...DEFAULT_ITEMS, present("propertyType", "Unit 4B, Palm Court Apartments", "duplex")];
    const r = await extractFacts(ok(wire(dup)), LEASE);
    if (!r.ok) throw new Error(r.message);
    expect(r.facts.propertyType).toMatchObject({ status: "unclear", note: "the extractor gave conflicting answers" });
  });

  it("nulls inside values survive validation", async () => {
    const r = await extractFacts(ok(wire()), LEASE);
    if (!r.ok) throw new Error(r.message);
    expect(r.facts.repairEntryWindow).toMatchObject({ status: "present", value: { startMinute: null, endMinute: null } });
    expect(r.problems).toEqual([]);
  });
});

describe("clause facts hold every clause", () => {
  const LEASE2 = `${LEASE}
Landlord may shut off water if rent is unpaid.
Landlord may interrupt utilities to make repairs.`;
  const shutoff = (quote: string, repairOnly: boolean) => present("utilityShutoffClause", quote, { purpose: repairOnly ? "repair_or_damage_prevention" : "other" });

  it("several entries for one clause fact become separate instances", async () => {
    const items = [...DEFAULT_ITEMS, shutoff("Landlord may shut off water if rent is unpaid.", false), shutoff("Landlord may interrupt utilities to make repairs.", true)];
    const r = await extractFacts(ok(wire(items)), LEASE2);
    if (!r.ok) throw new Error(r.message);
    expect(r.facts.utilityShutoffClause.map((c) => c.status === "present" && c.value)).toEqual([
      { purpose: "other" },
      { purpose: "repair_or_damage_prevention" },
    ]);
    expect(r.problems).toEqual([]);
  });

  it("the same clause quoted twice counts once", async () => {
    const q = "Landlord may shut off water if rent is unpaid.";
    const r = await extractFacts(ok(wire([...DEFAULT_ITEMS, shutoff(q, false), shutoff(q, false)])), LEASE2);
    if (!r.ok) throw new Error(r.message);
    expect(r.facts.utilityShutoffClause).toHaveLength(1);
  });

  it("an unreported clause fact becomes one unclear instance", async () => {
    const r = await extractFacts(ok({ ...wire(), facts: wire().facts.filter((i) => i.fact !== "flagBan") }), LEASE);
    if (!r.ok) throw new Error(r.message);
    expect(r.facts.flagBan).toEqual([{ status: "unclear", note: "the extractor did not report this fact" }]);
  });

  it("audit reports both utility clauses with the right severities", async () => {
    const items = [...DEFAULT_ITEMS, shutoff("Landlord may shut off water if rent is unpaid.", false), shutoff("Landlord may interrupt utilities to make repairs.", true)];
    const r = await audit(ok(wire(items)), LEASE2);
    if (!r.ok) throw new Error("audit failed");
    expect(r.findings.filter((f) => f.ruleId === "utility-shutoff").map((f) => [f.severity, f.span?.quote])).toEqual([
      ["violation", "Landlord may shut off water if rent is unpaid."],
      ["review", "Landlord may interrupt utilities to make repairs."],
    ]);
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
    expect(r.facts.lockoutClause.map((c) => c.status)).toEqual(["present"]);
    expect(r.facts.flagBan).toEqual([]);
    expect(r.facts.tenancyType).toEqual({ status: "absent" });
    expect(r.usage.costUsd).toBeCloseTo(costUsd("claude-opus-5-5", usage)!, 10);
    expect(r.usage.cacheReadTokens).toBe(24000);
    expect(r.locates.every((l) => l.method === "exact")).toBe(true);
  });

  it("a present fact whose quote isn't in the lease becomes unclear, not invented", async () => {
    const r = await extractFacts(
      ok(wire([...DEFAULT_ITEMS.filter((i) => i.fact !== "lockoutClause"), present("lockoutClause", "Landlord may padlock the door at will.", true)])),
      LEASE,
    );
    if (!r.ok) throw new Error(r.message);
    expect(r.facts.lockoutClause).toMatchObject([{ status: "unclear", note: expect.stringMatching(/could not be found/) }]);
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
    const r = await audit(ok(wire(DEFAULT_ITEMS, { is_residential_lease: "no" })), LEASE);
    expect(r).toMatchObject({ ok: true, scope: "not_residential", findings: [] });
  });

  it("a failed extraction returns the error and no findings", async () => {
    const r = await audit(ok(wire(), "refusal"), LEASE);
    expect(r.ok).toBe(false);
    expect(r.trace.map((e) => e.step)).toEqual(["extract_start", "extract_failed"]);
  });
});
