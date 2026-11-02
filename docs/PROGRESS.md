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
- [x] GitHub: repo renamed to `justinscott12/leasetrace` (old URL redirects); v1 saved on `v1-legacy` @ 4f605fb; v2 work lives on the `v2` branch.
- [ ] At launch (Milestone C deploy): swap `main` to v2 and update the repo description (it still says "commercial lease… LangGraph").

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
- [x] First real call (2026-11-01), on a real 79K-character FAA-form lease in `private/` (details in `private/NOTES.md`):
  - 2 free 400s first (schema limits) → generic fact list (DECISIONS.md). Then: all 21 facts reported, 17/17 quotes located
    **exactly**, 0 invalid values, every boundary value correct.
  - Opus 5.5, effort medium: **57 s, $0.41** (in 26.2K, cache write 31.8K, out 7.2K incl. thinking). Too slow for the live
    path's feel and pricier than estimated. Next: sweep effort/model on the eval set; replays carry the demo either way.
  - 4 findings, all on interpretation boundaries: 3 are the label questions below, plus 1 `review` on repair entry
    (24h notice applies only when nobody's home) — tri-state working as designed.
  - Cache hit not yet verified (a second call was deferred to stay inside the approved spend). Eval runs will show it.
- [x] Justin answered the label questions; fact definitions, utility rule and tests updated.
- [x] Re-ran the real lease twice after the label changes (2026-11-01):
  - **Cache verified:** run 1 wrote 32.1K prefix tokens ($0.41, 55 s); run 2 read all 32.1K from cache ($0.27, 60 s).
    Latency is dominated by ~7K output tokens, not input.
  - Label-policy items now behave as decided (repair entry → void, fees → void, exculpation → void).
  - **Two real problems found:**
    1. *One slot per fact loses clauses.* Leases often have several clauses on one topic. The model picks one per fact,
       and which one varies: the utility fact reported an electricity cutoff listed among entry purposes instead of the
       repair-interruption clause; the property-removal fact reported a "remove prohibited items" entry purpose instead of the
       compliant surrender/abandonment clause it picked last time.
    2. *Run-to-run variance.* Same input, 6 vs 7 findings: run 2 alone flagged an ordinary "reimburse us for damage you
       cause" clause as a maintenance waiver, which the definition explicitly excludes.
  - Also: the repair-hours rule now adds a `review` for the same "someone home" branch already voided by repair-entry-notice
    (double-counting one clause).
- [x] Multi-instance clause facts: each clause-type fact holds a list of instances and the rules check each one
      (DECISIONS.md). Also fixed the repair-hours double-count and tightened the maintenance-waiver definition. 110 tests.
- [x] Re-ran the real lease with clause instances (2026-11-01, $0.44, 65 s, 8.7K output tokens):
  - **Recall up:** 26 quotes located (25 exact, 1 normalized), every related clause now reported, including the
    repair-interruption clause and the compliant surrender/abandonment clause that earlier runs dropped.
  - **Precision down:** 13 findings. One was a definition gap ("interrupt utilities… to perform work" read as non-repair;
    definition widened to repairs, maintenance or other work, not yet re-run). The "reimburse damage you cause" clause is
    still flagged as a maintenance waiver despite the explicit exclusion. The rest are new interpretation questions (below).
  - **Lesson:** stop tuning on one lease. Further prompt changes need the golden set and repeated runs to show a real delta;
    otherwise this is overfitting to a single example.
- [x] Justin answered round 2 of label questions; rules, schema, prompt and tests updated (not re-run live).
- [ ] **Next unchecked item:** Decisions 4–5 (eval grading, citation safety), then the golden set with each case run several
      times and consistency reported. Known open precision issue: the "reimburse damage you cause" clause is still flagged as a
      maintenance waiver; measure it in evals before changing the prompt again.
- [ ] Out-of-scope items: extracted and located; not yet shown anywhere.
- [ ] Teach-mode Decisions 4–5 (eval grading, fabricated-citation prevention)
- [ ] Golden set (Justin approves labels), dev/test split
- [ ] `npm run eval`
- [ ] First honest scores → recall ≥ 0.9, fabricated citations = 0

### Label policy — answered 2026-11-01, see docs/LABEL_POLICY.md
Utility interruption for repairs only → review · broad exculpation with "unless required by law" → void · attorney-fee
carve-out broader than 83.48's → void · no-notice repair entry when someone's home → void (reported as 0 hours' notice).
Rules, fact definitions and tests updated (103 passing). Expected on the real lease now: 3 void + 1 review.

### Label policy round 2 — answered 2026-11-01 (docs/LABEL_POLICY.md rows 5–8)
Entry-purpose removals → violation · force majeure → review · cutoff "according to statute" → review · non-liability limited
to third-party crime or stored property → compliant. Encoded as values the rules decide on (`liabilityExculpation.scope`,
`utilityShutoffClause.purpose`), not prompt-only exclusions, so they're unit-tested. 116 tests.

A private precision check on a real lease lives in `private/` (gitignored; see `private/NOTES.md` locally).

## C. Demo UI
- [ ] Decision 6 (lease input), replays, audit view, evals page, how-it-works, deploy

## D. Portfolio launch
- [ ] Portfolio card update, case study, recording

## Environment notes
- Node is 20.9 (past EOL). Current TypeScript 7 and vitest 4 won't run on it, so they're pinned to typescript@5.9 and vitest@3.
  Upgrade Node to the current LTS and unpin them.

## Session log
- 2026-10-28: Milestone A done except v1-legacy branch. Extraction pipeline built and unit-tested (no real API call yet). Nothing committed. Renamed LegalTrace → LeaseTrace locally (package, docs, decision logs). Folder renamed to `workspace/leasetrace`. GitHub repo still `justinscott12/legaltrace`; rename it there when v2 is pushed.
- 2026-10-30: First commit on `v2`, pushed. Personal lease notes moved to gitignored `private/NOTES.md` before pushing.
- 2026-11-01: First live audit works end to end (after a schema redesign forced by API grammar limits). 101 tests. Spend so far ≈ $0.43. Not committed.
- 2026-11-01 (later): label policy implemented; 2 more live runs (cache verified). Found the one-slot-per-fact limitation and run-to-run variance. Spend so far ≈ $1.10.
- 2026-11-01 (later): multi-instance clause facts built; 110 tests. No paid runs since the last two.
- 2026-11-01 (later): live run with clause instances — recall fixed, precision exposed new label questions. Spend ≈ $1.54.
- 2026-11-01 (later): label policy round 2 encoded (scope/purpose values); 116 tests. Not re-run live.
