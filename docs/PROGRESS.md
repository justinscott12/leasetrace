# Progress

Resume: read `BUILD_PROMPT.md` → `docs/DECISIONS.md` → this file. Then `npm i && npm test`.
(`npm run eval` doesn't exist yet; it arrives in Milestone B.)

## A. Foundations
- [x] Teach-mode Decisions 1–3 (+ 2b silence semantics) — see DECISIONS.md
- [x] Repo scaffold (TS strict, vitest, tsx). UI framework deliberately deferred to Milestone C.
- [x] Corpus fetch script `scripts/fetch-corpus.ts` → `corpus/part2.json`
  - 2026 Florida Statutes, retrieved 2026-10-28 from leg.state.fl.us, 40 sections (83.40–83.684), 256 subsections, ~21K tokens
  - Handles the Legislature's compound numbering (`(1)(a)` on an unnumbered parent, e.g. 83.491)
- [x] Rule set: 18 rules in `src/rules/rules.ts`, each with a statute quote verified against the corpus by `tests/corpus.test.ts`
- [x] Unit tests: 75 passing (boundaries, silence, unclear, near-misses like the SFH/duplex 83.51(1) waiver)
- [ ] Not yet: rename the GitHub repo to `leasetrace` (GitHub redirects the old URL) and keep v1 on a `v1-legacy` branch (v1 is `justinscott12/legaltrace` @ 4f605fb on GitHub — needs Justin's OK before pushing anything)

### Rules (id → citation)
deposit-holding 83.49(1) · deposit-disclosure 83.49(2) · deposit-return-deadline 83.49(3)(a) · deposit-claim-deadline 83.49(3)(a) ·
nonpayment-notice 83.56(3) · repair-entry-notice 83.53(2) · repair-entry-hours 83.53(2) · periodic-termination-notice 83.57(1)–(4) ·
end-of-term-notice 83.575(1) · maintenance-waiver 83.51(1)+83.47(1)(a) · attorney-fee-waiver 83.48 · liability-exculpation 83.47(1)(b) ·
utility-shutoff 83.67(1) · lockout 83.67(2) · flag-ban 83.67(4) · retaliation 83.64(1) · property-removal 83.67(5) · landlord-address 83.50

Statute facts verified in the 2026 text, not from memory: month-to-month notice is **30 days** (83.57(3)); 3-day notice excludes
weekends and **court-observed** holidays only (83.56(3)); repair entry is 24h notice, 7:30 a.m.–8:00 p.m. (83.53(2)); fixed-term
end-of-lease notice must be 30–60 days (83.575(1)).

Out of scope for now (emit `out_of_scope`, never guess): late-fee amounts (no Part II cap), HOA rules, local ordinances,
federal fair housing, jury waivers, commercial leases.

## B. Pipeline and evals — IN PROGRESS
- [x] Extraction pipeline (`src/pipeline/`): one `client.beta.messages.parse` call with structured output (`src/facts/wire.ts`, zod),
      cached system prefix = instructions + full corpus (`prompt.ts`), lease after the breakpoint, `fallbacks: "default"`
      (`server-side-fallback-2026-07-01`), effort configurable (default `medium`), model default `claude-opus-5-5`.
  - Quotes → spans via `src/facts/locate.ts` (tiers, see DECISIONS.md). Unfound quote → fact becomes `unclear`.
  - Typed failures: empty, too_long (200K chars), refusal, truncated, bad_output, auth, rate_limit, timeout, api. Never a fabricated result.
  - Cost per call from `usage` × `pricing.ts`; latency; cache read/write tokens. Haiku 5.5 cache-read price is an assumption — verify.
  - `audit.ts`: extract → rules → trace events (the future replay format). Non-residential lease → no Part II findings.
  - SDK browser flag for the BYOK path confirmed in SDK 1.3.0: `dangerouslyAllowBrowser: true`.
- [x] Tests with a fake client (no network, no cost): 95 passing.
- [ ] **Next unchecked item:** first real call. Needs Justin's API key in his environment and his OK on spend
      (~$0.20–0.30 per Opus call with a cold cache; cheaper once cached). Smoke test privately on a real lease in `private/`.
- [ ] Out-of-scope items: extracted and located; not yet shown anywhere.
- [ ] Teach-mode Decisions 4–5 (eval grading, fabricated-citation prevention)
- [ ] Golden set (Justin approves labels), dev/test split
- [ ] `npm run eval`
- [ ] First honest scores → recall ≥ 0.9, fabricated citations = 0

### Label questions for Justin (legal interpretation, his call during label review)
- A clause letting the landlord "interrupt utilities as needed to perform work": a 83.67(1) utility-interruption clause, or a
  permitted repair interruption? The extractor definition currently targets shutoffs like "for late rent".
- "We're not liable for… unless otherwise required by law": does the savings clause make it compliant under 83.47(1)(b)?
- 83.49(1) requires a "Florida financial institution"; the statute text doesn't define it. A deposit at a national bank with an
  out-of-state address is probably fine; note it, don't make it a rule.

A private precision check on a real lease lives in `private/` (gitignored; see `private/NOTES.md` locally).

## C. Demo UI
- [ ] Decision 6 (lease input), replays, audit view, evals page, how-it-works, deploy

## D. Portfolio launch
- [ ] Portfolio card update, case study, recording

## Environment notes
- Node is 20.9 (past EOL). Current TypeScript 7 and vitest 4 won't run on it, so they're pinned to typescript@5.9 and vitest@3.
  Upgrade Node to the current LTS and unpin them.

## Session log
- 2026-10-28: Milestone A done except v1-legacy branch. Extraction pipeline built and unit-tested (no real API call yet). Nothing committed. Renamed LegalTrace → LeaseTrace locally (package, docs, decision logs). Folder rename `workspace/legaltrace` → `workspace/leasetrace` still pending: it was locked by the session's own MCP servers; do it with the session closed. GitHub repo still `justinscott12/legaltrace`; rename it there when v2 is pushed.
