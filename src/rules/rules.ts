// Deterministic rules, each written from a quoted statute subsection.
// A rule that can't be traced to a quote doesn't ship (BUILD_PROMPT §3).
import type { ClauseFactKey, Clauses, Fact, Instance, LeaseFacts, Span } from "../facts/schema.js";
import type { Finding, Rule, Severity } from "./types.js";

type Base = Pick<Finding, "ruleId" | "citation" | "title">;

function finding(
  base: Base,
  severity: Severity,
  problem: string,
  span?: Span,
  suggestedFix?: string,
): Finding {
  return {
    ...base,
    severity,
    problem,
    ...(span && { span }),
    ...(suggestedFix && { suggestedFix }),
    path: "code_rule",
  };
}

/** Unclear facts become a review finding instead of a guess. */
function unclear(base: Base, fact: Fact<unknown>, what: string): Finding[] {
  if (fact.status !== "unclear") return [];
  return [finding(base, "review", `The lease mentions ${what}, but the terms are unclear: ${fact.note}`, fact.span)];
}

/** Boolean "this clause exists" rules: present → finding, absent → nothing. */
function clauseRule(r: {
  id: string;
  title: string;
  citation: string;
  quote: string;
  fact: ClauseFactKey;
  severity: Severity;
  problem: string;
  fix: string;
}): Rule {
  const base = { ruleId: r.id, citation: r.citation, title: r.title };
  return {
    id: r.id,
    title: r.title,
    basis: [{ citation: r.citation, quote: r.quote }],
    facts: [r.fact],
    check(f) {
      return (f[r.fact] as Clauses<unknown>).flatMap((c) =>
        c.status === "present" ? [finding(base, r.severity, r.problem, c.span, r.fix)] : unclear(base, c, r.title.toLowerCase()),
      );
    },
  };
}

const depositHolding: Rule = {
  id: "deposit-holding",
  title: "How the security deposit is held",
  basis: [
    {
      citation: "83.49(1)",
      quote:
        "The landlord shall not commingle such moneys with any other funds of the landlord or hypothecate, pledge, or in any other way make use of such moneys until such moneys are actually due the landlord",
    },
  ],
  facts: ["depositHolding"],
  check({ depositHolding: d }) {
    const base = { ruleId: this.id, citation: "83.49(1)", title: this.title };
    if (d.status === "present" && (d.value === "commingled" || d.value === "unspecified_landlord_discretion"))
      return [
        finding(
          base,
          "violation",
          d.value === "commingled"
            ? "The lease lets the landlord mix the deposit with their own funds or use it before it is due. Florida requires a separate account in a Florida bank, or a surety bond."
            : "The lease leaves how the deposit is held to the landlord's discretion. Florida allows only a separate non-interest account, a separate interest-bearing account, or a surety bond.",
          d.span,
          "Landlord will hold the security deposit in a separate non-interest-bearing account at a Florida financial institution and will not commingle it with other funds.",
        ),
      ];
    return unclear(base, d, "where the deposit is held");
  },
};

const depositDisclosure: Rule = {
  id: "deposit-disclosure",
  title: "Security deposit disclosure",
  basis: [
    {
      citation: "83.49(2)",
      quote:
        "The landlord shall, in the lease agreement or within 30 days after receipt of advance rent or a security deposit, give written notice to the tenant which includes disclosure of the advance rent or security deposit.",
    },
    {
      citation: "83.49(2)",
      quote: "This subsection does not apply to any landlord who rents fewer than five individual dwelling units.",
    },
  ],
  facts: ["securityDeposit", "depositDisclosure"],
  check({ securityDeposit, depositDisclosure: d }) {
    const base = { ruleId: this.id, citation: "83.49(2)", title: this.title };
    if (securityDeposit.status === "absent") return [];
    if (securityDeposit.status === "present" && securityDeposit.value.amount === 0) return [];
    const caveat =
      " This can also be given in a separate written notice within 30 days, and doesn't apply to landlords with fewer than five units.";
    if (d.status === "absent")
      return [finding(base, "notice", "The lease takes a deposit but doesn't include the required deposit disclosure." + caveat)];
    if (d.status === "unclear") return unclear(base, d, "a deposit disclosure");
    const missing = [
      !d.value.depositoryNamedOrBond && "the depository's name and address (or that a surety bond is posted)",
      !d.value.interestStated && "whether the tenant is entitled to interest",
      !d.value.statutoryNoticeIncluded && "the statutory notice text from s. 83.49(2)(d)",
    ].filter(Boolean);
    if (missing.length === 0) return [];
    return [finding(base, "notice", `The deposit disclosure is missing ${missing.join("; ")}.` + caveat, d.span)];
  },
};

function maxDaysRule(r: {
  id: string;
  title: string;
  citation: string;
  quote: string;
  fact: "depositReturnDays" | "depositClaimNoticeDays";
  max: number;
  what: string;
}): Rule {
  const base = { ruleId: r.id, citation: r.citation, title: r.title };
  return {
    id: r.id,
    title: r.title,
    basis: [{ citation: r.citation, quote: r.quote }],
    facts: [r.fact],
    check(f) {
      const d = f[r.fact];
      if (d.status === "present" && d.value > r.max)
        return [
          finding(
            base,
            "void",
            `The lease gives the landlord ${d.value} days ${r.what}. Florida requires ${r.max} days or less, so this term is void.`,
            d.span,
            `Landlord will ${r.what.replace(/^to /, "")} within ${r.max} days after the termination of the rental agreement.`,
          ),
        ];
      return unclear(base, d, r.what);
    },
  };
}

const depositReturn = maxDaysRule({
  id: "deposit-return-deadline",
  title: "Deposit return deadline",
  citation: "83.49(3)(a)",
  quote:
    "if the landlord does not intend to impose a claim on the security deposit, the landlord must return the security deposit, together with interest if otherwise required, within 15 days after the termination of the rental agreement",
  fact: "depositReturnDays",
  max: 15,
  what: "to return the deposit when there is no claim",
});

const depositClaim = maxDaysRule({
  id: "deposit-claim-deadline",
  title: "Deposit claim notice deadline",
  citation: "83.49(3)(a)",
  quote:
    "If the landlord intends to impose a claim on the deposit, the landlord must, within 30 days after the termination of the rental agreement, provide the tenant written notice",
  fact: "depositClaimNoticeDays",
  max: 30,
  what: "to send written notice of a claim on the deposit",
});

const nonpaymentNotice: Rule = {
  id: "nonpayment-notice",
  title: "Notice for unpaid rent",
  basis: [
    {
      citation: "83.56(3)",
      quote:
        "If the tenant fails to pay rent when due and the default continues for 3 days, excluding Saturday, Sunday, and legal holidays, after delivery of written demand by the landlord for payment of the rent or possession of the premises, the landlord may terminate the rental agreement.",
    },
    { citation: "83.56(3)", quote: "Legal holidays for the purpose of this section shall be court-observed holidays only." },
  ],
  facts: ["nonpaymentNotice"],
  check({ nonpaymentNotice: n }) {
    const base = { ruleId: this.id, citation: "83.56(3)", title: this.title };
    if (n.status !== "present") return unclear(base, n, "a notice period for unpaid rent");
    const fix =
      "If rent is unpaid, Landlord may terminate this lease only after delivering a written 3-day notice; the 3 days exclude Saturday, Sunday, and court-observed legal holidays.";
    const out: Finding[] = [];
    if (n.value.days < 3)
      out.push(
        finding(base, "void", `The lease allows termination after ${n.value.days} day(s) of notice for unpaid rent. Florida requires a 3-day written notice.`, n.span, fix),
      );
    if (n.value.excludesWeekendsAndHolidays === false)
      out.push(
        finding(base, "void", "The lease counts weekends or holidays in the unpaid-rent notice period. Florida excludes Saturdays, Sundays and court-observed holidays.", n.span, fix),
      );
    return out;
  },
};

const REPAIR_START = 7 * 60 + 30; // 7:30 a.m.
const REPAIR_END = 20 * 60; // 8:00 p.m.

const repairEntryNotice: Rule = {
  id: "repair-entry-notice",
  title: "Notice before entry for repairs",
  basis: [
    {
      citation: "83.53(2)",
      quote: "“Reasonable notice” for the purpose of repair is notice given at least 24 hours prior to the entry",
    },
  ],
  facts: ["repairEntryNoticeHours"],
  check({ repairEntryNoticeHours: h }) {
    const base = { ruleId: this.id, citation: "83.53(2)", title: this.title };
    if (h.status === "present" && h.value < 24)
      return [
        finding(
          base,
          "void",
          `The lease lets the landlord enter for repairs with ${h.value === 0 ? "no" : `${h.value} hours'`} notice. Florida requires at least 24 hours' notice for repairs (emergencies excepted).`,
          h.span,
          "Except in an emergency, Landlord will give Tenant at least 24 hours' notice before entering to make repairs.",
        ),
      ];
    return unclear(base, h, "notice before repair entry");
  },
};

const repairEntryWindow: Rule = {
  id: "repair-entry-hours",
  title: "Hours for entry to make repairs",
  basis: [
    {
      citation: "83.53(2)",
      quote: "reasonable time for the purpose of repair shall be between the hours of 7:30 a.m. and 8:00 p.m.",
    },
    { citation: "83.53(2)", quote: "The landlord may enter the dwelling unit at any time for the protection or preservation of the premises." },
  ],
  facts: ["repairEntryWindow"],
  check({ repairEntryWindow: w }) {
    const base = { ruleId: this.id, citation: "83.53(2)", title: this.title };
    if (w.status !== "present") return unclear(base, w, "when the landlord may enter for repairs");
    const { startMinute: s, endMinute: e } = w.value;
    if (s === null || e === null || s < REPAIR_START || e > REPAIR_END)
      return [
        finding(
          base,
          "void",
          "The lease lets the landlord enter for repairs outside 7:30 a.m.–8:00 p.m. Florida limits repair entry to those hours (entry to protect or preserve the premises is separate).",
          w.span,
          "Landlord may enter to make repairs between 7:30 a.m. and 8:00 p.m. with at least 24 hours' notice, and at any time to protect or preserve the premises.",
        ),
      ];
    return [];
  },
};

const PERIODIC: Record<string, { days: number; citation: string; quote: string }> = {
  year_to_year: {
    days: 60,
    citation: "83.57(1)",
    quote: "When the tenancy is from year to year, by giving not less than 60 days’ notice prior to the end of any annual period",
  },
  quarter_to_quarter: {
    days: 30,
    citation: "83.57(2)",
    quote: "When the tenancy is from quarter to quarter, by giving not less than 30 days’ notice prior to the end of any quarterly period",
  },
  month_to_month: {
    days: 30,
    citation: "83.57(3)",
    quote: "When the tenancy is from month to month, by giving not less than 30 days’ notice prior to the end of any monthly period",
  },
  week_to_week: {
    days: 7,
    citation: "83.57(4)",
    quote: "When the tenancy is from week to week, by giving not less than 7 days’ notice prior to the end of any weekly period",
  },
};

const periodicTermination: Rule = {
  id: "periodic-termination-notice",
  title: "Notice to end a periodic tenancy",
  basis: Object.values(PERIODIC).map(({ citation, quote }) => ({ citation, quote })),
  facts: ["tenancyType", "periodicTerminationNoticeDays"],
  check({ tenancyType: t, periodicTerminationNoticeDays: n }) {
    if (t.status !== "present") return [];
    // A fixed term that rolls over: the fact is defined as the month-to-month renewal's
    // notice (prompt.ts), so it's checked against 83.57(3). Plain fixed terms have none.
    const fixed = t.value === "fixed_term";
    if (fixed && n.status !== "present") return [];
    const req = PERIODIC[fixed ? "month_to_month" : t.value];
    if (!req) return [];
    const base = { ruleId: this.id, citation: req.citation, title: this.title };
    if (n.status !== "present") return unclear(base, n, "notice to end the tenancy");
    const short = (["tenant", "landlord"] as const).filter((p) => {
      const d = n.value[p];
      return d !== null && d < req.days;
    });
    if (short.length === 0) return [];
    const period = fixed ? "month-to-month renewal" : t.value.replace(/_/g, "-");
    return [
      finding(
        base,
        "void",
        `For a ${period} tenancy the lease allows ${short
          .map((p) => `the ${p} to give ${n.value[p]} days' notice`)
          .join(" and ")}. Florida requires at least ${req.days} days before the end of the period.`,
        n.span,
        `Either party may end this ${period} tenancy by giving written notice at least ${req.days} days before the end of a rental period.`,
      ),
    ];
  },
};

const endOfTermNotice: Rule = {
  id: "end-of-term-notice",
  title: "Notice before the end of a fixed term",
  basis: [
    {
      citation: "83.575(1)",
      quote: "A rental agreement may not require less than 30 days’ notice or more than 60 days’ notice from either the tenant or the landlord.",
    },
  ],
  facts: ["tenancyType", "endOfTermNoticeDays"],
  check({ tenancyType: t, endOfTermNoticeDays: n }) {
    const base = { ruleId: this.id, citation: "83.575(1)", title: this.title };
    if (t.status === "present" && t.value !== "fixed_term") return [];
    if (n.status !== "present") return unclear(base, n, "notice before the end of the lease term");
    const bad = (["tenant", "landlord"] as const).filter((p) => {
      const d = n.value[p];
      return d !== null && (d < 30 || d > 60);
    });
    if (bad.length === 0) return [];
    return [
      finding(
        base,
        "void",
        `The lease requires ${bad.map((p) => `${n.value[p]} days' notice from the ${p}`).join(" and ")} before the term ends. Florida allows only 30 to 60 days.`,
        n.span,
        "Either party must give written notice at least 30 days (and no more than 60 days) before the end of the lease term if they do not intend to renew.",
      ),
    ];
  },
};

function maintenanceWaiverFindings(base: Base, w: Instance<true>, p: LeaseFacts["propertyType"]): Finding[] {
  if (w.status === "unclear") return unclear(base, w, "who maintains the structure, plumbing and code compliance");
  if (p.status === "present" && (p.value === "single_family" || p.value === "duplex")) return [];
  if (p.status !== "present")
    return [
      finding(
        base,
        "review",
        "The lease shifts the landlord's code, structural or plumbing duties to the tenant. That is allowed in writing only for a single-family home or duplex, and the lease doesn't make clear which this is.",
        w.span,
      ),
    ];
  return [
    finding(
      base,
      "void",
      "The lease shifts the landlord's code, structural or plumbing duties to the tenant. For a unit that is not a single-family home or duplex, these duties can't be waived.",
      w.span,
      "Landlord will comply with applicable building, housing, and health codes and keep the structural components and plumbing in good repair as required by s. 83.51(1), Florida Statutes.",
    ),
  ];
}

const maintenanceWaiver: Rule = {
  id: "maintenance-waiver",
  title: "Waiver of landlord's maintenance duties",
  basis: [
    {
      citation: "83.51(1)",
      quote:
        "The landlord’s obligations under this subsection may be altered or modified in writing with respect to a single-family home or duplex.",
    },
    {
      citation: "83.47(1)(a)",
      quote: "Purports to waive or preclude the rights, remedies, or requirements set forth in this part.",
    },
  ],
  facts: ["structuralMaintenanceWaiver", "propertyType"],
  check({ structuralMaintenanceWaiver: waivers, propertyType: p }) {
    const base = { ruleId: this.id, citation: "83.51(1)", title: this.title };
    return waivers.flatMap((w) => maintenanceWaiverFindings(base, w, p));
  },
};

const attorneyFees = clauseRule({
  id: "attorney-fee-waiver",
  title: "Waiver of attorney fees",
  citation: "83.48",
  quote: "The right to attorney fees in this section may not be waived in a lease agreement.",
  fact: "attorneyFeeWaiver",
  severity: "void",
  problem: "The lease waives or limits the tenant's right to recover attorney fees. Florida says this right can't be waived in a lease.",
  fix: "In any action to enforce this lease or Part II of Chapter 83, the prevailing party may recover reasonable attorney fees and court costs.",
});

// Label policy (docs/LABEL_POLICY.md): broad non-liability clauses are void even with a
// savings phrase; force majeure is `review`; clauses limited to third-party crime or
// stored property restate existing law and produce no finding.
const liability: Rule = {
  id: "liability-exculpation",
  title: "Limit on landlord liability",
  basis: [
    {
      citation: "83.47(1)(b)",
      quote: "Purports to limit or preclude any liability of the landlord to the tenant or of the tenant to the landlord, arising under law.",
    },
  ],
  facts: ["liabilityExculpation"],
  check({ liabilityExculpation: clauses }) {
    const base = { ruleId: this.id, citation: "83.47(1)(b)", title: this.title };
    return clauses.flatMap((c): Finding[] => {
      if (c.status !== "present") return unclear(base, c, "a limit on liability");
      switch (c.value.scope) {
        case "broad":
          return [
            finding(
              base,
              "void",
              "The lease tries to release the landlord from liability the law imposes. Florida makes this kind of clause void.",
              c.span,
              "Delete the clause. Each party remains responsible for its own obligations and liability under law.",
            ),
          ];
        case "force_majeure":
          return [
            finding(
              base,
              "review",
              "The lease excuses the landlord's performance after events beyond its control. That isn't a release of liability by itself, but if it's used to skip duties Florida says can't be waived (like maintenance under s. 83.51), it would be void. A person should check.",
              c.span,
              "Add: Nothing in this clause excuses Landlord's obligations under Part II of Chapter 83, Florida Statutes.",
            ),
          ];
        default:
          return [];
      }
    });
  },
};

// Label policy (docs/LABEL_POLICY.md): interruptions limited to repairs or preventing
// damage, or "as permitted by law", are `review`; 83.67(1) states no exception, but its
// target is shutoffs used against the tenant.
const utilities: Rule = {
  id: "utility-shutoff",
  title: "Utility shutoff",
  basis: [
    {
      citation: "83.67(1)",
      quote: "shall not cause, directly or indirectly, the termination or interruption of any utility service furnished the tenant",
    },
  ],
  facts: ["utilityShutoffClause"],
  check({ utilityShutoffClause: clauses }) {
    const base = { ruleId: this.id, citation: "83.67(1)", title: this.title };
    return clauses.flatMap((c): Finding[] => {
      if (c.status !== "present") return unclear(base, c, "interrupting utilities");
      if (c.value.purpose === "as_permitted_by_law")
        return [
          finding(
            base,
            "review",
            'The lease lets the landlord cut off a utility "according to statute" or as the law permits, without saying when. Florida bars landlord-caused utility interruptions, so a person should check what this clause is meant to allow.',
            c.span,
            "Name the specific lawful circumstance, or delete the clause.",
          ),
        ];
      if (c.value.purpose === "repair_or_damage_prevention")
        return [
          finding(
            base,
            "review",
            "The lease lets the landlord interrupt utilities to make repairs or prevent damage. Florida's statute bars any landlord-caused utility interruption and states no repair exception; temporary repair work is commonly treated differently, so a person should check how this clause is used.",
            c.span,
            "Landlord may temporarily interrupt a utility only as reasonably necessary for repairs or emergencies, with advance notice to Tenant when practical, and will restore service promptly.",
          ),
        ];
      return [
        finding(
          base,
          "violation",
          "The lease allows the landlord to shut off or interrupt utilities. Florida prohibits this, even when rent is late.",
          c.span,
          "Delete the clause. Landlord will not interrupt any utility service furnished to Tenant.",
        ),
      ];
    });
  },
};

const lockout = clauseRule({
  id: "lockout",
  title: "Lockout",
  citation: "83.67(2)",
  quote:
    "shall not prevent the tenant from gaining reasonable access to the dwelling unit by any means, including, but not limited to, changing the locks or using any bootlock or similar device",
  fact: "lockoutClause",
  severity: "violation",
  problem: "The lease allows the landlord to change the locks or otherwise keep the tenant out. Florida prohibits self-help lockouts; only a court eviction can remove a tenant.",
  fix: "Delete the clause. Landlord may recover possession only through a court eviction.",
});

const flag = clauseRule({
  id: "flag-ban",
  title: "Ban on displaying the U.S. flag",
  citation: "83.67(4)",
  quote:
    "A landlord shall not prohibit a tenant from displaying one portable, removable, cloth or plastic United States flag, not larger than 4 and 1/2 feet by 6 feet, in a respectful manner",
  fact: "flagBan",
  severity: "void",
  problem: "The lease bans displaying flags in a way that covers the U.S. flag. Florida lets a tenant display one portable U.S. flag up to 4½ by 6 feet regardless of the lease.",
  fix: "Tenant may display one portable, removable U.S. flag no larger than 4½ by 6 feet in a respectful manner.",
});

const retaliation = clauseRule({
  id: "retaliation",
  title: "Retaliation against the tenant",
  citation: "83.64(1)",
  quote:
    "It is unlawful for a landlord to discriminatorily increase a tenant’s rent or decrease services to a tenant, or to bring or threaten to bring an action for possession or other civil action, primarily because the landlord is retaliating against the tenant.",
  fact: "retaliationClause",
  severity: "violation",
  problem: "The lease penalizes the tenant (higher rent, fewer services or termination) for protected conduct such as complaining to a code agency. Florida prohibits retaliation.",
  fix: "Delete the clause.",
});

const propertyRemoval: Rule = {
  id: "property-removal",
  title: "Removing the tenant's belongings",
  basis: [
    {
      citation: "83.67(5)",
      quote:
        "the landlord shall not remove the tenant’s personal property from the dwelling unit unless such action is taken after surrender, abandonment, recovery of possession of the dwelling unit due to the death of the last remaining tenant in accordance with s. 83.59(3)(d), or a lawful eviction",
    },
    {
      citation: "83.67(5)",
      quote: "if provided in the rental agreement, there must be printed or clearly stamped on such rental agreement a legend in substantially the following form",
    },
  ],
  facts: ["propertyRemovalClause"],
  check({ propertyRemovalClause: clauses }) {
    const base = { ruleId: this.id, citation: "83.67(5)", title: this.title };
    return clauses.flatMap((c): Finding[] => {
      if (c.status !== "present") return unclear(base, c, "removing the tenant's belongings");
      if (!c.value.onlyAfterSurrenderAbandonmentOrEviction)
        return [
          finding(
            base,
            "violation",
            "The lease lets the landlord remove the tenant's belongings without a surrender, abandonment or court eviction. Florida prohibits this.",
            c.span,
            "Landlord may remove Tenant's personal property only after surrender, abandonment, or a lawful eviction.",
          ),
        ];
      if (!c.value.legendPresent)
        return [
          finding(
            base,
            "void",
            "The lease says the landlord isn't responsible for belongings left after the tenant moves out, but it lacks the bold notice Florida requires for that waiver to work.",
            c.span,
            "Add the s. 83.67(5) legend in capital letters: “BY SIGNING THIS RENTAL AGREEMENT, THE TENANT AGREES THAT UPON SURRENDER, ABANDONMENT, OR RECOVERY OF POSSESSION…”.",
          ),
        ];
      return [];
    });
  },
};

const landlordAddress: Rule = {
  id: "landlord-address",
  title: "Landlord's name and address",
  basis: [
    {
      citation: "83.50",
      quote:
        "shall disclose in writing to the tenant, at or before the commencement of the tenancy, the name and address of the landlord or a person authorized to receive notices and demands in the landlord’s behalf",
    },
  ],
  facts: ["landlordNoticeAddress"],
  // A disclosure duty is met only by a clear disclosure, so an unclear one (e.g. a name
  // with no address) is the same `notice` gap as a missing one, not a `review`.
  check({ landlordNoticeAddress: a }) {
    const base = { ruleId: this.id, citation: "83.50", title: this.title };
    if (a.status === "present") return [];
    const fix = "Notices to Landlord shall be sent to: [name], [street address], [city], Florida [ZIP].";
    const tail = " Florida requires the landlord's (or agent's) name and address in writing at or before move-in; it may be given in a separate document.";
    if (a.status === "absent")
      return [finding(base, "notice", "The lease doesn't give a name and address for notices to the landlord." + tail, undefined, fix)];
    return [finding(base, "notice", `The lease doesn't clearly give a name and address for notices to the landlord (${a.note}).` + tail, a.span, fix)];
  },
};

export const RULES: Rule[] = [
  depositHolding,
  depositDisclosure,
  depositReturn,
  depositClaim,
  nonpaymentNotice,
  repairEntryNotice,
  repairEntryWindow,
  periodicTermination,
  endOfTermNotice,
  maintenanceWaiver,
  attorneyFees,
  liability,
  utilities,
  lockout,
  flag,
  retaliation,
  propertyRemoval,
  landlordAddress,
];
