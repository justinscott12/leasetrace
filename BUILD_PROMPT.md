# LeaseTrace (formerly LegalTrace) v2: build prompt

Paste this whole file into a fresh Claude Code session in `workspace/leasetrace` to start or resume the build.

---

## 0. Resume in 5 minutes

Read in this order before doing anything:
1. This file.
2. `docs/DECISIONS.md`: the design calls already made. Don't re-decide them.
3. `docs/PROGRESS.md`: the milestone checklist and the next unchecked item.

Run `npm run eval` to see the current scores, then continue from the next unchecked item.

## 1. What we're building and why

LeaseTrace (renamed from LegalTrace on 2026-10-28) checks a **Florida residential lease** against **Florida Statutes Chapter 83, Part II** (Residential Tenancies, ss. 83.40–83.683). It flags clauses that violate the statute or are void, cites the exact subsection, highlights the offending text, and suggests a fix.

**Its real job is to be the flagship AI piece in Justin's portfolio** (justin-scott.dev). It should show founders and clients that he can ship **production-grade AI**, not just a demo. Every choice should serve these four things, in order:
1. **A working demo in one click.** No signup, no waiting, no setup. A visitor clicks a sample lease and watches a full audit within seconds.
2. **A measured quality number.** A public evals page with precision and recall on a labeled set of leases and a fabricated-citation rate, plus a write-up of what failed and how it was fixed.
3. **Visible reasoning.** A live step-by-step trace, every finding tied to highlighted lease text, and every citation linked to the statute text.
4. **Production discipline.** Cost and latency per audit, model-failure fallback, refusing to answer outside the statute's scope, and no fabricated citations.

**Hard constraint: visitors must cost Justin $0.** The default demo path must make no paid API call per visitor. Any live path must either be paid for by the visitor or have a hard spending cap that can never go over (see Decision 1).

**Not legal advice.** Show this on every results screen and in the footer. The tool gives information, not representation.

### Why the v1 design is thrown out
v1 (2026-01, `justinscott12/legaltrace` @ 4f605fb) had these problems:
- It checked *commercial* leases against Part II sections, which apply only to residential tenancies. Part I (83.001–83.251) governs commercial leases and is mostly freedom of contract.
- Its critique agent was hardcoded to always pass.
- Its self-correction loop re-ran the analysis when the *lease* was bad, mixing up "the lease is non-compliant" with "the analysis is wrong."
- Its MCP integration was dead code.
- It had 11 seeded statutes, several unrelated to leases.
- It had no real evals.

v2 starts from scratch. Keep v1 on a `v1-legacy` branch and say so in the README. **Turn this history into the case study:** "v1 was wrong in a way that looked right; here's the eval that would have caught it."

## 2. How to work with Justin: teach mode is mandatory

Justin is learning system design. For every decision in section 4, and any other real design call that comes up mid-build:
1. Present 2–3 viable options neutrally, using AskUserQuestion. Give one line of context and each option's tradeoff. **Don't reveal your pick.**
2. After he picks, grade it **Right / Defensible / Wrong** for *this* project's constraints, explain every option (when each wins, what it costs, a real system that uses it), and stay under ~200 words.
3. Build his pick if it's Right or Defensible. If it's Wrong, say what you'll build instead.
4. Log it in `C:\Users\jscot\Documents\workspace\learning\decisions.md` *and* `docs/DECISIONS.md` using the format in his global CLAUDE.md, with consistent concept tags.

Batch 2–5 decisions per milestone. If he says "just decide" or "low energy", decide yourself for the rest of the session and still log the decisions.

Other working rules:
- He works in bursts. Update `docs/PROGRESS.md` at the end of every session so the next session can resume quickly.
- Commit or push only when he asks. Branch off main first.
- Never put API keys in the repo or the client bundle. He enters secrets himself.

## 3. Ground truth: the statute corpus

- **Source:** the official current text from the Florida Legislature (leg.state.fl.us, "Online Sunshine"), Chapter 83 Part II, in the **2026** edition. Write a script that fetches and normalizes it into `corpus/part2.json`, one entry per section with subsections keyed (e.g. `83.49(3)(a)`). Record the source URL, the retrieval date and the statute year.
- Corpus files are checked in; nothing is fetched at runtime.
- **Verify the rules in the statute, not from memory.** Several provisions were amended in 2023–2024 (for example notice periods and access notice). Every rule the checker uses must quote the subsection it comes from. If a rule can't be traced to a quote, it doesn't ship.
- Start with a focused rule set (about 12–20 rules) where clear violations are possible. For example:
  - security deposit holding and disclosure (83.49)
  - deposit return and claim deadlines (83.49(3))
  - nonpayment notice period and how days are counted (83.56(3))
  - prohibited or void provisions (83.47)
  - landlord access notice (83.53)
  - termination notice periods (83.57)
  - landlord maintenance duties that can't be waived (83.51)
  - retaliatory conduct (83.64)
  - prohibited practices (83.67)

  Expand the set only once evals are green on these.
- Mark anything the corpus doesn't cover as `out_of_scope`, never as a guess. For example: local ordinances, HOA rules, federal fair-housing law, and anything commercial.

## 4. Design decisions to run through teach mode (ask, don't assume)

**Milestone A (architecture), ask before writing app code:**
1. **Who pays for live runs.** Options:
   - (a) A static site with recorded replays of real audits for every sample, and "audit your own lease" running with the visitor's own Anthropic key in the browser (called directly with the SDK's browser-access option; verify the exact flag in the current SDK docs; the key is never stored or sent anywhere else).
   - (b) Recorded replays plus a small serverless proxy using Justin's key on a cheap model, with a hard cap: Console workspace spend limit, per-IP rate limit and max lease size. Cost is near-zero but not exactly zero.
   - (c) Recorded replays plus a small open model running in the browser (WebGPU), with weaker quality.
2. **Where compliance logic lives.** Options:
   - (a) The LLM reads the lease and statutes and judges violations directly.
   - (b) The LLM only *extracts structured facts* (deposit amount and holding method, notice days, access notice hours, waiver clauses…) with quoted spans, and **deterministic TypeScript rules** written from statute quotes decide violations.
   - (c) A hybrid: code rules for the bright-line provisions, the LLM for fuzzy ones (for example "does this clause waive the landlord's 83.51 duties?"), with each finding labeled by which path produced it.
3. **How statutes reach the model.** Options:
   - (a) The whole Part II corpus in a cached system prompt (it's small).
   - (b) Vector RAG over subsections.
   - (c) Per-rule, inject only the subsections each rule cites.

**Milestone B (quality), ask before building the evals:**

4. **How evals are graded.** Options:
   - (a) A hand-labeled golden set with exact matching on (rule ID, subsection, clause span overlap): precision and recall.
   - (b) An LLM judge with a rubric.
   - (c) Exact matching for findings, and a judge only for explanation and fix quality.
5. **How fabricated citations are prevented.** Options:
   - (a) The model can only cite from a closed list of subsection IDs (schema enum), checked in code.
   - (b) The Claude API citations feature on the statute documents. Note it can't be combined with `output_config.format`.
   - (c) A free-form answer followed by a validator that rejects any citation not in the corpus.

**Milestone C (input), ask when building upload:**

6. **Lease input.** Options:
   - (a) Paste text only.
   - (b) PDF or DOCX parsed in the browser (pdf.js / mammoth) into text with character offsets for highlighting.
   - (c) Send the PDF to the model as a document block.

Expect more calls to surface mid-build (failure and fallback behavior, how replays are recorded, the cache key strategy). Teach-mode them too.

## 5. Model and API facts (verify against current docs before coding)

- **Use the official Anthropic TypeScript SDK** (`@anthropic-ai/sdk`). Load the `claude-api` skill before writing any API code. Don't guess SDK shapes.
- **Models and prices as of 2026-10:** `claude-opus-5-5` ($4/$20 per 1M tokens in/out), `claude-sonnet-5-5` ($2/$10), `claude-haiku-5-5` ($0.10/$0.50).
  - Recording replays and offline eval runs happen once, on Justin's key, so the strongest model is affordable there.
  - Any live path should be benchmarked on the eval set at each model and effort level. Pick the cheapest one that holds quality, and **publish that comparison on the evals page.** It's great portfolio material.
- **Use structured outputs** (`output_config.format`) for extraction. Assistant prefill and forced `tool_choice` return 400 on current models.
- **Prompt caching:** keep the statute corpus and instructions as a stable prefix, put the lease after the cache breakpoint, and check `usage.cache_read_input_tokens`.
- **Handle the `refusal` stop reason, timeouts and 429s:** show a clear error and never a fabricated result.
- **Log per-audit cost** (tokens × price) and latency. Show both in the UI and the replays.

## 6. Product spec

**Pages (static, deployable to GitHub Pages or Netlify free tier):**
- `/`: the hero, a one-line pitch, 4–6 sample lease cards ("Clean lease", "Illegal deposit terms", "3-day notice counted wrong", "Waives repair duties", "Mixed bag") and an "Audit your own lease" button (depending on Decision 1).
- `/audit`:
  - Left: the lease text, with findings highlighted by severity.
  - Right: findings, each with the problem in plain English, the statute subsection (clicking it shows the quoted statute text), the offending lease text and a suggested replacement clause.
  - Top: a short summary ("4 violations, 2 void provisions, 1 out of scope"). **No 0–1 "compliance score"**; it was meaningless in v1.
  - A side panel with the live trace (each step, timing, tokens, cost, which path produced each finding: code rule or LLM).
- `/evals`:
  - Precision, recall and fabricated-citation rate per rule.
  - The model/effort cost-quality table.
  - A failure gallery (cases it got wrong and why).
  - The v1→v2 story.
  - Generated from `evals/results/*.json`.
- `/how-it-works`: an architecture diagram, the decisions made and why (pulled from `docs/DECISIONS.md`), and the limits.

**Replays:** an offline script runs the real pipeline on each sample lease and records every step event with timestamps, the full outputs, tokens and cost into `public/replays/*.json`. The UI replays them at real speed with a "skip" button, labeled clearly: "Recorded run from <date> on <model>." Replays must come from real runs, never be hand-written.

**Golden set (`evals/leases/`):**
- 20–30 **fictional** Florida residential leases, written for this project. Vary the length, formatting and wording, include tricky near-misses (compliant clauses that look like violations), and add a few real-world-style messy ones.
- Each lease gets `*.labels.json` with expected findings (rule ID, subsection, character span, severity), plus expected `out_of_scope` items.
- **Justin reviews and approves the labels.** That's both a quality gate and a learning exercise.
- Split into dev and held-out test sets. The headline numbers come from the test set only.

**Evals:** `npm run eval [--model X --effort Y]` runs the pipeline over the set and writes results JSON. It should print a per-rule table and the total cost of the run. Any change to prompts, rules or models must show its eval delta in `docs/PROGRESS.md`.

## 7. Engineering bar

- TypeScript strict everywhere. Unit tests for every deterministic rule, using statute-quoted fixtures. Eval runs are separate from unit tests because evals cost money.
- Every finding needs a valid lease span and a valid corpus subsection ID. Validate both in code before rendering, and drop anything invalid with a logged reason.
- Accessibility basics, works at phone width, light and dark themes, and fast first load (replays are small JSON).
- The README answers in 60 seconds what it is, gives the live link, the eval headline and the architecture diagram, and explains how to run it locally (`npm i && npm run dev`, with replays working without any key).
- No Justin PII beyond a portfolio link. No analytics that track lease content. User-uploaded leases never leave the browser except in the direct call to the model provider (when the visitor uses their own key) or the capped proxy. Say exactly which in the UI.

## 8. Milestones (track in `docs/PROGRESS.md`)

- **A. Foundations:**
  - Teach-mode Decisions 1–3.
  - Repo scaffold.
  - The corpus fetch script and `corpus/part2.json`.
  - The rule set written from statute quotes, with unit tests.
- **B. Pipeline and evals:**
  - The extraction and checking pipeline.
  - Teach-mode Decisions 4–5.
  - The golden set (Justin approves the labels).
  - `npm run eval`.
  - First honest scores. Iterate until test-set recall ≥ 0.9 and fabricated citations = 0, or document why not.
- **C. Demo UI:**
  - Teach-mode Decision 6.
  - Recorded replays.
  - The audit view with highlights and trace.
  - The evals page.
  - The how-it-works page.
  - Deploy.
- **D. Portfolio launch:**
  - Update the LegalTrace card (rename it to LeaseTrace) in `portfolio/lib/prototypes.ts`: fix the description to say *residential*, link the live demo and the evals headline, and update the stack.
  - Write a short case-study post (v1 failure → evals → v2).
  - A 30-second screen recording or GIF for the README and the portfolio.

**Done means:** a stranger clicks the portfolio card, watches a sample audit finish in under 10 seconds, sees a real eval number, and Justin's bill doesn't move.
