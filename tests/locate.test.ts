import { describe, expect, it } from "vitest";
import { locateQuote } from "../src/facts/locate.js";

const LEASE = `5. SECURITY DEPOSIT.  Tenant shall pay a deposit of $1,500.
Landlord will return the deposit within  sixty (60) days after
the tenant moves out. Landlord’s agent may enter with 12 hours’ notice.
The tenant shall keep the unit clean. The tenant shall keep the yard clean.`;

describe("locateQuote", () => {
  it("exact match", () => {
    const r = locateQuote(LEASE, "Tenant shall pay a deposit of $1,500.");
    expect(r?.method).toBe("exact");
    expect(LEASE.slice(r!.span.start, r!.span.end)).toBe("Tenant shall pay a deposit of $1,500.");
  });

  it("normalized: line breaks, double spaces, straight vs curly quotes, case", () => {
    const r = locateQuote(LEASE, "landlord will return the deposit within sixty (60) days after the tenant moves out.");
    expect(r?.method).toBe("normalized");
    expect(r!.span.quote).toBe("Landlord will return the deposit within  sixty (60) days after\nthe tenant moves out.");
    expect(locateQuote(LEASE, "Landlord's agent may enter with 12 hours' notice.")?.method).toBe("normalized");
  });

  it("fuzzy: a one-word slip in a long quote still lands on the right clause", () => {
    const r = locateQuote(LEASE, "Landlord will return the security deposit within sixty (60) days after the tenant moves out.");
    expect(r?.method).toBe("fuzzy");
    expect(r!.score).toBeGreaterThanOrEqual(0.9);
    expect(r!.span.quote).toContain("sixty (60) days");
    expect(LEASE.slice(r!.span.start, r!.span.end)).toBe(r!.span.quote);
  });

  it("fuzzy refuses an ambiguous match between two near-identical clauses", () => {
    expect(locateQuote(LEASE, "The tenant shall keep the unit and yard clean.")).toBeNull();
  });

  it("refuses a paraphrase", () => {
    expect(locateQuote(LEASE, "The landlord has two months to give back the money.")).toBeNull();
  });

  it("refuses short quotes it can't match exactly", () => {
    expect(locateQuote(LEASE, "60 dayz")).toBeNull();
    expect(locateQuote(LEASE, "   ")).toBeNull();
  });
});
