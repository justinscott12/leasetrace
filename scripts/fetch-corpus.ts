// Fetches F.S. ch. 83 Part II from Online Sunshine and writes corpus/part2.json.
// Run by hand when the statute year changes; the app never fetches at runtime.
import { writeFile, mkdir } from "node:fs/promises";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { Corpus, Section, Subsection } from "../src/corpus/types.js";

const BASE = "http://www.leg.state.fl.us/statutes/index.cfm";
const INDEX_URL = `${BASE}?App_mode=Display_Statute&URL=0000-0099/0083/0083PARTIIContentsIndex.html`;
const sectionUrl = (file: string) =>
  `${BASE}?App_mode=Display_Statute&URL=0000-0099/0083/Sections/${file}`;

// Nesting levels used by the Legislature's markup, outermost first.
const LEVELS = ["Subsection", "Paragraph", "SubParagraph", "SubSubParagraph"];

async function get(url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.text();
    if (attempt >= 3) throw new Error(`GET ${url} -> ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

const clean = (s: string) =>
  s.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

function parseSection(html: string, url: string): Section {
  const $ = cheerio.load(html);
  const sec = $("div.Section").first();
  if (!sec.length) throw new Error(`no Section div in ${url}`);
  const number = clean(sec.children("span.SectionNumber").text());
  const catchline = clean(sec.find("span.CatchlineText").first().text());
  const body = sec.children("span.SectionBody");
  const subsections: Subsection[] = [];

  // .text() glues adjacent blocks together ("shall:Comply"); pad them first.
  const blockText = (node: cheerio.Cheerio<Element>) => {
    // Only block-level units get padding; inline markup (fractions, links) must not.
    node.find("div, span[class~=Text], span[class~=Number]").append(" ");
    return clean(node.text());
  };

  const levelKids = (el: Element) =>
    $(el)
      .children("div")
      .filter((_, d) => LEVELS.includes($(d).attr("class") ?? ""))
      .toArray();
  const rawNum = (el: Element) => clean($(el).children("span.Number").text());

  // Walk one numbered unit. Own text = text spans that are direct children
  // (intro text, plus any flush text after the child list).
  // The markup sometimes leaves a parent unnumbered and puts a compound
  // number like "(1)(a)" on its first child; the outer "(1)" is lifted to
  // the parent and stripped from the child via `strip`.
  const walk = (el: Element, parentId: string, strip = ""): Subsection => {
    const node = $(el);
    let num = rawNum(el).slice(strip.length); // "(3)"
    let liftFromChild = "";
    if (!num) {
      const first = levelKids(el)[0];
      const m = first && /^(\([^)]+\))\(/.exec(rawNum(first));
      if (!m?.[1]) throw new Error(`unnumbered unit under ${parentId}`);
      num = liftFromChild = m[1];
    }
    const id = `${parentId}${num}`;
    const own = node
      .children("span")
      .not(".Number")
      .map((_, s) => clean($(s).text()))
      .get()
      .filter(Boolean)
      .join(" ");
    const entry: Subsection = { id, text: own, fullText: "", children: [] };
    subsections.push(entry);
    levelKids(el).forEach((kid, i) =>
      entry.children.push(walk(kid, id, i === 0 ? liftFromChild : "").id),
    );
    const copy = node.clone();
    copy.find("span.Number").remove();
    entry.fullText = blockText(copy);
    return entry;
  };

  for (const top of body.children("div.Subsection").toArray()) walk(top, number);

  return {
    number,
    catchline,
    text: blockText(body.clone()),
    history: clean(sec.find("span.HistoryText").text()),
    sourceUrl: url,
    subsections,
  };
}

async function main() {
  const indexHtml = await get(INDEX_URL);
  const year = Number(/(\d{4}) Florida Statutes/.exec(indexHtml)?.[1]);
  if (!year) throw new Error("could not read statute year from index page");
  const files = [...new Set(indexHtml.match(/0083\.\d+\.html/g) ?? [])];
  if (files.length < 30) throw new Error(`only ${files.length} sections found; markup changed?`);

  const sections: Section[] = [];
  for (const file of files) {
    const url = sectionUrl(file);
    sections.push(parseSection(await get(url), url));
    process.stdout.write(".");
  }

  // Sanity: every id unique, every section has text.
  const ids = new Set<string>();
  for (const s of sections) {
    if (!s.text) throw new Error(`empty section ${s.number}`);
    for (const sub of s.subsections) {
      if (ids.has(sub.id)) throw new Error(`duplicate id ${sub.id}`);
      ids.add(sub.id);
    }
  }

  const corpus: Corpus = {
    title: "Florida Statutes Chapter 83, Part II — Residential Tenancies",
    statuteYear: year,
    retrievedAt: new Date().toISOString().slice(0, 10),
    indexUrl: INDEX_URL,
    sections,
  };
  await mkdir("corpus", { recursive: true });
  await writeFile("corpus/part2.json", JSON.stringify(corpus, null, 2) + "\n");
  console.log(`\n${sections.length} sections, ${ids.size} subsections, statute year ${year}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
