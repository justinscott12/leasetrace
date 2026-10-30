import raw from "../../corpus/part2.json";
import type { Corpus } from "./types.js";

export const corpus = raw as Corpus;

// Citable units: whole sections ("83.48") and every subsection ("83.49(3)(a)").
const units = new Map<string, string>();
for (const s of corpus.sections) {
  units.set(s.number, s.text);
  for (const sub of s.subsections) units.set(sub.id, sub.fullText);
}

export const norm = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

export function isCitation(id: string): boolean {
  return units.has(id);
}

export function citationText(id: string): string {
  const t = units.get(id);
  if (t === undefined) throw new Error(`unknown citation ${id}`);
  return t;
}

/** True when `quote` appears verbatim (modulo whitespace/curly quotes) in the cited unit. */
export function quoteInCitation(id: string, quote: string): boolean {
  return isCitation(id) && norm(citationText(id)).includes(norm(quote));
}
