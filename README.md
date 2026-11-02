# LeaseTrace

Checks a **Florida residential lease** against Chapter 83, Part II of the 2026 Florida Statutes. It marks every clause that
conflicts with the statute, says why in plain English, shows the statute text it comes from, and suggests replacement wording.

**[Try it: justinscott12.github.io/leasetrace](https://justinscott12.github.io/leasetrace/)**: sample audits replay for
free; checking your own lease uses your own Anthropic API key, straight from your browser.

**Not legal advice.** LeaseTrace gives information, not representation.

## How well it works

On 13 held-out leases (39 runs, Claude Opus 5.5, medium effort), scored strictly (right rule, right subsection, right clause,
right severity):

| Held-out leases | Recall | Precision |
|---|---|---|
| First set: 9 short leases | 100% | 100% |
| Hard set: 4 long leases with problems buried in boilerplate | 92.9% | 92.9% |
| **All** | **97.0%** | **97.0%** |

**0 fabricated citations** (the model can't cite; see below). About **$0.07 and 20 seconds per audit**. The one remaining
failure, the model-by-model cost table and every number's source are on the [evals page](https://justinscott12.github.io/leasetrace/#/evals),
generated from the stored runs in [`evals/results/`](evals/results).

## How it works

```
lease text ─▶ Claude: 21 facts, each with a quote ─▶ find each quote in the lease ─▶ 18 rules in TypeScript ─▶ validate ─▶ findings
              (structured output; the statute is      (exact → normalized →           (each written from      (citation exists?
               a cached prompt prefix)                 strict fuzzy; else "unclear")   a quoted subsection)    span matches lease?)
```

- **The model reads; code decides.** Claude only extracts facts (deposit handling, notice periods, entry rules, waiver
  clauses…) with a verbatim quote for each. Deterministic rules in [`src/rules/rules.ts`](src/rules/rules.ts) decide what's
  a problem. Each rule quotes the subsection it comes from, and [`tests/corpus.test.ts`](tests/corpus.test.ts) checks every quote
  against the official text in [`corpus/part2.json`](corpus/part2.json).
- **No invented law.** Citations are constants in code. Before anything is shown, findings whose citation isn't in the corpus
  or whose quote doesn't match the lease text are dropped, with a logged reason.
- **Silence isn't compliance.** Each fact is present, absent, or unclear. Unclear terms become "needs review", not a guess.
- **Out of scope stays out.** Commercial leases get no findings. Late-fee amounts, HOA rules and similar clauses are listed as
  not checked.
- **Measured.** A golden set of 30 fictional leases ([`evals/leases`](evals/leases), [`evals/hard`](evals/hard)) with
  hand-written labels, split into tuning and held-out leases. `npm run eval` scores precision and recall, and stored extractions
  can be re-scored for free when a rule changes (`--rescore`).

Every design decision, with the alternatives considered, is in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Run it locally

```
npm i
npm run dev        # the site, with recorded replays; no API key needed
npm test           # 135 unit tests, no network
```

With an `ANTHROPIC_API_KEY` in `.env` (costs money):

```
npm run eval -- --dry                      # list the golden set and estimate cost
npm run eval -- --split test --runs 3      # held-out leases, 3 runs each
npm run replays:record                     # re-record the sample audits
npm run site:data                          # rebuild the evals page data ($0)
```

## History

Version 1 (LegalTrace, January 2026) asked an agent pipeline to judge commercial leases against residential-only statutes,
with a critique step hard-coded to pass and no evals. It looked right and wasn't. It's kept on the
[`v1-legacy`](https://github.com/justinscott12/leasetrace/tree/v1-legacy) branch. Version 2 started from scratch around the eval
that would have caught it.

Built by [Justin Scott](https://justin-scott.dev).
