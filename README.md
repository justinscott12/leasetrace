# LeaseTrace

Checks a **Florida residential lease** against Florida Statutes Chapter 83, Part II (Residential Tenancies). It flags clauses
that violate the statute or are void, cites the exact subsection, and suggests a fix.

**Not legal advice.** LeaseTrace gives information, not representation.

> Formerly LegalTrace. v2 rebuild in progress. v1 (2026-01) checked commercial leases against residential-only sections and
> its critique step always passed. v2 starts from scratch with evals. See `docs/PROGRESS.md`.

## How it works (so far)
- `corpus/part2.json`: the official 2026 statute text, fetched by `npm run corpus:fetch` and checked in. Nothing is fetched at runtime.
- An LLM extracts structured facts from the lease (with quoted spans). It never decides violations.
- Deterministic TypeScript rules in `src/rules/` decide, and each one quotes the subsection it comes from.

## Run locally
```
npm i
npm test
```
