// The structured-output schema the model fills, and its mapping to LeaseFacts.
//
// Structured outputs compile the schema into a grammar with hard size limits
// (live 400s on 2026-11-01: >16 union parameters; then "compiled grammar is too
// large" at ~16 typed fact objects). So the API-enforced schema is a small,
// generic list — {fact, status, quote, note, value_json} — whose size doesn't
// grow with the number of facts, and each fact's value is validated here in code
// (DECISIONS.md, "generic fact list"). A missing or malformed fact becomes
// `unclear`, never a guess.
import { z } from "zod";
import { locateQuote, type LocateMethod } from "./locate.js";
import { CLAUSE_FACTS, type Fact, type Instance, type LeaseFacts, type Span } from "./schema.js";

const days = z.number().int().nullable();
const clause = z.literal(true);

/** Value schema per fact, checked locally after the model answers. */
export const VALUE_SCHEMAS = {
  propertyType: z.enum(["single_family", "duplex", "multi_unit", "other"]),
  tenancyType: z.enum(["fixed_term", "week_to_week", "month_to_month", "quarter_to_quarter", "year_to_year"]),
  securityDeposit: z.object({ amount: z.number().nullable() }),
  depositHolding: z.enum(["separate_non_interest", "separate_interest", "surety_bond", "commingled", "unspecified_landlord_discretion"]),
  depositDisclosure: z.object({ depositoryNamedOrBond: z.boolean(), interestStated: z.boolean(), statutoryNoticeIncluded: z.boolean() }),
  depositReturnDays: z.number().int(),
  depositClaimNoticeDays: z.number().int(),
  nonpaymentNotice: z.object({ days: z.number().int(), excludesWeekendsAndHolidays: z.boolean().nullable() }),
  repairEntryNoticeHours: z.number(),
  repairEntryWindow: z.object({ startMinute: z.number().int().nullable(), endMinute: z.number().int().nullable() }),
  periodicTerminationNoticeDays: z.object({ tenant: days, landlord: days }),
  endOfTermNoticeDays: z.object({ tenant: days, landlord: days }),
  structuralMaintenanceWaiver: clause,
  attorneyFeeWaiver: clause,
  liabilityExculpation: clause,
  utilityShutoffClause: z.object({ repairOrDamagePreventionOnly: z.boolean() }),
  lockoutClause: clause,
  flagBan: clause,
  retaliationClause: clause,
  propertyRemovalClause: z.object({ onlyAfterSurrenderAbandonmentOrEviction: z.boolean(), legendPresent: z.boolean() }),
  landlordNoticeAddress: z.string().min(1),
} satisfies Record<keyof LeaseFacts, z.ZodType>;

export const FACT_NAMES = Object.keys(VALUE_SCHEMAS) as [keyof LeaseFacts, ...(keyof LeaseFacts)[]];

export const WireFacts = z.object({
  is_residential_lease: z.enum(["yes", "no", "unclear"]),
  facts: z
    .array(
      z.object({
        fact: z.enum(FACT_NAMES),
        status: z.enum(["present", "absent", "unclear"]),
        quote: z.string().describe('Verbatim text copied from the lease (one sentence or clause). "" when absent.'),
        note: z.string().describe('Why the fact is unclear. "" otherwise.'),
        value_json: z.string().describe('The value as JSON, in the format the instructions give for this fact. "null" when absent.'),
      }),
    )
    .describe("At least one entry for every fact; clause facts get one entry per distinct clause."),
  out_of_scope: z
    .array(z.object({ topic: z.string(), quote: z.string().describe('Verbatim lease text, or "".'), reason: z.string() }))
    .describe("Lease terms the checker can't evaluate under Part II (see instructions)."),
});
export type WireFacts = z.infer<typeof WireFacts>;

export interface LocateLog {
  fact: keyof LeaseFacts;
  method: LocateMethod | "not_found";
  score?: number;
}

export interface OutOfScopeItem {
  topic: string;
  reason: string;
  span?: Span;
}

function parseValue(fact: keyof LeaseFacts, json: string): { ok: true; value: unknown } | { ok: false } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false };
  }
  const r = VALUE_SCHEMAS[fact].safeParse(raw);
  return r.success ? { ok: true, value: r.data } : { ok: false };
}

type Item = WireFacts["facts"][number];

/** Converts the model's output into LeaseFacts, validating values and locating every quote in the lease. */
export function toLeaseFacts(
  wire: WireFacts,
  lease: string,
): { facts: LeaseFacts; locates: LocateLog[]; outOfScope: OutOfScopeItem[]; problems: string[] } {
  const locates: LocateLog[] = [];
  const problems: string[] = [];
  const facts = {} as Record<keyof LeaseFacts, Fact<unknown> | Instance<unknown>[]>;

  /** One non-absent entry → a located, validated instance (or an unclear one, with the reason). */
  const toInstance = (name: keyof LeaseFacts, item: Item): Instance<unknown> => {
    const quote = item.quote.trim();
    const loc = quote ? locateQuote(lease, quote) : null;
    if (quote) locates.push({ fact: name, method: loc?.method ?? "not_found", ...(loc && { score: loc.score }) });
    const parsed = item.status === "present" ? parseValue(name, item.value_json) : { ok: false as const };
    if (item.status === "present" && !parsed.ok) problems.push(`${name}: invalid value ${item.value_json.slice(0, 80)}`);
    if (item.status === "present" && loc && parsed.ok) return { status: "present", value: parsed.value, span: loc.span };
    const why =
      item.status === "unclear"
        ? item.note.trim() || "the lease is ambiguous"
        : !quote
          ? "no supporting quote was given"
          : !loc
            ? "the supporting quote could not be found in the lease"
            : "the value could not be read";
    return { status: "unclear", note: why, ...(loc && { span: loc.span }) };
  };

  const byName = new Map<keyof LeaseFacts, Item[]>();
  for (const item of wire.facts) byName.set(item.fact, [...(byName.get(item.fact) ?? []), item]);

  for (const name of FACT_NAMES) {
    const items = byName.get(name) ?? [];
    const isClause = (CLAUSE_FACTS as readonly string[]).includes(name);
    if (items.length === 0) {
      problems.push(`${name}: not reported`);
      const missing = { status: "unclear", note: "the extractor did not report this fact" } as const;
      facts[name] = isClause ? [missing] : missing;
      continue;
    }

    if (isClause) {
      // Every distinct clause is its own instance; the same clause quoted twice counts once.
      const seen = new Set<string>();
      const instances: Instance<unknown>[] = [];
      for (const item of items) {
        if (item.status === "absent") continue;
        const inst = toInstance(name, item);
        const key = inst.span ? `${inst.span.start}:${inst.span.end}` : `${inst.status}:${item.quote.trim()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        instances.push(inst);
      }
      facts[name] = instances;
      continue;
    }

    // Single-valued facts: two different answers are a contradiction, not two clauses.
    if (items.length > 1 && new Set(items.map((i) => `${i.status}|${i.value_json}`)).size > 1) {
      problems.push(`${name}: reported ${items.length} times with different answers`);
      facts[name] = { status: "unclear", note: "the extractor gave conflicting answers" };
      continue;
    }
    const item = items[0]!;
    facts[name] = item.status === "absent" ? { status: "absent" } : toInstance(name, item);
  }

  const outOfScope: OutOfScopeItem[] = wire.out_of_scope.map((o) => {
    const loc = o.quote.trim() ? locateQuote(lease, o.quote) : null;
    return { topic: o.topic, reason: o.reason, ...(loc && { span: loc.span }) };
  });

  return { facts: facts as unknown as LeaseFacts, locates, outOfScope, problems };
}
