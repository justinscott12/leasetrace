// Each rule is tested at the statute's boundary (e.g. 15 days ok, 16 void),
// plus silence and "unclear" behavior.
import { describe, expect, it } from "vitest";
import { type Fact, type Instance, type LeaseFacts, silentLease } from "../src/facts/schema.js";
import { runRules } from "../src/rules/engine.js";
import { RULES } from "../src/rules/rules.js";

const LEASE = "Sample clause text used for spans.";
const span = { start: 0, end: 6, quote: "Sample" };
const present = <T,>(value: T): Instance<T> => ({ status: "present", value, span });
const unclear: Fact<never> = { status: "unclear", note: "conflicting clauses" };

function run(ruleId: string, patch: Partial<LeaseFacts>) {
  const rule = RULES.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`no rule ${ruleId}`);
  return rule.check({ ...silentLease(), ...patch });
}
const severities = (id: string, patch: Partial<LeaseFacts>) => run(id, patch).map((f) => f.severity);

describe("silence", () => {
  it("a silent lease only yields the required-disclosure gap (83.50)", () => {
    const { findings } = runRules(silentLease(), LEASE);
    expect(findings.map((f) => [f.ruleId, f.severity])).toEqual([["landlord-address", "notice"]]);
  });
});

describe("deposit-holding — 83.49(1)", () => {
  it.each(["separate_non_interest", "separate_interest", "surety_bond"] as const)("%s is lawful", (v) => {
    expect(run("deposit-holding", { depositHolding: present(v) })).toEqual([]);
  });
  it("commingling is a violation", () => {
    expect(severities("deposit-holding", { depositHolding: present("commingled") })).toEqual(["violation"]);
  });
  it("landlord discretion is a violation", () => {
    expect(severities("deposit-holding", { depositHolding: present("unspecified_landlord_discretion") })).toEqual(["violation"]);
  });
});

describe("deposit-disclosure — 83.49(2)", () => {
  const full = { depositoryNamedOrBond: true, interestStated: true, statutoryNoticeIncluded: true };
  it("no deposit, no finding", () => expect(run("deposit-disclosure", {})).toEqual([]));
  it("a $0 deposit needs no disclosure (seen in a real FAA lease)", () =>
    expect(run("deposit-disclosure", { securityDeposit: present({ amount: 0 }) })).toEqual([]));
  it("deposit without disclosure is a notice, not a violation (can be given within 30 days)", () => {
    expect(severities("deposit-disclosure", { securityDeposit: present({ amount: 1500 }) })).toEqual(["notice"]);
  });
  it("complete disclosure passes", () => {
    expect(run("deposit-disclosure", { securityDeposit: present({ amount: 1500 }), depositDisclosure: present(full) })).toEqual([]);
  });
  it("names each missing element", () => {
    const [f] = run("deposit-disclosure", {
      securityDeposit: present({ amount: 1500 }),
      depositDisclosure: present({ ...full, interestStated: false }),
    });
    expect(f?.problem).toContain("interest");
  });
});

describe("deposit-return-deadline — 83.49(3)(a): within 15 days", () => {
  it("15 days ok", () => expect(run("deposit-return-deadline", { depositReturnDays: present(15) })).toEqual([]));
  it("16 days void", () => expect(severities("deposit-return-deadline", { depositReturnDays: present(16) })).toEqual(["void"]));
  it("unclear → review", () => expect(severities("deposit-return-deadline", { depositReturnDays: unclear })).toEqual(["review"]));
});

describe("deposit-claim-deadline — 83.49(3)(a): within 30 days", () => {
  it("30 days ok", () => expect(run("deposit-claim-deadline", { depositClaimNoticeDays: present(30) })).toEqual([]));
  it("45 days void", () => expect(severities("deposit-claim-deadline", { depositClaimNoticeDays: present(45) })).toEqual(["void"]));
});

describe("nonpayment-notice — 83.56(3): 3 days excluding weekends and court holidays", () => {
  it("3 business days ok", () =>
    expect(run("nonpayment-notice", { nonpaymentNotice: present({ days: 3, excludesWeekendsAndHolidays: true }) })).toEqual([]));
  it("5 days, counting unspecified, ok", () =>
    expect(run("nonpayment-notice", { nonpaymentNotice: present({ days: 5, excludesWeekendsAndHolidays: null }) })).toEqual([]));
  it("1 day void", () =>
    expect(severities("nonpayment-notice", { nonpaymentNotice: present({ days: 1, excludesWeekendsAndHolidays: true }) })).toEqual(["void"]));
  it("3 calendar days void", () =>
    expect(severities("nonpayment-notice", { nonpaymentNotice: present({ days: 3, excludesWeekendsAndHolidays: false }) })).toEqual(["void"]));
  it("2 calendar days: both problems", () =>
    expect(severities("nonpayment-notice", { nonpaymentNotice: present({ days: 2, excludesWeekendsAndHolidays: false }) })).toEqual(["void", "void"]));
});

describe("repair-entry-notice — 83.53(2): at least 24 hours", () => {
  it("24 hours ok", () => expect(run("repair-entry-notice", { repairEntryNoticeHours: present(24) })).toEqual([]));
  it("12 hours void", () => expect(severities("repair-entry-notice", { repairEntryNoticeHours: present(12) })).toEqual(["void"]));
  it("no notice void", () => expect(run("repair-entry-notice", { repairEntryNoticeHours: present(0) })[0]?.problem).toContain("no notice"));
});

describe("repair-entry-hours — 83.53(2): 7:30 a.m. to 8:00 p.m.", () => {
  const w = (s: number | null, e: number | null) => ({ repairEntryWindow: present({ startMinute: s, endMinute: e }) });
  it("exactly 7:30–20:00 ok", () => expect(run("repair-entry-hours", w(450, 1200))).toEqual([]));
  it("9–5 ok", () => expect(run("repair-entry-hours", w(540, 1020))).toEqual([]));
  it("7:00 start void", () => expect(severities("repair-entry-hours", w(420, 1200))).toEqual(["void"]));
  it("9 p.m. end void", () => expect(severities("repair-entry-hours", w(450, 1260))).toEqual(["void"]));
  it("any time void", () => expect(severities("repair-entry-hours", w(null, null))).toEqual(["void"]));
});

describe("periodic-termination-notice — 83.57", () => {
  const p = (t: LeaseFacts["tenancyType"], tenant: number | null, landlord: number | null) => ({
    tenancyType: t,
    periodicTerminationNoticeDays: present({ tenant, landlord }),
  });
  it("month-to-month 30 days ok (amended from 15)", () =>
    expect(run("periodic-termination-notice", p(present("month_to_month"), 30, 30))).toEqual([]));
  it("month-to-month 15 days void", () => {
    const [f] = run("periodic-termination-notice", p(present("month_to_month"), 15, 30));
    expect(f?.severity).toBe("void");
    expect(f?.citation).toBe("83.57(3)");
    expect(f?.problem).toContain("tenant");
    expect(f?.problem).not.toContain("landlord to give");
  });
  it("week-to-week 7 ok, 6 void", () => {
    expect(run("periodic-termination-notice", p(present("week_to_week"), 7, 7))).toEqual([]);
    expect(run("periodic-termination-notice", p(present("week_to_week"), 7, 6))[0]?.citation).toBe("83.57(4)");
  });
  it("year-to-year needs 60", () =>
    expect(severities("periodic-termination-notice", p(present("year_to_year"), 30, 60))).toEqual(["void"]));
  it("fixed term with no renewal notice → nothing", () =>
    expect(run("periodic-termination-notice", { tenancyType: present("fixed_term") })).toEqual([]));
  it("fixed term renewing month-to-month: renewal notice is held to 83.57(3)", () => {
    expect(run("periodic-termination-notice", p(present("fixed_term"), 30, 30))).toEqual([]);
    const [f] = run("periodic-termination-notice", p(present("fixed_term"), 10, 10));
    expect(f).toMatchObject({ severity: "void", citation: "83.57(3)" });
    expect(f?.problem).toContain("month-to-month renewal");
  });
});

describe("end-of-term-notice — 83.575(1): 30 to 60 days", () => {
  const e = (tenant: number | null, landlord: number | null) => ({
    tenancyType: present("fixed_term" as const),
    endOfTermNoticeDays: present({ tenant, landlord }),
  });
  it("30 and 60 ok", () => {
    expect(run("end-of-term-notice", e(30, 30))).toEqual([]);
    expect(run("end-of-term-notice", e(60, 60))).toEqual([]);
  });
  it("90 days from tenant void", () => expect(severities("end-of-term-notice", e(90, 30))).toEqual(["void"]));
  it("29 days void", () => expect(severities("end-of-term-notice", e(29, null))).toEqual(["void"]));
  it("month-to-month is out of this rule", () =>
    expect(run("end-of-term-notice", { tenancyType: present("month_to_month"), endOfTermNoticeDays: present({ tenant: 90, landlord: null }) })).toEqual([]));
});

describe("maintenance-waiver — 83.51(1) + 83.47(1)(a)", () => {
  const waiver = { structuralMaintenanceWaiver: [present(true as const)] };
  it("allowed in writing for a single-family home (near-miss)", () =>
    expect(run("maintenance-waiver", { ...waiver, propertyType: present("single_family") })).toEqual([]));
  it("allowed for a duplex", () => expect(run("maintenance-waiver", { ...waiver, propertyType: present("duplex") })).toEqual([]));
  it("void for an apartment", () =>
    expect(severities("maintenance-waiver", { ...waiver, propertyType: present("multi_unit") })).toEqual(["void"]));
  it("review when property type unknown", () => expect(severities("maintenance-waiver", waiver)).toEqual(["review"]));
  it("each waiver clause is its own finding", () =>
    expect(
      severities("maintenance-waiver", { structuralMaintenanceWaiver: [present(true as const), present(true as const)], propertyType: present("multi_unit") }),
    ).toEqual(["void", "void"]));
});

describe("clause rules: present → finding, absent → nothing", () => {
  const cases = [
    ["attorney-fee-waiver", "attorneyFeeWaiver", "void", "83.48"],
    ["lockout", "lockoutClause", "violation", "83.67(2)"],
    ["flag-ban", "flagBan", "void", "83.67(4)"],
    ["retaliation", "retaliationClause", "violation", "83.64(1)"],
  ] as const;
  it.each(cases)("%s", (id, key, severity, citation) => {
    expect(run(id, {})).toEqual([]);
    const [f] = run(id, { [key]: [present(true as const)] });
    expect(f).toMatchObject({ severity, citation, span, path: "code_rule" });
    expect(f?.suggestedFix).toBeTruthy();
    expect(severities(id, { [key]: [{ status: "unclear", note: "vague" }] })).toEqual(["review"]);
  });
});

describe("utility-shutoff — 83.67(1) + label policy", () => {
  const clause = (repairOnly: boolean) => present({ purpose: repairOnly ? ("repair_or_damage_prevention" as const) : ("other" as const) });
  const u = (repairOnly: boolean) => ({ utilityShutoffClause: [clause(repairOnly)] });
  it('"according to statute" → review (label call, 2026-11-01)', () =>
    expect(severities("utility-shutoff", { utilityShutoffClause: [present({ purpose: "as_permitted_by_law" as const })] })).toEqual(["review"]));
  it("absent → nothing", () => expect(run("utility-shutoff", {})).toEqual([]));
  it("shutoff for any other purpose is a violation", () => {
    const [f] = run("utility-shutoff", u(false));
    expect(f).toMatchObject({ severity: "violation", citation: "83.67(1)", span });
  });
  it("interruptions limited to repairs / preventing damage → review (Justin's label call, 2026-11-01)", () =>
    expect(severities("utility-shutoff", u(true))).toEqual(["review"]));
  it("a lease with both kinds of clause gets both findings (seen on a real lease)", () =>
    expect(severities("utility-shutoff", { utilityShutoffClause: [clause(true), clause(false)] })).toEqual(["review", "violation"]));
});

describe("liability-exculpation — 83.47(1)(b) + label policy", () => {
  const l = (scope: "broad" | "force_majeure" | "third_party_crime" | "stored_property") => ({ liabilityExculpation: [present({ scope })] });
  it("absent → nothing", () => expect(run("liability-exculpation", {})).toEqual([]));
  it("broad → void (even with a savings phrase)", () => {
    const [f] = run("liability-exculpation", l("broad"));
    expect(f).toMatchObject({ severity: "void", citation: "83.47(1)(b)", span });
  });
  it("force majeure → review", () => expect(severities("liability-exculpation", l("force_majeure"))).toEqual(["review"]));
  it("third-party crime only → no finding", () => expect(run("liability-exculpation", l("third_party_crime"))).toEqual([]));
  it("stored property only → no finding", () => expect(run("liability-exculpation", l("stored_property"))).toEqual([]));
  it("unclear → review", () =>
    expect(severities("liability-exculpation", { liabilityExculpation: [{ status: "unclear", note: "x" }] })).toEqual(["review"]));
});

describe("property-removal — 83.67(5)", () => {
  const c = (only: boolean, legend: boolean) => ({
    propertyRemovalClause: [present({ onlyAfterSurrenderAbandonmentOrEviction: only, legendPresent: legend })],
  });
  it("after surrender with legend ok", () => expect(run("property-removal", c(true, true))).toEqual([]));
  it("after surrender without legend void", () => expect(severities("property-removal", c(true, false))).toEqual(["void"]));
  it("any time is a violation", () => expect(severities("property-removal", c(false, true))).toEqual(["violation"]));
  it("a compliant clause doesn't hide a violating one", () =>
    expect(
      severities("property-removal", {
        propertyRemovalClause: [...c(true, true).propertyRemovalClause, ...c(false, true).propertyRemovalClause],
      }),
    ).toEqual(["violation"]));
});

describe("landlord-address — 83.50", () => {
  it("present ok", () => expect(run("landlord-address", { landlordNoticeAddress: present("PO Box 1") })).toEqual([]));
  it("absent → notice gap", () => expect(severities("landlord-address", {})).toEqual(["notice"]));
  it("unclear (name, no address) → notice, not review", () => {
    const [f] = run("landlord-address", { landlordNoticeAddress: { status: "unclear", note: "no address", span } });
    expect(f).toMatchObject({ severity: "notice", span });
  });
});

describe("engine validation", () => {
  it("drops a finding whose span doesn't match the lease text", () => {
    const bad = { status: "present" as const, value: true as const, span: { start: 0, end: 6, quote: "Nope!!" } };
    const { findings, dropped } = runRules({ ...silentLease(), lockoutClause: [bad], landlordNoticeAddress: present("x") }, LEASE);
    expect(findings).toEqual([]);
    expect(dropped[0]?.reason).toMatch(/span/);
  });
  it("keeps a finding whose span matches", () => {
    const { findings } = runRules({ ...silentLease(), lockoutClause: [present(true as const)], landlordNoticeAddress: present("x") }, LEASE);
    expect(findings.map((f) => f.ruleId)).toEqual(["lockout"]);
  });
});
