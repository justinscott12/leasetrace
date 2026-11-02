// Facts the LLM extracts from a lease. The model never decides violations;
// rules in src/rules decide from these (DECISIONS.md, Decision 2).

/** Character offsets into the lease text, plus the quoted text for validation. */
export interface Span {
  start: number;
  end: number;
  quote: string;
}

/**
 * Tri-state (DECISIONS.md, Decision 2b): the lease states it, the lease is
 * silent, or the lease touches it but the extractor can't pin a value.
 */
export type Fact<T> =
  | { status: "present"; value: T; span: Span }
  | { status: "absent" }
  | { status: "unclear"; note: string; span?: Span };

/** One clause the extractor found: a value tied to lease text, or an unclear mention. */
export type Instance<T> = Exclude<Fact<T>, { status: "absent" }>;

/**
 * Clause-type facts hold every matching clause, not one: leases often have several
 * clauses on the same topic, and a single slot made the model pick one arbitrarily
 * (DECISIONS.md, "multi-instance clause facts"). An empty list means none.
 */
export type Clauses<T> = Instance<T>[];

export const CLAUSE_FACTS = [
  "structuralMaintenanceWaiver",
  "attorneyFeeWaiver",
  "liabilityExculpation",
  "utilityShutoffClause",
  "lockoutClause",
  "flagBan",
  "retaliationClause",
  "propertyRemovalClause",
] as const;
export type ClauseFactKey = (typeof CLAUSE_FACTS)[number];

export type ExculpationScope = "broad" | "force_majeure" | "third_party_crime" | "stored_property";
export type UtilityPurpose = "repair_or_damage_prevention" | "as_permitted_by_law" | "other";

export type PropertyType = "single_family" | "duplex" | "multi_unit" | "other";
export type TenancyType =
  | "fixed_term"
  | "week_to_week"
  | "month_to_month"
  | "quarter_to_quarter"
  | "year_to_year";
export type DepositHolding =
  | "separate_non_interest"
  | "separate_interest"
  | "surety_bond"
  | "commingled" // with landlord's own funds, or used/pledged before due
  | "unspecified_landlord_discretion";

export interface DepositDisclosure {
  depositoryNamedOrBond: boolean;
  interestStated: boolean;
  statutoryNoticeIncluded: boolean; // the 83.49(2)(d) block-capitals disclosure
}

export interface LeaseFacts {
  propertyType: Fact<PropertyType>;
  tenancyType: Fact<TenancyType>;
  securityDeposit: Fact<{ amount: number | null }>;
  depositHolding: Fact<DepositHolding>;
  depositDisclosure: Fact<DepositDisclosure>;
  /** Days to return the deposit when the landlord makes no claim. */
  depositReturnDays: Fact<number>;
  /** Days to send notice of intent to claim the deposit. */
  depositClaimNoticeDays: Fact<number>;
  nonpaymentNotice: Fact<{ days: number; excludesWeekendsAndHolidays: boolean | null }>;
  repairEntryNoticeHours: Fact<number>;
  /** Minutes after midnight; null bounds mean "any time". */
  repairEntryWindow: Fact<{ startMinute: number | null; endMinute: number | null }>;
  /** Notice either party must give to end a periodic tenancy. */
  periodicTerminationNoticeDays: Fact<{ tenant: number | null; landlord: number | null }>;
  /** Fixed-term leases: notice required before vacating at end of term. */
  endOfTermNoticeDays: Fact<{ tenant: number | null; landlord: number | null }>;
  /** Clause shifting 83.51(1) code/structural/plumbing duties off the landlord. */
  structuralMaintenanceWaiver: Clauses<true>;
  attorneyFeeWaiver: Clauses<true>;
  /** Non-liability clause and its scope (label policy decides which scopes are void, review or fine). */
  liabilityExculpation: Clauses<{ scope: ExculpationScope }>;
  /** Clause letting the landlord interrupt utilities, and the purpose it states. */
  utilityShutoffClause: Clauses<{ purpose: UtilityPurpose }>;
  lockoutClause: Clauses<true>;
  flagBan: Clauses<true>;
  retaliationClause: Clauses<true>;
  /** Clause letting landlord remove/dispose of tenant property. */
  propertyRemovalClause: Clauses<{ onlyAfterSurrenderAbandonmentOrEviction: boolean; legendPresent: boolean }>;
  landlordNoticeAddress: Fact<string>;
}

export type FactKey = keyof LeaseFacts;

export function silentLease(): LeaseFacts {
  const a = { status: "absent" } as const;
  return {
    propertyType: a,
    tenancyType: a,
    securityDeposit: a,
    depositHolding: a,
    depositDisclosure: a,
    depositReturnDays: a,
    depositClaimNoticeDays: a,
    nonpaymentNotice: a,
    repairEntryNoticeHours: a,
    repairEntryWindow: a,
    periodicTerminationNoticeDays: a,
    endOfTermNoticeDays: a,
    structuralMaintenanceWaiver: [],
    attorneyFeeWaiver: [],
    liabilityExculpation: [],
    utilityShutoffClause: [],
    lockoutClause: [],
    flagBan: [],
    retaliationClause: [],
    propertyRemovalClause: [],
    landlordNoticeAddress: a,
  };
}
