// Architecture, the design decisions (straight from docs/DECISIONS.md) and the limits.
import decisionsMd from "../../../docs/DECISIONS.md?raw";

interface Decision {
  title: string;
  date: string;
  bullets: string[];
}

/** DECISIONS.md is a list of "## date · project · title" entries with "- " bullets. */
function parseDecisions(md: string): Decision[] {
  return md
    .split(/\n## /)
    .slice(1)
    .map((block) => {
      const [head = "", ...lines] = block.split("\n");
      const parts = head.split(" · ");
      return {
        date: parts[0] ?? "",
        title: (parts.slice(2).join(" · ") || head).replace(/\s*\(teach mode off\)\s*$/, ""),
        // "Justin picked … Verdict" lines are the teach-mode learning log, not product documentation.
        bullets: lines.filter((l) => l.startsWith("- ") && !l.startsWith("- Justin picked")).map((l) => l.slice(2)),
      };
    });
}

/** Renders `code` and **bold** spans; everything else is plain text. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") ? <code key={i}>{p.slice(1, -1)}</code> : p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p,
      )}
    </>
  );
}

function Diagram() {
  const box = (x: number, y: number, w: number, title: string, sub: string, accent = false) => (
    <g>
      <rect x={x} y={y} width={w} height={86} rx={6} fill="var(--paper)" stroke={accent ? "var(--action)" : "var(--rule)"} strokeWidth={accent ? 2 : 1.5} />
      <text x={x + 14} y={y + 30} fill="var(--ink)" fontWeight={700} fontSize={15}>
        {title}
      </text>
      {sub.split("\n").map((l, i) => (
        <text key={i} x={x + 14} y={y + 52 + i * 18} fill="var(--ink-soft)" fontSize={13}>
          {l}
        </text>
      ))}
    </g>
  );
  const arrow = (x1: number, x2: number, y: number) => (
    <path d={`M${x1} ${y} H${x2 - 6} m-6 -6 l6 6 l-6 6`} fill="none" stroke="var(--ink-faint)" strokeWidth={1.8} />
  );
  return (
    <div className="diagram">
      <svg viewBox="0 0 1015 300" role="img" aria-labelledby="diagram-title">
        <title id="diagram-title">
          The lease goes to Claude, which returns facts with quotes. Code finds each quote in the lease, rules written from the statute
          decide what's a problem, and invalid findings are dropped before anything is shown.
        </title>
        {box(10, 30, 150, "Lease text", "pasted, .txt, or a PDF\nread in the browser")}
        {arrow(160, 200, 73)}
        {box(200, 30, 200, "Claude extracts facts", "21 facts, each with a quote;\nstatute is a cached prefix", true)}
        {arrow(400, 440, 73)}
        {box(440, 30, 160, "Find the quotes", "exact, then normalized,\nthen strict fuzzy match")}
        {arrow(600, 640, 73)}
        {box(640, 30, 160, "18 rules in code", "each written from a\nquoted subsection", true)}
        {arrow(800, 830, 73)}
        {box(830, 30, 175, "Validate", "citation in statute?\nspan matches lease?")}
        <text x={10} y={170} fill="var(--ink)" fontWeight={700} fontSize={15}>
          Measured by
        </text>
        {box(10, 186, 995, "Eval harness", "30 labeled fictional leases (dev and held-out test), each run 3 times; strict precision and recall; stored extractions\nare re-scored for free when a rule changes")}
      </svg>
    </div>
  );
}

export function HowPage() {
  const decisions = parseDecisions(decisionsMd);
  return (
    <div className="wrap">
      <section className="section prose">
        <h1>How it works</h1>
        <p className="muted">
          The model reads; code decides. Claude turns the lease into a fixed set of facts, each backed by a quote from the lease. Rules
          written from the text of Chapter 83, Part II decide what those facts mean. A finding is shown only if its citation exists in
          the statute and its quote is found in the lease.
        </p>
      </section>
      <Diagram />

      <section className="section prose">
        <h2>What it checks</h2>
        <p>
          Security deposit handling, disclosure and deadlines (s. 83.49); the 3-day notice for unpaid rent (s. 83.56(3)); notice and hours
          for repair entry (s. 83.53(2)); notice to end a periodic tenancy (s. 83.57) or a fixed term (s. 83.575); waivers of the
          landlord's maintenance duties (s. 83.51); attorney-fee waivers (s. 83.48); limits on liability (s. 83.47); utility shutoffs,
          lockouts, flag bans and removal of a tenant's belongings (s. 83.67); retaliation (s. 83.64); and the landlord's notice address
          (s. 83.50).
        </p>
        <h2>What it doesn't</h2>
        <p>
          Late-fee amounts (Part II sets no cap), HOA and condominium rules, local ordinances, fair-housing law, and commercial leases. It
          lists those clauses as not checked instead of guessing. It also doesn't read scanned PDFs without a text layer.
        </p>
      </section>

      <section className="section">
        <h2>Design decisions</h2>
        <p className="section-intro">Each one was decided against named alternatives and logged as the project went. This list is read from the repository.</p>
        {decisions.map((d) => (
          <div className="decision" key={d.date + d.title}>
            <h3>
              <Inline text={d.title} /> <span className="faint">{d.date}</span>
            </h3>
            <ul>
              {d.bullets.map((b, i) => (
                <li key={i}>
                  <Inline text={b} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
