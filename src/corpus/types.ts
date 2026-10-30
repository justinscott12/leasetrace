/** One addressable unit of statute text, e.g. "83.49(3)(a)". */
export interface Subsection {
  id: string;
  /** Text belonging to this unit only (children excluded). */
  text: string;
  /** This unit plus all descendants, in reading order. */
  fullText: string;
  children: string[];
}

export interface Section {
  number: string; // "83.49"
  catchline: string;
  /** The whole section body as plain text. */
  text: string;
  history: string;
  sourceUrl: string;
  subsections: Subsection[];
}

export interface Corpus {
  title: string;
  statuteYear: number;
  retrievedAt: string; // ISO date
  indexUrl: string;
  sections: Section[];
}
