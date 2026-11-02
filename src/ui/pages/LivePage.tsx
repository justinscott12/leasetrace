// Check your own lease with your own Anthropic key (DECISIONS.md, Decision 1): the
// browser calls the API directly, so visitors never cost the site anything and the
// lease goes nowhere else. The pipeline and SDK load only when a run starts.
import { useState } from "react";
import type { TraceEvent } from "../../pipeline/audit.js";
import { AuditView, Summary } from "../components/AuditView.js";
import { Trace } from "../components/Trace.js";
import type { Replay } from "../types.js";

const MODELS = [
  { id: "claude-opus-5-5|medium", label: "Claude Opus 5.5, medium effort (what the samples use; most accurate)" },
  { id: "claude-sonnet-5-5|medium", label: "Claude Sonnet 5.5, medium effort (cheaper)" },
];

const ERRORS: Record<string, string> = {
  auth: "Anthropic rejected the API key. Check that it's copied in full and still active.",
  rate_limit: "Anthropic is rate-limiting this key. Wait a minute and try again.",
  timeout: "The request took too long and was stopped. Try again; long leases can take up to a minute.",
  refusal: "The model declined to process this text. Nothing is shown rather than a guessed result.",
  truncated: "The model's answer was cut off before it finished, so no result is shown. Try again.",
  bad_output: "The model's answer didn't match the expected format, so no result is shown. Try again.",
  too_long: "This lease is longer than 200,000 characters, which is more than LeaseTrace accepts.",
  empty: "There's no lease text to check yet.",
  api: "The Anthropic API returned an error.",
};

export function LivePage() {
  const [lease, setLease] = useState("");
  const [key, setKey] = useState("");
  const [model, setModel] = useState(MODELS[0]!.id);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Replay | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileNote(null);
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const { pdfToText } = await import("../pdf.js");
        const text = await pdfToText(file);
        if (text.replace(/\s/g, "").length < 200)
          setFileNote("This PDF has almost no text layer (it may be a scan). Copy the text from a version you can select, or paste it below.");
        setLease(text);
      } else setLease(await file.text());
    } catch (e) {
      setFileNote(`That file couldn't be read: ${String(e)}. Paste the lease text instead.`);
    }
  }

  async function run() {
    setError(null);
    setResult(null);
    setEvents([]);
    setRunning(true);
    try {
      const [{ default: Anthropic }, { audit }] = await Promise.all([import("@anthropic-ai/sdk"), import("../../pipeline/audit.js")]);
      const [m, effort] = model.split("|") as [string, "medium"];
      const client = new Anthropic({ apiKey: key.trim(), dangerouslyAllowBrowser: true });
      const r = await audit(client.beta.messages, lease, { model: m, effort, onEvent: (e) => setEvents((xs) => [...xs, e]) });
      if (!r.ok) {
        setError(`${ERRORS[r.error.kind] ?? "Something went wrong."} (${r.error.message})`);
        return;
      }
      setResult({
        id: "live",
        recordedAt: new Date().toISOString(),
        model: r.extraction.model,
        effort,
        lease,
        scope: r.scope,
        findings: r.findings,
        dropped: r.dropped,
        outOfScope: r.outOfScope,
        trace: r.trace,
        usage: r.extraction.usage,
        latencyMs: r.extraction.latencyMs,
      });
    } catch (e) {
      setError(`Something went wrong before the request finished: ${String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  const ready = lease.trim().length > 0 && key.trim().length > 0 && !running;

  return (
    <div className="wrap">
      <section className="section prose">
        <h1>Check your own lease</h1>
        <p className="muted">
          Bring your own Anthropic API key. Your browser sends the lease and key straight to Anthropic's API and nowhere else: this
          site has no server, stores nothing, and runs no analytics. An audit usually costs your key between 10 and 50 cents, more for very long leases.
        </p>
      </section>

      <form
        className="live-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) void run();
        }}
      >
        <div className="field">
          <label htmlFor="lease-file">Lease file</label>
          <input id="lease-file" type="file" accept=".txt,.pdf,text/plain,application/pdf" onChange={(e) => void onFile(e.target.files?.[0])} />
          <span className="hint">A PDF with selectable text or a .txt file. It's read in your browser.</span>
          {fileNote && <p className="error">{fileNote}</p>}
        </div>
        <div className="field">
          <label htmlFor="lease-text">Lease text</label>
          <textarea id="lease-text" value={lease} onChange={(e) => setLease(e.target.value)} placeholder="Or paste the lease here." />
          <span className="hint">{lease.length.toLocaleString()} characters. Remove names or account numbers first if you'd rather not send them.</span>
        </div>
        <div className="field">
          <label htmlFor="api-key">Anthropic API key</label>
          <input id="api-key" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" />
          <span className="hint">
            Kept only in this tab's memory and cleared when you leave the page. Create one at{" "}
            <a href="https://console.anthropic.com/settings/keys">console.anthropic.com</a>.
          </span>
        </div>
        <div className="field">
          <label htmlFor="model">Model</label>
          <select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <button className="btn" type="submit" disabled={!ready}>
            {running ? "Checking…" : "Check this lease"}
          </button>
        </div>
      </form>

      {(running || events.length > 0) && (
        <div style={{ marginTop: 32 }}>
          <Trace events={events} now={Number.POSITIVE_INFINITY} running={running} />
          {running && events.length > 0 && <p className="faint">Claude usually takes 15–60 seconds, depending on the lease's length.</p>}
        </div>
      )}
      {error && <p className="error" style={{ marginTop: 16 }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 16 }}>
          <div className="audit-head">
            <Summary findings={result.findings} outOfScope={result.outOfScope.length} scope={result.scope} />
            <p className="advice-banner">Information, not legal advice. Each finding shows the statute text it comes from so you can check it yourself.</p>
          </div>
          <AuditView run={result} showFindings />
        </div>
      )}
    </div>
  );
}
