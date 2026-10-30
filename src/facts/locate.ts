// Turns a quote the model copied from the lease into exact character offsets
// (DECISIONS.md: "quote-then-locate", tiered matching).
import type { Span } from "./schema.js";

export type LocateMethod = "exact" | "normalized" | "fuzzy";

export interface Located {
  span: Span;
  method: LocateMethod;
  /** 1 for exact/normalized; word-level similarity for fuzzy. */
  score: number;
}

export const FUZZY_MIN_SCORE = 0.9;
export const FUZZY_MIN_MARGIN = 0.05;
const FUZZY_MIN_LENGTH = 20;

const CHAR_MAP: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"',
  "–": "-", "—": "-", " ": " ",
};

/** Lowercases, unifies quotes/dashes, collapses whitespace. `map[i]` is the original index of normalized char i. */
function normalize(s: string): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  let lastSpace = true; // also trims leading whitespace
  for (let i = 0; i < s.length; i++) {
    const c = CHAR_MAP[s[i]!] ?? s[i]!;
    if (/\s/.test(c)) {
      if (lastSpace) continue;
      text += " ";
      lastSpace = true;
    } else {
      text += c.toLowerCase();
      lastSpace = false;
    }
    map.push(i);
  }
  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
    map.pop();
  }
  return { text, map };
}

function spanFrom(lease: string, start: number, end: number): Span {
  return { start, end, quote: lease.slice(start, end) };
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

/** Sørensen–Dice similarity on character bigrams. */
function dice(a: Map<string, number>, aLen: number, b: string): number {
  const bm = bigrams(b);
  let overlap = 0;
  for (const [k, n] of bm) overlap += Math.min(n, a.get(k) ?? 0);
  const total = aLen - 1 + (b.length - 1);
  return total > 0 ? (2 * overlap) / total : 0;
}

export function locateQuote(lease: string, quote: string): Located | null {
  const q = quote.trim();
  if (!q) return null;

  const exact = lease.indexOf(q);
  if (exact >= 0) return { span: spanFrom(lease, exact, exact + q.length), method: "exact", score: 1 };

  const L = normalize(lease);
  const Q = normalize(q);
  if (!Q.text) return null;
  const at = L.text.indexOf(Q.text);
  if (at >= 0)
    return { span: spanFrom(lease, L.map[at]!, L.map[at + Q.text.length - 1]! + 1), method: "normalized", score: 1 };

  if (Q.text.length < FUZZY_MIN_LENGTH) return null;
  return fuzzy(lease, L, Q.text);
}

/** Word-level Levenshtein distance; order matters, unlike bigram overlap. */
function wordDistance(a: string[], b: string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length]!;
}

const bare = (w: string) => w.replace(/[^\w$%]/g, "");

/**
 * Slides word windows (quote length ±2 words) over the normalized lease. Bigram
 * similarity is a cheap pre-filter; the score is 1 − word edit distance / length.
 * Accepts only a best window that clears FUZZY_MIN_SCORE and beats the best
 * non-overlapping runner-up by FUZZY_MIN_MARGIN; otherwise the match is ambiguous.
 */
function fuzzy(lease: string, L: { text: string; map: number[] }, q: string): Located | null {
  const words = [...L.text.matchAll(/\S+/g)].map((m) => ({ s: m.index, e: m.index + m[0].length, w: bare(m[0]) }));
  const qWords = q.split(" ").map(bare).filter(Boolean);
  const qb = bigrams(q);
  const n = qWords.length;

  const scored: { s: number; e: number; score: number }[] = [];
  for (let i = 0; i < words.length; i++) {
    for (let len = Math.max(1, n - 2); len <= n + 2 && i + len <= words.length; len++) {
      const s = words[i]!.s;
      const e = words[i + len - 1]!.e;
      if (dice(qb, q.length, L.text.slice(s, e)) < 0.75) continue;
      const w = words.slice(i, i + len).map((x) => x.w).filter(Boolean);
      scored.push({ s, e, score: 1 - wordDistance(qWords, w) / Math.max(n, w.length) });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < FUZZY_MIN_SCORE) return null;
  const runnerUp = scored.find((w) => w.e <= best.s || w.s >= best.e);
  if (runnerUp && best.score - runnerUp.score < FUZZY_MIN_MARGIN) return null;

  const start = L.map[best.s]!;
  let end = L.map[best.e - 1]! + 1;
  while (end > start && /\s/.test(lease[end - 1]!)) end--;
  return { span: spanFrom(lease, start, end), method: "fuzzy", score: best.score };
}
