import { describe, expect, it } from "vitest";
import { corpus, isCitation, quoteInCitation } from "../src/corpus/index.js";
import { RULES } from "../src/rules/rules.js";

describe("corpus", () => {
  it("is the 2026 Part II text with its source recorded", () => {
    expect(corpus.statuteYear).toBe(2026);
    expect(corpus.indexUrl).toContain("leg.state.fl.us");
    expect(corpus.sections[0]?.number).toBe("83.40");
    expect(corpus.sections.length).toBeGreaterThanOrEqual(39);
  });

  it("keys subsections the way the statute cites them", () => {
    for (const id of ["83.49(3)(a)", "83.56(3)", "83.57(3)", "83.491(2)(b)1.", "83.48"]) expect(isCitation(id)).toBe(true);
    expect(isCitation("83.49(9)(z)")).toBe(false);
  });
});

describe("every rule traces to a statute quote", () => {
  for (const rule of RULES)
    it(rule.id, () => {
      expect(rule.basis.length).toBeGreaterThan(0);
      for (const b of rule.basis) expect(quoteInCitation(b.citation, b.quote), `${b.citation}: "${b.quote}"`).toBe(true);
    });

  it("rule ids are unique", () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });
});
