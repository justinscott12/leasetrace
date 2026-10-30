// The structured-output schema the model fills, and its mapping to LeaseFacts.
// Kept flat (no discriminated unions) so it stays inside the structured-outputs
// JSON Schema subset; tri-state is a `status` enum plus nullable fields.
import { z } from "zod";
import { locateQuote, type LocateMethod } from "./locate.js";
import type { Fact, LeaseFacts, Span } from "./schema.js";

const status = z.enum(["present", "absent", "unclear"]);
const evidence = {
  status,
  quote: z.string().nullable().describe("Verbatim text copied from the lease (one sentence or clause). Null unless present/unclear."),
  note: z.string().nullable().describe("Why the fact is unclear. Null otherwise."),
};
const fact = <T extends z.ZodType>(value: T) => z.object({ ...evidence, value: value.nullable() });
const clause = z.object(evidence);
const parties = z.object({ tenant: z.number().int().nullable(), landlord: z.number().int().nullable() });

export const WireFacts = z.object({
  is_residential_lease: z.enum(["yes", "no", "unclear"]),
  property_type: fact(z.enum(["single_family", "duplex", "multi_unit", "other"])),
  tenancy_type: fact(z.enum(["fixed_term", "week_to_week", "month_to_month", "quarter_to_quarter", "year_to_year"])),
  security_deposit: fact(z.object({ amount: z.number().nullable() })),
  deposit_holding: fact(z.enum(["separate_non_interest", "separate_interest", "surety_bond", "commingled", "unspecified_landlord_discretion"])),
  deposit_disclosure: fact(z.object({ depositoryNamedOrBond: z.boolean(), interestStated: z.boolean(), statutoryNoticeIncluded: z.boolean() })),
  deposit_return_days: fact(z.number().int()),
  deposit_claim_notice_days: fact(z.number().int()),
  nonpayment_notice: fact(z.object({ days: z.number().int(), excludesWeekendsAndHolidays: z.boolean().nullable() })),
  repair_entry_notice_hours: fact(z.number()),
  repair_entry_window: fact(z.object({ startMinute: z.number().int().nullable(), endMinute: z.number().int().nullable() })),
  periodic_termination_notice_days: fact(parties),
  end_of_term_notice_days: fact(parties),
  structural_maintenance_waiver: clause,
  attorney_fee_waiver: clause,
  liability_exculpation: clause,
  utility_shutoff_clause: clause,
  lockout_clause: clause,
  flag_ban: clause,
  retaliation_clause: clause,
  property_removal_clause: fact(z.object({ onlyAfterSurrenderAbandonmentOrEviction: z.boolean(), legendPresent: z.boolean() })),
  landlord_notice_address: fact(z.string()),
  out_of_scope: z
    .array(z.object({ topic: z.string(), quote: z.string().nullable(), reason: z.string() }))
    .describe("Lease terms the checker can't evaluate under Part II (see instructions)."),
});
export type WireFacts = z.infer<typeof WireFacts>;

/** wire key → LeaseFacts key. Clause facts map to Fact<true>. */
const KEYS = {
  property_type: "propertyType",
  tenancy_type: "tenancyType",
  security_deposit: "securityDeposit",
  deposit_holding: "depositHolding",
  deposit_disclosure: "depositDisclosure",
  deposit_return_days: "depositReturnDays",
  deposit_claim_notice_days: "depositClaimNoticeDays",
  nonpayment_notice: "nonpaymentNotice",
  repair_entry_notice_hours: "repairEntryNoticeHours",
  repair_entry_window: "repairEntryWindow",
  periodic_termination_notice_days: "periodicTerminationNoticeDays",
  end_of_term_notice_days: "endOfTermNoticeDays",
  structural_maintenance_waiver: "structuralMaintenanceWaiver",
  attorney_fee_waiver: "attorneyFeeWaiver",
  liability_exculpation: "liabilityExculpation",
  utility_shutoff_clause: "utilityShutoffClause",
  lockout_clause: "lockoutClause",
  flag_ban: "flagBan",
  retaliation_clause: "retaliationClause",
  property_removal_clause: "propertyRemovalClause",
  landlord_notice_address: "landlordNoticeAddress",
} as const satisfies Record<string, keyof LeaseFacts>;

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

/** Converts the model's output into LeaseFacts, locating every quote in the lease. */
export function toLeaseFacts(wire: WireFacts, lease: string): { facts: LeaseFacts; locates: LocateLog[]; outOfScope: OutOfScopeItem[] } {
  const locates: LocateLog[] = [];
  const facts = {} as Record<keyof LeaseFacts, Fact<unknown>>;

  for (const [wk, fk] of Object.entries(KEYS) as [keyof typeof KEYS, keyof LeaseFacts][]) {
    const w = wire[wk] as { status: "present" | "absent" | "unclear"; quote: string | null; note: string | null; value?: unknown };
    const isClause = !("value" in w);
    if (w.status === "absent") {
      facts[fk] = { status: "absent" };
      continue;
    }
    const loc = w.quote ? locateQuote(lease, w.quote) : null;
    if (w.quote) locates.push({ fact: fk, method: loc?.method ?? "not_found", ...(loc && { score: loc.score }) });
    const value = isClause ? true : w.value;

    if (w.status === "present" && loc && value !== null && value !== undefined) {
      facts[fk] = { status: "present", value, span: loc.span };
    } else {
      const why =
        w.status === "unclear"
          ? w.note ?? "the lease is ambiguous"
          : !w.quote
            ? "no supporting quote was given"
            : !loc
              ? "the supporting quote could not be found in the lease"
              : "no value could be read from the clause";
      facts[fk] = { status: "unclear", note: why, ...(loc && { span: loc.span }) };
    }
  }

  const outOfScope: OutOfScopeItem[] = wire.out_of_scope.map((o) => {
    const loc = o.quote ? locateQuote(lease, o.quote) : null;
    return { topic: o.topic, reason: o.reason, ...(loc && { span: loc.span }) };
  });

  return { facts: facts as unknown as LeaseFacts, locates, outOfScope };
}
