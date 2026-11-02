# Progress

Resume: read `BUILD_PROMPT.md` → `docs/DECISIONS.md` → this file. Then `npm i && npm test`.
`npm run eval -- --dry` lists the golden set for free; live eval runs cost money (ask Justin first).

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
- [x] Decisions 4–5 decided and logged (teach mode off): deterministic grading against hand labels; the model emits no
      citations at all. See DECISIONS.md.
- [x] Golden set: 22 fictional leases in `evals/leases/` (13 dev, 9 test), each with `*.labels.json`. Varied form: plain,
      articled, a scanned-looking one with page headers and broken lines, a texted rental, a lease pasted from a forwarded
      email with `>` markers, two commercial leases (must produce no findings). 56 expected findings (4 optional), 35
      near-misses (compliant clauses that look like violations), 16 out-of-scope items. Every rule has a required label
      in dev and in test (except landlord-address in test, optional only). Case 10 deliberately exercises a known rule gap:
      a fixed term that rolls month-to-month with 10 days' notice (the periodic rule skips fixed-term leases), and case 11
      repeats the real lease's "reimburse damage" false-positive pattern.
- [x] Scorer + runner: `src/evals/{golden,score,report}.ts`, `scripts/eval.ts`.
  - Match = rule + citation + span overlap (spanless labels match on rule + citation). Strict headline: wrong severity
    = miss + false positive. Duplicates on an already-matched clause are counted separately, not as false positives.
  - Reports per split and per rule: precision, recall, fabricated-citation rate, unlocated-quote rate, scope accuracy,
    out-of-scope recall, per-label hit rate across runs, run-to-run agreement, false positives tagged by near-miss, cost
    and latency p50/p90.
  - `--rescore <results.json>` re-runs current rules on stored extractions: rule changes get an eval delta for $0.
  - `npm run labels:review` writes `evals/REVIEW.md`, a readable sheet of every label for approval.
  - Tests: 132 passing (label integrity, rule coverage per split, perfect-run = 1.0, scorer edge cases).
- [x] Pre-spend hardening (free): audited every label as the scorer would see it and fixed 7 that would have marked a
      correct answer wrong. Label convention now: quote the *whole* clause (any sentence of it counts), use a spanless label
      when the finding can legitimately come with or without a clause (e.g. a bare bank name read as "no disclosure" or as a
      partial one), mark genuinely arguable ones optional, and grade commercial cases on scope only. Runner now checkpoints
      after every call (`*.partial.json`), resumes without re-paying (`--resume`), extends a finished file (`--resume f.json
      --runs 3`), stops after the first call if it fails, after 3 failures in a row or on an auth error, and stops starting
      calls at `--max-usd` (default $15). Fail-fast and resume verified with an invalid key ($0).
- [x] **First eval run** (2026-11-02, dev, 1 pass, Opus 5.5 medium): `evals/results/2026-11-02-02-30-claude-opus-5-5-medium.json`.
  - **$0.97 total**: $0.22 for the cache-writing call, then $0.04–0.08 per lease (32.7K prefix tokens read from cache,
    1.6–3.3K output). Latency p50 18.8 s, p90 21.6 s. Far below the estimate, which came from the 79K-char real lease.
  - Strict P 96.9% / R 93.9% (tp 31, fp 1, fn 2). Fabricated citations 0%, unlocated quotes 0%, scope 100%,
    out-of-scope recall 100%, no false positive on any of the 35 near-misses (including case 11's reimbursement clause).
  - Both errors were in the rules; the extraction was right both times:
    1. Case 10: extracted perfectly (fixed term + 10 days' notice in the month-to-month renewal), but the periodic rule
       skipped every fixed-term lease. Now a fixed term's renewal notice is checked against 83.57(3).
    2. Case 12: manager named, no address → extractor said `unclear` (correct), rule turned it into `review`. A
       disclosure duty is only met by a clear disclosure, so landlord-address now reports `notice` for unclear too.
  - **Eval delta (free `--rescore`, `…-medium-rescored.json`): strict P 100% / R 100% (tp 33, fp 0, fn 0).** 134 tests.
  - Caveats, honestly: one pass only (no variance yet); two rules were changed after seeing dev, so dev is no longer a
    clean measure; Claude wrote these leases, so they may be cleaner than real ones (the real lease had 13 findings with
    interpretation questions; a perfect score here doesn't settle those). The held-out test split is untouched.
- [x] **Full eval** (2026-11-02, Opus 5.5 medium, 3 passes per case, current rules):
  - dev (13 cases, 39 runs, `…02-30…-medium-rescored.json`): strict P 100% / R 100% (tp 99), every case 100% run-to-run agreement.
  - **test (9 held-out cases, 27 runs, `…19-03…-medium-test.json`): strict P 100% / R 100% (tp 57, fp 0, fn 0)**, 100%
    agreement. Fabricated citations 0%, unlocated quotes 0%, scope 100%, out-of-scope recall 100% on both splits.
  - Cost: dev $2.70 (39 runs), test $1.55 (27 runs) → **$0.057–0.069 per audit**, latency p50 19 s / p90 29 s.
  - Optional labels: 3 of 4 always hit; the §3 plumbing restatement in case 14 was never flagged (fine either way).
  - **Reading it honestly: the set is saturated.** A perfect, perfectly consistent score means these leases no longer
    discriminate. Claude wrote leases and labels with the rules in view, so violations are stated plainly, one per clause.
    The real 79K-char lease is the counterexample: same pipeline, 13 findings, several of them interpretation calls.
- [x] **Hard set** (`evals/hard/`, built by `npm run hard:build` from `evals/hard/source/{library,specs}.ts`): 8 leases
      of 7–16K chars (4 dev / 4 test), 29 labels. Boilerplate library plus per-lease target clauses buried in it: entry-purpose
      lists, savings phrases, rekey-on-default, force majeure, AS-IS, deadlines in later sections, scanned layout.
  - Opus 5.5 medium ×3 (old prompt): dev P 95.5 / R 100; **test P 92.9 / R 92.9**. Errors: (dev) the AS-IS "no obligation to
    make repairs" clause also reported as a broad liability limit, because the exculpation definition included "excused from
    its obligations"; (test, hard-07) "notice by the 15th, effective month-end" → model correctly reasoned "13–16 days" but
    reported `unclear` (single-integer fact), so `review` instead of `void`. Test failure left as is (no tuning on test).
  - Dev fix: exculpation definition now excludes pure repair-duty removals (they belong to structuralMaintenanceWaiver).
    Confirmed: hard dev ×3 → **P 100 / R 100** (tp 42). Results files now record `promptSha`; the site never pools prompts.
- [x] **Model/effort sweep** (test splits, 2 runs each, mostly on the earlier prompt): Opus low, Sonnet 5.5 medium/low,
      Haiku 5.5 medium. All between ~89–97% P/R; Haiku costs $0.002–0.004 per audit. Differences of 1–2 findings are noise.
- [x] **Demo site** (Vite + React, static, hash routes; `npm run dev`): home with sample cards, recorded-audit replay with
      trace + highlighted lease + statute pop-ups, check-your-own-lease (BYOK, PDF/txt/paste; Decision 6), evals page and
      how-it-works generated from `public/data/*.json` (`npm run site:data`, rescored from stored runs, $0). GitHub Pages
      workflow in `.github/workflows/pages.yml` (runs on push to main; not enabled yet).
- [x] Credit added; finished on the final prompt (`promptSha` d5b46574916a), Opus 5.5 medium, 3 runs per lease:
  - Tuning: first set 13 leases → P/R 100 (tp 33, 1 run); hard set 4 leases ×3 → P/R 100 (tp 42).
  - **Held out: first set 9 ×3 → P/R 100 (tp 57); hard set 4 ×3 → P/R 92.9 (tp 39, fp 3, fn 3); all → P/R 97.0 (96/99).**
    Only error: hard-07 "notice by the 15th" → review instead of void, identical in all 3 runs (left unfixed: test lease).
  - Fabricated citations 0, unlocated quotes 0, scope 100%. $0.06–0.10 per audit, p50 19–27 s.
  - Replays recorded (`public/replays/*.json`, $0.51): every sample's findings match its labels. Playback runs at 4× or 8×
    (labeled) so the longest, 42 s, plays in ~5 s.
  - Total project API spend ≈ $16.82 (evals $14.77, replays $0.51, early real-lease runs $1.54). README rewritten. 135 tests; production build OK (first load 64 KB gzip).
- [x] Published 2026-11-02: v2 committed (5e31154, abb5d29 pins LF endings), `main` force-pointed at v2 (v1 kept on
      `v1-legacy` @ 4f605fb), GitHub Pages on (Actions), repo description + homepage updated. Live and verified:
      https://justinscott12.github.io/leasetrace/ (replays play and finish, evals and how pages load, no console errors).
      Not verified live: check-your-own-lease (needs a real key; Claude doesn't enter keys).
- [x] Portfolio, LIVE 2026-11-02 (portfolio main @ 22751a3, branch `leasetrace`): LeaseTrace is the first card under Live & published in
      `lib/projects.ts` (old LegalTrace prototype card removed), screenshot `public/projects/leasetrace.webp`, case study at
      `app/projects/leasetrace/page.tsx`. Homepage "Featured work" unchanged (its subtitle claims real users).
- [ ] **Next unchecked item:** Justin approves labels (`evals/REVIEW.md`, 30 cases; flip `"approved": true`, then
      `npm run site:data` and push so the evals page drops "awaiting review"); one live BYOK check with his key.
- [ ] Possible v2.1: deadline-style notice ("by the 15th") → report the shortest notice it allows; needs fresh held-out
      leases to re-measure, since the failure was found on a test lease. Re-run the model sweep on the final prompt (~$3).
- [x] First honest scores → test recall ≥ 0.9, fabricated citations = 0 (met on the current set; see the saturation caveat)
- [ ] Effort/model sweep on the eval set; publish the cost-quality table
- [ ] Minor: the corpus's `83.49(2)(d)` subsection text omits the quoted disclosure block (it's only in the section
      text). Matters for linking citations in the UI.

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
- 2026-11-01 (night): Decisions 4–5; golden set (22 leases, labels unapproved); eval scorer, runner, rescore, review sheet; 132 tests. No paid calls.
- 2026-11-02: first paid eval (dev ×1, $0.97): P 96.9 / R 93.9 → two rule fixes → rescored P 100 / R 100. 134 tests.
- 2026-11-02: 3-pass eval on both splits: dev and test both P 100 / R 100, 100% agreement, $4.25 for 66 runs. Set saturated → next: harder set.
- 2026-11-02 (later): hard set + sweep + demo site; prompt fix confirmed on hard dev (100/100); out of API credit mid-run.
- 2026-11-02 (evening): final held-out runs on the final prompt (all P/R 97.0), replays recorded, README. Spend ≈ $16.82.
