import type { Severity } from "../../rules/types.js";
import { pct, useJson, usd } from "../data.js";
import { SAMPLES } from "../samples.js";
import { type Replay, SEVERITIES } from "../types.js";
import type { EvalsData } from "./EvalsPage.js";

/** The hero: a lease excerpt being marked up, which is what the product does. */
function HeroPaper() {
  const hl = (sev: Severity, d: number, text: string) => (
    <mark className={`hl ${sev}`} style={{ "--d": `${d}ms` } as React.CSSProperties}>
      {text}
    </mark>
  );
  const note = (d: number, text: string) => (
    <span className="margin-note" style={{ "--d": `${d}ms` } as React.CSSProperties}>
      {text}
    </span>
  );
  return (
    <div className="paper hero-paper" aria-label="Example: a marked-up lease excerpt">
      <span className="clause-no">4. Deposit. </span>
      {hl("violation", 300, "Landlord may keep the security deposit in its general operating account")}
      {" and will return it "}
      {hl("void", 900, "within 30 days")}
      {" after Tenant moves out."}
      {note(1300, "Violation: s. 83.49(1) requires a separate account or a surety bond. Void: s. 83.49(3)(a) allows 15 days when there’s no claim.")}
      <span className="clause-no">9. Entry. </span>
      {"Landlord may enter to make repairs with 24 hours' notice between 8:00 a.m. and 7:00 p.m."}
      {note(1600, "Fine: within the notice and hours s. 83.53(2) requires.")}
      <span className="clause-no">12. Default. </span>
      {"If rent is late, Landlord may give a "}
      {hl("void", 1900, "3-day notice counting weekends and holidays")}
      {"."}
      {note(2300, "Void: s. 83.56(3) excludes Saturdays, Sundays and legal holidays.")}
      <span className="margin-note faint" style={{ "--d": "2600ms" } as React.CSSProperties}>
        Illustration. The samples below are real recorded runs.
      </span>
    </div>
  );
}

function Counts({ id }: { id: string }) {
  const { data } = useJson<Replay>(`replays/${id}.json`);
  if (!data) return <span className="s-counts" />;
  if (data.scope === "not_residential") return <span className="s-counts">Not residential</span>;
  if (!data.findings.length) return <span className="s-counts">No problems found</span>;
  return (
    <span className="s-counts" aria-label={`${data.findings.length} findings`}>
      {SEVERITIES.flatMap((s) => data.findings.filter((f) => f.severity === s).map((_, i) => <i key={`${s}${i}`} className={`swatch ${s}`} aria-hidden="true" />))}
      <span>{data.findings.length} found</span>
    </span>
  );
}

export function HomePage() {
  const { data: evals } = useJson<EvalsData>("data/evals.json");
  const head = evals?.configs.find((c) => c.model === evals.headline.model && c.effort === evals.headline.effort);
  const test = head?.test?.totals.test;
  const hard = head?.hard?.totals.test;
  return (
    <>
      <section className="wrap hero">
        <div>
          <h1>Check a Florida lease against the law, clause by clause.</h1>
          <p className="lede">
            LeaseTrace reads a residential lease, marks every clause that conflicts with Florida's landlord-tenant statute, and shows
            the exact statute text behind each mark.
          </p>
          <div className="btn-row">
            <a className="btn" href="#/audit/mixed">
              Watch a recorded audit
            </a>
            <a className="btn secondary" href="#/live">
              Check your own lease
            </a>
          </div>
        </div>
        <HeroPaper />
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Sample leases</h2>
          <p className="section-intro">
            Each one is a real recorded run of the full pipeline on a fictional lease. Replays cost nothing to watch.
          </p>
          <ul className="samples">
            {SAMPLES.map((s) => (
              <li key={s.id}>
                <a href={`#/audit/${s.id}`}>
                  <span className="s-title">{s.title}</span>
                  <span className="s-blurb">{s.blurb}</span>
                  <Counts id={s.id} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Why trust the marks</h2>
          <p className="section-intro">The model never decides what's legal. It reads the lease; code written from the statute decides.</p>
          <div className="proof">
            <p>
              <strong>Measured, not claimed</strong>
              {test && hard
                ? `On held-out test leases it found ${pct(test.recall)} of the labeled problems with ${pct(test.precision)} precision, and ${pct(hard.recall)} on the long, messy ones. `
                : "Precision and recall on a labeled set of leases, including a held-out set. "}
              <a href="#/evals">See the evals</a>.
            </p>
            <p>
              <strong>No invented law</strong>
              The model can't cite anything. Every citation is fixed in code and checked against the 2026 statute text
              {test ? `; ${pct(test.fabricatedCitationRate)} fabricated citations across ${test.runs} test runs` : ""}.
            </p>
            <p>
              <strong>Every mark has a source</strong>
              Each finding points to the lease words that triggered it and the statute subsection it comes from, quoted.
            </p>
            <p>
              <strong>Costs a few cents</strong>
              {head ? `About ${usd(head.test?.cost.perRunUsd ?? head.basic?.cost.perRunUsd ?? null)} per audit on Claude Opus 5.5, ` : ""}
              paid by your own API key if you check your own lease. Watching samples is free.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
