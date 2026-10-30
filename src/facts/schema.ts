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
  structuralMaintenanceWaiver: Fact<true>;
  attorneyFeeWaiver: Fact<true>;
  liabilityExculpation: Fact<true>;
  utilityShutoffClause: Fact<true>;
  lockoutClause: Fact<true>;
  flagBan: Fact<true>;
  retaliationClause: Fact<true>;
  /** Clause letting landlord remove/dispose of tenant property. */
  propertyRemovalClause: Fact<{ onlyAfterSurrenderAbandonmentOrEviction: boolean; legendPresent: boolean }>;
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
    structuralMaintenanceWaiver: a,
    attorneyFeeWaiver: a,
    liabilityExculpation: a,
    utilityShutoffClause: a,
    lockoutClause: a,
    flagBan: a,
    retaliationClause: a,
    propertyRemovalClause: a,
    landlordNoticeAddress: a,
  };
}
