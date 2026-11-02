# Label policy

How golden-set leases are labeled where the statute's text leaves room for interpretation. Justin decides these; the
extractor's fact definitions (`src/pipeline/prompt.ts`) and the rules (`src/rules/rules.ts`) follow them. Every eval
label must agree with this file. LeaseTrace gives information, not legal advice; these are product labeling choices.

| # | Clause pattern | Label | Decided | Implemented as |
|---|---|---|---|---|
| 1 | Landlord may interrupt utilities **only** for repairs, maintenance or other work, or to prevent property damage | `review` (83.67(1)) | 2026-11-01 | `utilityShutoffClause.purpose = "repair_or_damage_prevention"` → review; `"other"` → violation |
| 2 | Broad "not liable … from any cause" exculpation ending in "unless otherwise required by law" | `void` (83.47(1)(b)) | 2026-11-01 | Extractor reports it despite the savings phrase, `liabilityExculpation.scope = "broad"` → void |
| 3 | Attorney-fee carve-out broader than 83.48's own exception (e.g. no fees whenever punitive, exemplary or any personal-injury damages are sought) | `void` (83.48) | 2026-11-01 | Extractor reports `attorneyFeeWaiver` for over-broad carve-outs |
| 4 | Repair entry without 24h notice whenever an occupant or guest is home | `void` (83.53(2)) | 2026-11-01 | Extractor reports `repairEntryNoticeHours = 0` (shortest notice outside emergency or the tenant's own consent) |
| 5 | Entry purposes that include removing the tenant's things (perishable food after a power cut, hazards or "items prohibited under our rules", unauthorized window coverings) | `violation` (83.67(5)) | 2026-11-01 | Extractor reports each as a `propertyRemovalClause` instance with `onlyAfterSurrenderAbandonmentOrEviction = false` |
| 6 | Force majeure: landlord "excused from any further performance" after events beyond its control | `review` (83.47(1)(b)) | 2026-11-01 | `liabilityExculpation.scope = "force_majeure"` → review |
| 7 | Utility cutoff "according to statute" / "as permitted by law", with no circumstance named | `review` (83.67(1)) | 2026-11-01 | `utilityShutoffClause.purpose = "as_permitted_by_law"` → review |
| 8 | Non-liability limited to third parties' crimes, or to property the landlord stores after the tenant leaves | compliant (no finding) | 2026-11-01 | `liabilityExculpation.scope = "third_party_crime"` or `"stored_property"` → no finding; broad clauses (row 2) stay void |

Not a label rule, noted only: 83.49(1) requires a "Florida financial institution" and doesn't define it; a deposit at a
national bank with an out-of-state address is not flagged.

## Where these came from

All eight surfaced on the first live run against a real Florida Apartment Association–form lease. Facts were extracted
correctly; the findings differed only on interpretation, which is where these calls belong. Rows 5–8 came from the
run that first reported every matching clause instead of one per topic.
