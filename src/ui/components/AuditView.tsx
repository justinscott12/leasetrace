// The audit result: summary, the marked-up lease, findings with statute quotes,
// out-of-scope items and run stats. Used for recorded replays and live runs alike.
import { useMemo, useRef, useState } from "react";
import type { Finding, Severity } from "../../rules/types.js";
import { secs, useJson, usd } from "../data.js";
import { type Replay, SEVERITIES, SEVERITY_LABEL, type StatuteData } from "../types.js";
import { LeaseDoc } from "./LeaseDoc.js";

export function Summary({ findings, outOfScope, scope }: { findings: Finding[]; outOfScope: number; scope: Replay["scope"] }) {
  if (scope === "not_residential")
    return <p className="summary-line">Not a residential lease. Florida's residential landlord-tenant law doesn't apply, so nothing was checked.</p>;
  const n = (s: Severity) => findings.filter((f) => f.severity === s).length;
  const parts = SEVERITIES.filter((s) => n(s) > 0);
  return (
    <p className="summary-line">
      {parts.length === 0 && <span>No problems found under the 18 provisions checked</span>}
      {parts.map((s) => (
        <span key={s}>
          <i className={`swatch ${s}`} aria-hidden="true" />
          {n(s)} {n(s) === 1 ? SEVERITY_LABEL[s].one : SEVERITY_LABEL[s].many}
        </span>
      ))}
      {outOfScope > 0 && <span className="muted">{outOfScope} outside what it checks</span>}
    </p>
  );
}

function StatuteDialog({ finding, statute, onClose }: { finding: Finding; statute: StatuteData; onClose: () => void }) {
  const c = statute.citations[finding.citation];
  const quotes = (statute.rules[finding.ruleId]?.basis ?? []).filter((b) => b.citation === finding.citation).map((b) => b.quote);
  const text = c?.text ?? "";
  // Highlight the rule's quoted basis inside the subsection text.
  const parts: { t: string; hit: boolean }[] = [];
  let rest = text;
  for (const q of quotes) {
    const at = rest.indexOf(q);
    if (at < 0) continue;
    parts.push({ t: rest.slice(0, at), hit: false }, { t: q, hit: true });
    rest = rest.slice(at + q.length);
  }
  parts.push({ t: rest, hit: false });
  return (
    <dialog
      className="statute"
      ref={(d) => {
        if (d && !d.open) d.showModal();
      }}
      onClose={onClose}
      aria-labelledby="statute-title"
    >
      <div className="statute-body">
        <h2 id="statute-title">
          s. {finding.citation}, Florida Statutes
        </h2>
        <p className="faint">
          {c?.catchline} · {statute.year} Florida Statutes, Chapter 83 Part II · <a href={c?.url}>Official text</a>
        </p>
        <div className="text">
          {c?.parents.map((p, i) => (
            <p key={i} className="muted" style={{ marginBottom: 8 }}>
              {p}
            </p>
          ))}
          {parts.map((p, i) => (p.hit ? <mark key={i}>{p.t}</mark> : p.t))}
        </div>
        <p className="faint">The highlighted text is what the “{statute.rules[finding.ruleId]?.title}” rule is written from.</p>
        <form method="dialog" className="dialog-close">
          <button className="btn secondary">Close</button>
        </form>
      </div>
    </dialog>
  );
}

export function AuditView({ run, showFindings }: { run: Replay; showFindings: boolean }) {
  const { data: statute } = useJson<StatuteData>("data/statute.json");
  const [active, setActive] = useState<number | null>(null);
  const [cite, setCite] = useState<number | null>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);

  const findings = showFindings ? run.findings : [];
  // Lease order; findings with no clause (something missing) first.
  const order = useMemo(
    () => findings.map((_, i) => i).sort((a, b) => (findings[a]!.span?.start ?? -1) - (findings[b]!.span?.start ?? -1)),
    [findings],
  );

  const showInLease = (i: number) => {
    setActive(i);
    const el = document.getElementById(`hl-${i}`);
    const doc = docRef.current;
    if (el && doc)
      doc.scrollTo({ top: doc.scrollTop + el.getBoundingClientRect().top - doc.getBoundingClientRect().top - 80, behavior: "smooth" });
    if (el && window.matchMedia("(max-width: 860px)").matches) el.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const showCard = (i: number) => {
    setActive(i);
    cards.current[i]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    cards.current[i]?.focus();
  };

  return (
    <>
      <div className="audit-grid">
        <LeaseDoc ref={docRef} lease={run.lease} findings={findings} outOfScope={showFindings ? run.outOfScope : []} active={active} onSelect={showCard} />
        <section className="findings" aria-label="Findings">
          {showFindings && run.scope === "residential" && findings.length === 0 && (
            <div className="empty-state">
              <h3>No problems found</h3>
              <p className="muted" style={{ marginTop: 8 }}>
                None of the 18 provisions LeaseTrace checks is broken by this lease. That doesn't make every clause lawful: see what it
                doesn't check below.
              </p>
            </div>
          )}
          {!showFindings && <div className="empty-state muted">Findings appear here when the rules have run.</div>}
          {order.map((i) => {
            const f = findings[i]!;
            return (
              <article
                key={i}
                ref={(el) => {
                  cards.current[i] = el;
                }}
                tabIndex={-1}
                className={`finding ${f.severity}${active === i ? " active" : ""}`}
              >
                <div className="finding-head">
                  <h3>{f.title}</h3>
                  <span className="sev">
                    <i className={`swatch ${f.severity}`} aria-hidden="true" />
                    {SEVERITY_LABEL[f.severity].one}
                  </span>
                </div>
                <p>{f.problem}</p>
                {f.span ? <p className="quote">{f.span.quote}</p> : <p className="faint" style={{ marginTop: 8 }}>Nothing in the lease to point at: this is about something it leaves out.</p>}
                {f.suggestedFix && (
                  <p className="fix">
                    <b>Suggested wording</b>
                    {f.suggestedFix}
                  </p>
                )}
                <div className="finding-actions">
                  <button className="linklike" onClick={() => setCite(i)} disabled={!statute}>
                    Read s. {f.citation}
                  </button>
                  {f.span && (
                    <button className="linklike" onClick={() => showInLease(i)}>
                      Show in lease
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {showFindings && run.outOfScope.length > 0 && (
            <div className="empty-state">
              <h3>Not checked</h3>
              <p className="muted" style={{ marginTop: 6, fontSize: "var(--t-s)" }}>
                These clauses fall outside Chapter 83, Part II, so LeaseTrace lists them instead of judging them.
              </p>
              <ul className="oos-list">
                {run.outOfScope.map((o, i) => (
                  <li key={i}>
                    <b>{o.topic}</b>: {o.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
      {showFindings && (
        <p className="stats">
          <span>Model {run.model}, {run.effort} effort</span>
          <span>Extraction {secs(run.latencyMs)}</span>
          <span>
            {run.usage.inputTokens.toLocaleString()} input tokens + {run.usage.cacheReadTokens.toLocaleString()} cached, {run.usage.outputTokens.toLocaleString()} output
          </span>
          <span>Cost {usd(run.usage.costUsd, 3)}</span>
          {run.dropped.length > 0 && <span>{run.dropped.length} finding(s) dropped by validation</span>}
        </p>
      )}
      {cite !== null && statute && findings[cite] && <StatuteDialog finding={findings[cite]!} statute={statute} onClose={() => setCite(null)} />}
    </>
  );
}
