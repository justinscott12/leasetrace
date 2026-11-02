// Generated from evals/results/*.json via scripts/build-site-data.ts: every number
// here is a stored run re-scored with the current rules and labels.
import type { Report } from "../../evals/report.js";
import { pct, secs, useJson, usd } from "../data.js";
import { SEVERITY_LABEL } from "../types.js";

type Slim = Pick<Report, "totals" | "rules" | "cost">;
interface Config {
  model: string;
  effort: string;
  promptSha: string | null;
  currentPrompt: boolean;
  files: string[];
  labelsApproved: boolean;
  basic: Slim | null;
  hard: Slim | null;
  test: Slim | null;
}
interface GalleryItem {
  id: string;
  split: "dev" | "test";
  hard: boolean;
  summary: string;
  runs: number;
  missed: { ruleId: string; severity: string; note: string; quote: string | null; runs: number }[];
  falsePositives: { ruleId: string; severity: string; quote: string | null; nearMiss: string | null; runs: number }[];
  wrongSeverity: { ruleId: string; expected: string; got: string; quote: string | null; runs: number }[];
}
type Counts = { cases: number; labels: number; nearMisses: number };
export interface EvalsData {
  generatedAt: string;
  headline: { model: string; effort: string; promptSha: string | null; currentPrompt: boolean };
  currentPrompt: string;
  labelsApproved: boolean;
  set: { basic: { dev: Counts; test: Counts }; hard: { dev: Counts; test: Counts } };
  configs: Config[];
  gallery: GalleryItem[];
}

/** Why each remaining failure happens, written after reading the stored runs. */
const EXPLAIN: Record<string, string> = {
  "hard-07-duplex-month-to-month":
    "The lease sets a deadline (“by the 15th, effective at the end of that month”) instead of a number of days. In every run the model worked out that this means about 13 to 16 days, but the notice fact holds a single number, so it reported the term as unclear and the rule asked for review instead of calling it void. The fix (report the shortest notice a deadline allows) is easy, but this is a held-out lease, so it stays unfixed here: tuning on test leases would make this number meaningless.",
};

const sevWord = (s: string) => SEVERITY_LABEL[s as keyof typeof SEVERITY_LABEL]?.one ?? s;

function Gallery({ items }: { items: GalleryItem[] }) {
  if (!items.length) return <p className="muted">No errors in the current runs: every labeled problem was found, with no false alarms.</p>;
  return (
    <div className="gallery">
      {items.map((g) => (
        <article key={g.id}>
          <h3>
            {g.id} <span className="faint">({g.hard ? "hard set" : "first set"}, {g.split}, {g.runs} runs)</span>
          </h3>
          <p className="muted" style={{ marginTop: 6 }}>{g.summary}</p>
          {EXPLAIN[g.id] && <p style={{ marginTop: 10 }}>{EXPLAIN[g.id]}</p>}
          <ul>
            {g.missed.map((m, i) => (
              <li key={`m${i}`}>
                Missed {m.ruleId} ({sevWord(m.severity)}) in {m.runs} of {g.runs} runs: {m.note}
                {m.quote && <span className="quote" style={{ display: "block", fontFamily: "var(--serif)" }}>“{m.quote}”</span>}
              </li>
            ))}
            {g.wrongSeverity.map((w, i) => (
              <li key={`w${i}`}>
                Found {w.ruleId} but called it {sevWord(w.got)} instead of {sevWord(w.expected)} ({w.runs} of {g.runs} runs)
              </li>
            ))}
            {g.falsePositives.map((f, i) => (
              <li key={`f${i}`}>
                False alarm: {f.ruleId} ({sevWord(f.severity)}) in {f.runs} of {g.runs} runs
                {f.nearMiss ? `, on a clause built to look like a problem: ${f.nearMiss}` : ""}
                {f.quote && <span style={{ display: "block", fontFamily: "var(--serif)" }}>“{f.quote}”</span>}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

export function EvalsPage() {
  const { data, error } = useJson<EvalsData>("data/evals.json");
  if (error) return <div className="wrap section"><p className="error">The eval data couldn't be loaded ({error}).</p></div>;
  if (!data) return <div className="wrap section"><p className="muted">Loading…</p></div>;
  const head = data.configs.find(
    (c) => c.model === data.headline.model && c.effort === data.headline.effort && c.promptSha === data.headline.promptSha,
  )!;
  const t = head.test?.totals.test;
  const basicT = head.basic?.totals.test;
  const hardT = head.hard?.totals.test;
  // One row per model + effort: the newest prompt version that has test runs.
  const rank = (c: Config) => (c.currentPrompt ? 2 : c.promptSha ? 1 : 0);
  const sweep = [...new Map(
    data.configs
      .filter((c) => c.test)
      .sort((a, b) => rank(a) - rank(b))
      .map((c) => [`${c.model}|${c.effort}`, c] as const),
  ).values()]
    .map((c) => ({ c, t: c.test!.totals.test, cost: c.test!.cost }))
    .sort((a, b) => (a.cost.perRunUsd ?? 0) - (b.cost.perRunUsd ?? 0));
  const rules = (head.test?.rules.test ?? []).filter((r) => r.strict.tp + r.strict.fp + r.strict.fn > 0);
  const s = data.set;

  return (
    <div className="wrap">
      <section className="section prose">
        <h1>How well it works</h1>
        <p className="muted">
          Measured on a labeled set of fictional Florida leases. The model was tuned only on the development leases; the numbers below
          come from held-out test leases it was never tuned on. Strict scoring: a finding counts only if it names the right rule, the
          right statute subsection, overlaps the right clause, and has the right severity.
          {!data.labelsApproved && " The labels are still awaiting final human review."}
        </p>
      </section>

      {t && (
        <div className="numbers">
          <div>
            <div className="headline-num">{pct(t.recall)}</div>
            <p>recall on {s.basic.test.cases + s.hard.test.cases} held-out leases ({t.strict.tp} of {t.strict.tp + t.strict.fn} labeled findings across {t.runs} runs)</p>
          </div>
          <div>
            <div className="headline-num">{pct(t.precision)}</div>
            <p>precision: {t.strict.fp} false alarm{t.strict.fp === 1 ? "" : "s"} across {t.runs} runs, with {s.basic.test.nearMisses + s.hard.test.nearMisses} look-alike clauses in the test leases</p>
          </div>
          <div>
            <div className="headline-num">{pct(t.fabricatedCitationRate)}</div>
            <p>fabricated citations. The model can't cite; citations are fixed in code and checked against the statute</p>
          </div>
          <div>
            <div className="headline-num">{usd(head.test?.cost.perRunUsd ?? null)}</div>
            <p>per audit on {head.model}, {head.effort} effort; median {secs(head.test?.cost.latencyP50Ms)}</p>
          </div>
        </div>
      )}

      <section className="section">
        <h2>By lease set</h2>
        <p className="section-intro">
          The first set ({s.basic.dev.cases + s.basic.test.cases} leases) has short leases with one problem per clause. The hard set (
          {s.hard.dev.cases + s.hard.test.cases} leases, 7–16K characters) buries problems in boilerplate, inside lists and behind
          “unless required by law”.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Test leases</th>
                <th className="num">Leases</th>
                <th className="num">Runs</th>
                <th className="num">Recall</th>
                <th className="num">Precision</th>
                <th className="num">Lenient recall</th>
                <th className="num">Quotes not found</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["First set", s.basic.test.cases, basicT],
                ["Hard set", s.hard.test.cases, hardT],
              ].map(([name, cases, x]) =>
                x && typeof x === "object" ? (
                  <tr key={name as string}>
                    <td>{name as string}</td>
                    <td className="num">{cases as number}</td>
                    <td className="num">{x.runs}</td>
                    <td className="num">{pct(x.recall, 1)}</td>
                    <td className="num">{pct(x.precision, 1)}</td>
                    <td className="num">{pct(x.lenientRecall, 1)}</td>
                    <td className="num">{pct(x.unlocatedQuoteRate, 1)}</td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Cost and quality by model</h2>
        <p className="section-intro">
          The same held-out leases, run on cheaper models and lower effort. Replays and the default for checking your own lease use{" "}
          {data.headline.model}, {data.headline.effort} effort.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Effort</th>
                <th className="num">Recall</th>
                <th className="num">Precision</th>
                <th className="num">Cost per audit</th>
                <th className="num">Median time</th>
                <th className="num">Runs</th>
              </tr>
            </thead>
            <tbody>
              {sweep.map(({ c, t, cost }) => (
                <tr key={`${c.model}${c.effort}`} className={c === head ? "picked" : ""}>
                  <td>
                    {c.model}
                    {!c.currentPrompt && <span title="Includes runs from before the final prompt change"> *</span>}
                  </td>
                  <td>{c.effort}</td>
                  <td className="num">{pct(t.recall, 1)}</td>
                  <td className="num">{pct(t.precision, 1)}</td>
                  <td className="num">{usd(cost.perRunUsd, 3)}</td>
                  <td className="num">{secs(cost.latencyP50Ms)}</td>
                  <td className="num">{t.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sweep.some(({ c }) => !c.currentPrompt) && (
          <p className="faint" style={{ marginTop: 10 }}>
            * Includes runs made before the last prompt change, which narrowed one fact's definition. With two runs per lease, a
            difference of one or two findings between rows is within run-to-run noise.
          </p>
        )}
      </section>

      <section className="section">
        <h2>By rule</h2>
        <p className="section-intro">
          Held-out leases, {head.model}. Counts are summed over every run. A finding with the wrong severity counts as both a miss and a
          false alarm.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rule</th>
                <th className="num">Found</th>
                <th className="num">Missed</th>
                <th className="num">False alarms</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.ruleId}>
                  <td>{r.ruleId}</td>
                  <td className="num">{r.strict.tp}</td>
                  <td className="num">{r.strict.fn}</td>
                  <td className="num">{r.strict.fp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>What it got wrong</h2>
        <p className="section-intro">Every miss, false alarm and wrong severity in the current runs of {head.model}, on development and test leases.</p>
        <Gallery items={data.gallery} />
      </section>

      <section className="section prose">
        <h2>Errors found and fixed along the way</h2>
        <p>
          <b>One finding per topic dropped clauses.</b> On a real 79,000-character lease, the first version gave each topic one slot.
          Leases often have several clauses on one topic, so the model picked one, and which one changed from run to run. Each topic now
          holds every matching clause, and the rules check each.
        </p>
        <p>
          <b>A fixed-term lease that renews month to month.</b> The first eval run missed a 10-day termination notice in a lease that
          rolls over month to month. The model had extracted it correctly; the rule skipped every fixed-term lease. Fixed in the rule and
          re-scored for free from the stored run.
        </p>
        <p>
          <b>One clause, two findings.</b> On a long tuning lease, “Landlord has no obligation to make repairs” was flagged as a
          maintenance waiver, which is right, and in two of three runs also as a limit on liability. The prompt defined a liability
          limit to include being “excused from its obligations”, so the model was following instructions. The definition now leaves
          repair duties to the maintenance rule; the tuning leases went from 95.5% to 100% precision.
        </p>
        <p>
          <b>A name without an address.</b> When a lease named the manager but gave no address, the model correctly called the address
          unclear, and the rule softened that to “needs review”. A disclosure that isn't clear hasn't been made, so it's now reported as
          missing.
        </p>
        <h2>Version 1</h2>
        <p>
          LeaseTrace started as LegalTrace, and version 1 was wrong in ways that looked right. It checked commercial leases against
          Part II, which only governs residential tenancies. Its critique step was hard-coded to pass, its self-correction loop re-ran
          the analysis whenever the lease was bad (confusing “this lease breaks the law” with “this analysis is wrong”), and several of
          its 11 seeded statutes had nothing to do with leases. It had no evals, so none of this showed. Version 2 is built around the
          eval that would have caught it: the model only extracts facts with quotes, code applies the statute, and every change is
          scored against labeled leases.
        </p>
        <h2>Limits of these numbers</h2>
        <p>
          The leases were written for this project alongside the rules, so they test whether the system applies its
          rules reliably more than whether it handles every lease a landlord might write. The hard set was added after the first set
          scored perfectly, to make the test harder. The rules cover 18 provisions of Part II; the law has more.
        </p>
        <p className="faint">
          Data generated {new Date(data.generatedAt).toLocaleString()} from {head.files.length} result files in{" "}
          <a href="https://github.com/justinscott12/leasetrace/tree/main/evals/results">evals/results</a>.
        </p>
      </section>
    </div>
  );
}
