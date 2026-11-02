// Plays back a recorded audit at its recorded timing (sped up, and labeled so).
import { useEffect, useRef, useState } from "react";
import { AuditView, Summary } from "../components/AuditView.js";
import { Trace } from "../components/Trace.js";
import { fmtDate, secs, useJson } from "../data.js";
import { SAMPLES } from "../samples.js";
import type { Replay } from "../types.js";

// Real runs take 18–45 s; playback defaults to whichever speed finishes in about 5–8 s.
const SPEEDS = [1, 4, 8] as const;

export function AuditPage({ id }: { id: string }) {
  const sample = SAMPLES.find((s) => s.id === id);
  const { data: run, error } = useJson<Replay>(sample ? `replays/${sample.id}.json` : null);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(4);
  const [now, setNow] = useState(0);
  const [play, setPlay] = useState(0); // bump to restart playback
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const atRef = useRef(0); // playback position, shared with Skip
  const end = run?.trace.at(-1)?.atMs ?? 0;
  const done = run !== null && now >= end;

  useEffect(() => {
    if (!run) return;
    if (play === 0) setSpeed(end > 32_000 ? 8 : 4);
    // Wall-clock ticks: if the browser throttles timers (background tab), playback still
    // keeps real pace instead of stalling.
    atRef.current = 0;
    let last = performance.now();
    setNow(0);
    const id = window.setInterval(() => {
      const t = performance.now();
      atRef.current = Math.min(end, atRef.current + (t - last) * speedRef.current);
      last = t;
      setNow(atRef.current);
      if (atRef.current >= end) window.clearInterval(id);
    }, 50);
    return () => window.clearInterval(id);
  }, [run, end, play]);

  if (!sample) return <div className="wrap"><p className="section">No sample called “{id}”. <a href="#/">See the sample leases</a>.</p></div>;
  if (error) return <div className="wrap section"><p className="error">This recording couldn't be loaded ({error}). Try reloading the page.</p></div>;
  if (!run) return <div className="wrap section"><p className="muted">Loading the recording…</p></div>;

  const controls = (
    <span className="speed">
      {done ? (
        <button className="chip" onClick={() => setPlay((p) => p + 1)}>
          Replay
        </button>
      ) : (
        <>
          <span className="faint">Speed</span>
          {SPEEDS.map((s) => (
            <button key={s} className="chip" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
          <button
            className="chip"
            onClick={() => {
              atRef.current = end;
              setNow(end);
            }}
          >
            Skip to results
          </button>
        </>
      )}
    </span>
  );

  return (
    <div className="wrap">
      <div className="audit-head">
        <h1 style={{ fontSize: "var(--t-xl)" }}>{sample.title}</h1>
        <p className="recorded">
          Recorded run from {fmtDate(run.recordedAt)} on {run.model} ({run.effort} effort). The real run took {secs(end)}
          {speed !== 1 && !done ? `; playing at ${speed}× speed` : ""}. Fictional lease, written for testing.
        </p>
        {done && <Summary findings={run.findings} outOfScope={run.outOfScope.length} scope={run.scope} />}
        {done && <p className="advice-banner">Information, not legal advice. Each finding shows the statute text it comes from so you can check it yourself.</p>}
      </div>
      <Trace events={run.trace} now={now} running={!done} controls={controls} />
      <AuditView run={run} showFindings={done} />
    </div>
  );
}
