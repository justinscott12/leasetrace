// The pipeline's step-by-step trace. For replays, `now` advances through the
// recorded timestamps; for live runs, events arrive as they happen.
import type { TraceEvent } from "../../pipeline/audit.js";
import { secs, usd } from "../data.js";

const n = (x: unknown) => (typeof x === "number" ? x : 0);

function describe(e: TraceEvent): string {
  const d = e.detail;
  switch (e.step) {
    case "extract_start":
      return `Sent the lease (${n(d.chars).toLocaleString()} characters) to Claude, with the statute and instructions as a cached prefix`;
    case "extract_done":
      return `Claude returned the lease's facts, each with a quote: ${n(d.outputTokens).toLocaleString()} output tokens, ${
        n(d.cacheReadTokens) ? `${n(d.cacheReadTokens).toLocaleString()} prefix tokens read from cache` : `${n(d.cacheWriteTokens).toLocaleString()} prefix tokens written to cache`
      }, ${usd(d.costUsd as number | null, 3)}`;
    case "extract_failed":
      return `Extraction failed (${String(d.kind)}): ${String(d.message)}. No result is shown rather than a guessed one.`;
    case "locate": {
      const nf = n(d.notFound);
      return `Found every quote in the lease text: ${n(d.exact)} exact, ${n(d.normalized)} after normalizing spacing, ${n(d.fuzzy)} fuzzy${nf ? `, ${nf} not found (those facts are marked unclear)` : ""}`;
    }
    case "rules":
      return `Ran 18 rules written from the statute in code: ${n(d.findings)} finding(s)${n(d.dropped) ? `, ${n(d.dropped)} dropped by validation` : ""}`;
    case "done":
      return d.scope === "not_residential" ? "Not a residential lease: stopped before the rules" : "Done";
  }
}

export function Trace({
  events,
  now,
  running,
  controls,
}: {
  events: TraceEvent[];
  now: number;
  running: boolean;
  controls?: React.ReactNode;
}) {
  const next = events.find((e) => e.atMs > now);
  return (
    <section className="trace" aria-label="Pipeline trace" aria-live="polite">
      <div className="trace-top">
        <b>Trace</b>
        {controls}
      </div>
      <ol>
        {events.map((e, i) => {
          const isReached = e.atMs <= now;
          const isRunning = running && e === next;
          return (
            <li key={i} className={isReached ? "reached" : isRunning ? "running" : ""} hidden={!isReached && !isRunning}>
              <span className="t">{isReached ? secs(e.atMs) : ""}</span>
              <span className="dot" aria-hidden="true" />
              <span>{isReached ? describe(e) : "Waiting for Claude…"}</span>
            </li>
          );
        })}
        {running && !next && (
          <li className="running">
            <span className="t" />
            <span className="dot" aria-hidden="true" />
            <span>{events.length ? "Working…" : "Starting…"}</span>
          </li>
        )}
      </ol>
    </section>
  );
}
