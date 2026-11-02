// Renders the hard golden set (evals/hard/source) into lease text + labels files
// in evals/hard/, in the same format as evals/leases/. Deterministic; rerun after
// editing a spec:  npm run hard:build
import { mkdirSync, writeFileSync } from "node:fs";
import { LIBRARY, NEAR_MISSES, OUT_OF_SCOPE } from "../evals/hard/source/library.js";
import { type HardSpec, type Label, SPECS } from "../evals/hard/source/specs.js";

const OUT = "evals/hard";

// Statutory texts every Florida lease may print verbatim (public law, 83.49(2)(d) and 83.67(5)).
const NOTICE =
  "YOUR RENTAL AGREEMENT REQUIRES PAYMENT OF CERTAIN DEPOSITS. THE LANDLORD MAY TRANSFER ADVANCE RENTS TO THE LANDLORD'S ACCOUNT AS THEY ARE DUE AND WITHOUT NOTICE. WHEN YOU MOVE OUT, YOU MUST GIVE THE LANDLORD YOUR NEW ADDRESS SO THAT THE LANDLORD CAN SEND YOU NOTICES REGARDING YOUR DEPOSIT. THE LANDLORD MUST PROVIDE YOU WRITTEN NOTICE IN PERSON, BY MAIL, OR BY E-MAIL IN ACCORDANCE WITH SECTION 83.505, FLORIDA STATUTES, WITHIN 30 DAYS AFTER YOU MOVE OUT, OF THE LANDLORD'S INTENT TO IMPOSE A CLAIM AGAINST THE DEPOSIT. IF YOU DO NOT REPLY TO THE LANDLORD STATING YOUR OBJECTION TO THE CLAIM WITHIN 15 DAYS AFTER RECEIPT OF THE LANDLORD'S WRITTEN NOTICE, THE LANDLORD WILL COLLECT THE CLAIM AND MUST MAIL YOU THE REMAINING DEPOSIT, IF ANY. IF THE LANDLORD FAILS TO TIMELY PROVIDE YOU NOTICE, THE LANDLORD MUST RETURN THE DEPOSIT BUT MAY LATER FILE A LAWSUIT AGAINST YOU FOR DAMAGES. IF YOU FAIL TO TIMELY OBJECT TO A CLAIM, THE LANDLORD MAY COLLECT FROM THE DEPOSIT, BUT YOU MAY LATER FILE A LAWSUIT CLAIMING A REFUND. YOU SHOULD ATTEMPT TO INFORMALLY RESOLVE ANY DISPUTE BEFORE FILING A LAWSUIT. GENERALLY, THE PARTY IN WHOSE FAVOR A JUDGMENT IS RENDERED WILL BE AWARDED COSTS AND ATTORNEY FEES PAYABLE BY THE LOSING PARTY. THIS DISCLOSURE IS BASIC. PLEASE REFER TO PART II OF CHAPTER 83, FLORIDA STATUTES, TO DETERMINE YOUR LEGAL RIGHTS AND OBLIGATIONS.";
const LEGEND =
  "BY SIGNING THIS RENTAL AGREEMENT, THE TENANT AGREES THAT UPON SURRENDER, ABANDONMENT, OR RECOVERY OF POSSESSION OF THE DWELLING UNIT DUE TO THE DEATH OF THE LAST REMAINING TENANT, AS PROVIDED BY CHAPTER 83, FLORIDA STATUTES, THE LANDLORD SHALL NOT BE LIABLE OR RESPONSIBLE FOR STORAGE OR DISPOSITION OF THE TENANT'S PERSONAL PROPERTY.";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const roman = (n: number): string => (n <= 10 ? ROMAN[n - 1]! : "X" + roman(n - 10));

function fill(s: string, t: HardSpec["terms"]): string {
  return s.replaceAll("{O}", t.O).replaceAll("{R}", t.R).replaceAll("{P}", t.P).replace("[[NOTICE]]", NOTICE).replace("[[LEGEND]]", LEGEND);
}

/** Text before any [[NOTICE]]/[[LEGEND]] block: the clause itself, for near-miss quotes. */
const clauseOnly = (x: string) => x.split("\n\n[[")[0]!;

/** Wraps to ~88 columns and adds page headers, like a scanned or exported PDF. */
function scan(text: string, title: string): string {
  const paras = text.split("\n\n");
  const wrapped = paras.map((p) =>
    p
      .split("\n")
      .map((line) => {
        const out: string[] = [];
        let cur = "";
        for (const w of line.split(" ")) {
          if (cur && cur.length + 1 + w.length > 88) {
            out.push(cur);
            cur = w;
          } else cur = cur ? `${cur} ${w}` : w;
        }
        return [...out, cur].join("\n");
      })
      .join("\n"),
  );
  const pages: string[][] = [[]];
  let size = 0;
  for (const p of wrapped) {
    if (size > 3800) {
      pages.push([]);
      size = 0;
    }
    pages.at(-1)!.push(p);
    size += p.length;
  }
  return pages
    .map((ps, i) => `${title.split("\n")[0]}${" ".repeat(20)}Page ${i + 1} of ${pages.length}\n\n${ps.join("\n\n")}\n\n${" ".repeat(50)}Initials: ______  ______`)
    .join("\n\n");
}

function render(spec: HardSpec) {
  const t = spec.terms;
  const labels: (Label & { quote: string | null })[] = [];
  const nearMisses: { quote: string; note: string }[] = [];
  const outOfScope: { topic: string; quote: string }[] = [];
  const body = spec.sections.map((s, i) => {
    const n = i + 1;
    const [title, text] = typeof s === "string" ? LIBRARY[s] : [s.t, s.x];
    if (typeof s === "string") {
      const near = NEAR_MISSES[s];
      if (near) nearMisses.push({ quote: fill(text, t), note: near });
      const oos = OUT_OF_SCOPE[s];
      if (oos) outOfScope.push({ topic: oos, quote: fill(text, t) });
    } else {
      for (const l of s.labels ?? []) labels.push({ ...l, quote: l.quote === null ? null : fill(l.quote, t) });
      if (s.near) nearMisses.push({ quote: fill(clauseOnly(s.x), t), note: s.near });
      if (s.oos) outOfScope.push({ topic: s.oos, quote: fill(clauseOnly(s.x), t) });
    }
    const x = fill(text, t);
    switch (spec.style) {
      case "articles":
        return `ARTICLE ${roman(n)}: ${title.toUpperCase()}\n${x}`;
      case "caps":
        return `${title.toUpperCase()}\n${x}`;
      default:
        return `${n}. ${title}. ${x}`;
    }
  });
  for (const l of spec.spanless ?? []) labels.push(l);
  let text = `${spec.title}\n\n${spec.preamble}\n\n${body.join("\n\n")}\n\n${t.O}: ______________________    ${t.R}: ______________________\n`;
  if (spec.style === "scan") text = scan(text, spec.title);
  return {
    text,
    labels: {
      lease: `${spec.id}.txt`,
      split: spec.split,
      summary: spec.summary,
      scope: "residential",
      findings: labels.map(({ ruleId, citation, severity, quote, note, optional }) => ({
        ruleId,
        citation,
        severity,
        quote,
        note,
        ...(optional && { optional }),
      })),
      outOfScope,
      nearMisses,
      approved: false,
    },
  };
}

mkdirSync(OUT, { recursive: true });
for (const spec of SPECS) {
  const { text, labels } = render(spec);
  writeFileSync(`${OUT}/${spec.id}.txt`, text);
  writeFileSync(`${OUT}/${spec.id}.labels.json`, JSON.stringify(labels, null, 2) + "\n");
  console.log(`${spec.id}: ${text.length.toLocaleString()} chars, ${labels.findings.length} labels, ${labels.nearMisses.length} near-misses`);
}
