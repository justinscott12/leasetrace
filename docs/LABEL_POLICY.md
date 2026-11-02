# Label policy

How golden-set leases are labeled where the statute's text leaves room for interpretation. Justin decides these; the
extractor's fact definitions (`src/pipeline/prompt.ts`) and the rules (`src/rules/rules.ts`) follow them. Every eval
label must agree with this file. LeaseTrace gives information, not legal advice; these are product labeling choices.

| # | Clause pattern | Label | Decided | Implemented as |
|---|---|---|---|---|
| 1 | Landlord may interrupt utilities **only** to make repairs or prevent property damage | `review` (83.67(1)) | 2026-11-01 | `utilityShutoffClause.repairOrDamagePreventionOnly = true` → review; any other purpose → violation |
| 2 | Broad "not liable … from any cause" exculpation ending in "unless otherwise required by law" | `void` (83.47(1)(b)) | 2026-11-01 | Extractor reports `liabilityExculpation` despite the savings phrase |
| 3 | Attorney-fee carve-out broader than 83.48's own exception (e.g. no fees whenever punitive, exemplary or any personal-injury damages are sought) | `void` (83.48) | 2026-11-01 | Extractor reports `attorneyFeeWaiver` for over-broad carve-outs |
| 4 | Repair entry without 24h notice whenever an occupant or guest is home | `void` (83.53(2)) | 2026-11-01 | Extractor reports `repairEntryNoticeHours = 0` (shortest notice outside emergency or the tenant's own consent) |

Not a label rule, noted only: 83.49(1) requires a "Florida financial institution" and doesn't define it; a deposit at a
national bank with an out-of-state address is not flagged.

## Why these four

All four surfaced on the first live run against a real Florida Apartment Association–form lease. Facts were extracted
correctly; the findings differed only on interpretation, which is where these calls belong.
