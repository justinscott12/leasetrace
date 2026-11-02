# Design decisions

The project was renamed from LegalTrace to LeaseTrace on 2026-10-28.

Made in teach mode. Don't re-decide these without a new entry. Also logged in `workspace/learning/decisions.md`.

## 2026-10-28 · leasetrace · Decision 1: who pays for live runs
- Context: flagship portfolio demo with a hard rule that visitors cost $0; sample audits are recorded replays regardless.
- Options: A) visitor's own Anthropic key called from the browser B) serverless proxy on Justin's key with spend cap + per-IP rate limit C) small open model in-browser via WebGPU
- Justin picked: A — Verdict: Right
- Why: only option that is exactly $0 and needs no backend to defend; replays carry the one-click demo, so low BYOK uptake is fine. B fits when conversion matters more than the bill; C fits when privacy is the product, not accuracy.
- Concept tags: cost-model, BYOK, static-hosting, attack-surface, abuse-prevention
- **Built:** static site; replays for samples; "audit your own lease" calls the API from the browser with the visitor's key (verify the SDK's browser flag in current docs at build time). The key is never stored or sent anywhere else.

## 2026-10-28 · leasetrace · Decision 2: where compliance logic lives
- Context: v1 let the LLM judge violations and was wrong in ways that looked right; v2 needs testable, citation-safe verdicts.
- Options: A) LLM judges violations directly B) LLM extracts structured facts with quoted spans, deterministic TS rules decide C) hybrid code rules + LLM for fuzzy provisions, labeled by path
- Justin picked: B — Verdict: Right
- Why: verdicts become unit-testable against statute quotes and citations are emitted by code, so they can't be fabricated. Caveat: fuzzy facts (e.g. "waives 83.51 duties") are still LLM judgments inside a boolean, so evals must measure per-fact extraction. C is the natural next step once bright-line rules are solid.
- Concept tags: deterministic-core, llm-as-extractor, separation-of-concerns, testability, auditability, structured-output
- **Built:** `src/facts/schema.ts` (what the LLM fills), `src/rules/` (what decides). Every finding has `path: "code_rule"`.

## 2026-10-28 · leasetrace · Decision 2b: what a rule outputs when the lease is silent
- Context: many topics are simply not mentioned; some statute provisions are defaults, others are required disclosures.
- Options: A) silence = no finding B) silence = violation C) per-fact tri-state (present / absent / unclear), each rule declares whether absence is fine or a "not addressed" gap
- Justin picked: C — Verdict: Right
- Why: mirrors the statute — most of Part II supplies defaults that apply regardless of the lease, while 83.49(2)/83.50 require disclosure; "unclear" stops the extractor from guessing. A misses required disclosures; B buries clean leases in false positives.
- Concept tags: tri-state-logic, null-semantics, defaults-vs-requirements, precision-recall, fail-loud
- **Built:** `Fact<T>` = present | absent | unclear. Unclear → `review` finding; required-disclosure absence → `notice`.

## 2026-10-28 · leasetrace · Decision 3: how statutes reach the model
- Context: the corpus is ~21K tokens and fixed; after Decision 2 the model only extracts facts.
- Options: A) whole corpus in a cached system prompt B) vector RAG over subsections C) per-rule injection of only the cited subsections
- Justin picked: B — Verdict: Wrong
- Why: RAG pays off when the corpus exceeds context; this one fits, so RAG only adds an embedding pipeline to a static $0 site and a retrieval-miss failure mode. C suits many independent checklist checks.
- Concept tags: RAG, context-window, prompt-caching, retrieval-recall, YAGNI
- **Built instead:** A. Stable prefix = instructions + fact schema + full Part II corpus, cache breakpoint, then the lease. Check `usage.cache_read_input_tokens`.

## 2026-10-28 · leasetrace · How extracted facts get lease spans
- Context: every finding must highlight exact lease text; leases are 5–20 pages.
- Options: A) model returns character offsets B) model returns verbatim quote, code locates it C) code pre-splits into numbered clauses, model cites IDs
- Justin picked: B — Verdict: Right
- Why: models are unreliable at counting characters but good at reproducing text; indexOf makes a real quote's offsets exact (Claude's Citations feature computes char_location server-side the same way). A only fits short inputs; C gives clause-sized highlights and a fragile splitter.
- Concept tags: grounding, span-alignment, structured-output, validation, quote-then-locate
- **Built:** `src/facts/locate.ts`.

## 2026-10-28 · leasetrace · What happens when a quote doesn't match the lease
- Context: the model's quote may differ from the lease by whitespace, curly quotes or light paraphrase.
- Options: A) fact becomes "unclear" B) fuzzy-match above a similarity threshold C) retry the extraction asking for verbatim quotes
- Justin picked: B — Verdict: Defensible, but…
- Why: recovering near-misses is worth it, but a loose threshold can confidently highlight the wrong clause (v1's failure mode). C fits batch pipelines where an extra call is cheap.
- Concept tags: fuzzy-matching, thresholds, fail-closed-vs-fail-open, precision-recall, observability
- **Built:** tiers — exact → normalized exact (whitespace, quotes, dashes, case) → fuzzy on word-level edit distance (bigram pre-filter), only a unique best window ≥ 0.9 beating the runner-up by 0.05 → else `unclear`. Every locate method is logged in the trace for evals. Note: a first version scored fuzzy windows with character bigrams; a unit test caught it matching a window that straddled two similar sentences, because bigrams ignore word order.

## 2026-11-01 · leasetrace · Fitting the fact schema inside structured-output limits (teach mode off)
- Context: first live call → 400 "more than 16 union-typed parameters", then 400 "compiled grammar is too large". Bisected with 1-token probes: 12 typed fact objects compile, 16 don't; flattening doesn't help.
- Options: A) sentinel values instead of nulls B) generic fact list with per-fact values validated in code C) split facts across calls
- Decided: B (A was tried first; it fixed the union limit but not grammar size).
- Why: the enforced grammar stays constant as facts grow, and nulls come back. Value types are checked locally (`VALUE_SCHEMAS` in `src/facts/wire.ts`); a missing, duplicated-and-conflicting, or invalid fact becomes `unclear` and is listed in `problems` in the trace. C multiplies lease input tokens per audit.
- Concept tags: constrained-decoding, schema-design, api-limits, validation, fail-loud, bisection
- **Guard:** `tests/pipeline.test.ts` fails if any union appears in the schema or it grows past 3,000 chars.

## 2026-11-01 · leasetrace · Multi-instance clause facts (teach mode off)
- Context: the real-lease re-runs showed clause-type facts dropping clauses: one slot per fact made the model choose among several matching clauses, and its choice varied between runs.
- Options: A) one slot, model picks the worst clause B) clause facts are lists of instances, rules check each C) facts per clause location without topic grouping
- Decided: B.
- Why: A pushes severity judgment into the model (against Decision 2) and still hides clauses. Single-valued facts (notice days, deposit amount) keep one slot: two different answers there are a contradiction, so they stay `unclear`.
- Concept tags: data-modeling, cardinality, one-to-many, nondeterminism, separation-of-concerns
- **Built:** `Clauses<T>` / `CLAUSE_FACTS` in `src/facts/schema.ts`; the mapper turns each non-absent entry into an instance and merges same-span duplicates; the clause rules use `flatMap` over instances. The prompt marks "(clause fact)" and asks for one entry per distinct clause. Same change also: repair-entry window no longer re-reports the no-notice branch (that double-count lived in two rules), and the maintenance-waiver definition now says outright that reimbursing tenant-caused damage is never a waiver.

## 2026-11-01 · leasetrace · Decision 4: how evals are graded (teach mode off)
- Context: need precision/recall on a golden set that can run repeatedly and be re-scored for free when rules change.
- Options: A) hand-labeled golden set, exact matching on (rule ID, subsection, span overlap) B) LLM judge with a rubric C) exact matching for findings plus a judge for explanation/fix quality
- Decided: A, with severity scored strictly.
- Why: after Decision 2 the model never writes a finding: rule ID, citation, severity, problem text and fix all come from code, so there is no free text for a judge to grade and C collapses to A. A judge (B) would add cost, its own variance and a second model to trust. A is deterministic, so a results file can be re-scored at $0.
- Concept tags: evaluation, precision-recall, golden-set, deterministic-grading, llm-as-judge, held-out-test-set
- **Built:** labels name the expected clause by quote (resolved to a span at load, must be unique), not hand-counted offsets. A predicted finding matches an expected one on rule ID + citation + any span overlap (spanless expected findings, like a missing disclosure, match on rule + citation). Headline numbers are *strict*: a matched finding with the wrong severity counts as a miss and a false positive; *lenient* numbers are reported beside them. Labels can mark a finding `optional` (genuinely arguable; neither rewarded nor penalized). Each lease runs N times; the report gives per-finding hit rate and run-to-run agreement. Results store the extracted facts, so `--rescore` re-runs current rules on old extractions without an API call. dev/test split: prompts are tuned on dev only; test numbers are the ones published.

## 2026-11-01 · leasetrace · Decision 5: how fabricated citations are prevented (teach mode off)
- Context: v1 cited statute text that wasn't there. The model must not be able to invent a subsection.
- Options: A) the model may only cite from a closed list of subsection IDs (schema enum), checked in code B) Claude API citations on the statute documents (can't combine with structured outputs) C) free-form answer, then a validator rejects citations not in the corpus
- Decided: stronger than A: the model emits no citations at all.
- Why: citations are constants in rule code (Decision 2). `tests/corpus.test.ts` checks every rule's quote against the corpus, and `runRules` drops any finding whose citation isn't in the corpus or whose span doesn't match the lease, with a logged reason. B would need a second call and still leaves the model choosing what to cite; C catches a fake ID only after it's generated and still lets the model pick the wrong real one. The remaining risk moves to the lease side (a quote that isn't in the lease), which the locator handles: an unfound quote makes the fact `unclear`.
- Concept tags: hallucination, constrained-generation, closed-vocabulary, defense-in-depth, validation
- **Measured anyway:** the eval reports fabricated-citation rate (findings whose citation isn't in the corpus, before dropping) and unlocated-quote rate per run, so the claim is a number, not an argument.

## 2026-11-02 · leasetrace · Two rule fixes from the first eval run (teach mode off)
- Context: first dev pass missed 2 of 33 findings; both extractions were correct and the rules mis-handled them.
- Decided: (1) a fixed term that renews month-to-month has its renewal notice checked against 83.57(3) (the fact was
  already defined that way in the prompt; the rule ignored it). (2) An unclear landlord notice address is a `notice` gap,
  not `review`: a disclosure duty is only met by a clear disclosure.
- Why: both fixes follow the statute's text, not the eval's labels. Verified free with `--rescore` on the stored extractions,
  which is exactly what Decision 4's "store the facts" was for.
- Concept tags: eval-driven-development, regression-testing, offline-replay, overfitting-risk

## 2026-11-02 · leasetrace · Decision 6: how a visitor's lease gets in (teach mode off)
- Context: "check your own lease" needs text the model reads and character offsets the highlights point into; most real leases arrive as PDFs.
- Options: A) paste text only B) PDF/DOCX parsed in the browser into text C) send the PDF to the model as a document block
- Decided: B for PDF (pdf.js, lazy-loaded) and .txt, plus paste; DOCX left out for now.
- Why: the extracted text is exactly what the model sees and what highlights index into, so spans line up and the lease never leaves the browser except in the direct API call. C would make the model read a layout we can't map back to offsets. A alone fails most visitors, who have a PDF. Scans without a text layer are detected (almost no text) and the page asks for pasted text instead of guessing.
- Concept tags: input-handling, client-side-parsing, offsets, privacy, progressive-enhancement
