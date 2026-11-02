// The lease as a marked-up paper document. Findings become highlighter strokes
// in their severity's color; out-of-scope clauses get a dotted underline.
import { forwardRef, useMemo } from "react";
import type { OutOfScopeItem } from "../../facts/wire.js";
import type { Finding, Severity } from "../../rules/types.js";
import { SEVERITIES } from "../types.js";

interface Props {
  lease: string;
  findings: Finding[];
  outOfScope: OutOfScopeItem[];
  active: number | null;
  onSelect: (i: number) => void;
}

const rank = (s: Severity) => SEVERITIES.indexOf(s);

export const LeaseDoc = forwardRef<HTMLDivElement, Props>(function LeaseDoc({ lease, findings, outOfScope, active, onSelect }, ref) {
  const segments = useMemo(() => {
    const cuts = new Set([0, lease.length]);
    for (const f of findings) if (f.span) cuts.add(f.span.start).add(f.span.end);
    for (const o of outOfScope) if (o.span) cuts.add(o.span.start).add(o.span.end);
    const points = [...cuts].sort((a, b) => a - b);
    const out: { start: number; end: number; hits: number[]; oos: boolean }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i]!;
      const end = points[i + 1]!;
      const hits = findings.flatMap((f, j) => (f.span && f.span.start <= start && f.span.end >= end ? [j] : []));
      // Most severe first, so the marker color shows the worst finding on overlapping text.
      hits.sort((a, b) => rank(findings[a]!.severity) - rank(findings[b]!.severity));
      const oos = outOfScope.some((o) => o.span && o.span.start <= start && o.span.end >= end);
      out.push({ start, end, hits, oos });
    }
    return out;
  }, [lease, findings, outOfScope]);

  const firstSegment = new Map<number, number>();
  segments.forEach((s, i) => s.hits.forEach((h) => firstSegment.has(h) || firstSegment.set(h, i)));

  return (
    <div className="paper" ref={ref} tabIndex={0} aria-label="Lease text">
      {segments.map((s, i) => {
        const text = lease.slice(s.start, s.end);
        if (!s.hits.length) return s.oos ? <span key={i} className="oos" title="Outside what LeaseTrace checks">{text}</span> : text;
        const top = s.hits[0]!;
        const f = findings[top]!;
        const anchor = [...firstSegment].find(([, seg]) => seg === i)?.[0];
        return (
          <mark
            key={i}
            id={anchor !== undefined ? `hl-${anchor}` : undefined}
            className={`hl ${f.severity}${s.hits.includes(active ?? -1) ? " active" : ""}`}
            onClick={() => onSelect(top)}
            title={f.title}
          >
            {text}
          </mark>
        );
      })}
    </div>
  );
});
