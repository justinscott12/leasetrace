// Builds the static data the site reads (no API calls):
//   public/data/evals.json   — every stored eval run, re-scored with the current rules and labels
//   public/data/statute.json — each rule's statute quotes and the full text of every cited subsection
// Run after any eval run or rule/label change:  npm run site:data
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { citationText, corpus, isCitation } from "../src/corpus/index.js";
import { loadGoldenSet } from "../src/evals/golden.js";
import { buildReport, type Report, type ResultsMeta, type StoredCase } from "../src/evals/report.js";
import { rescoreCases, sha256 } from "../src/evals/rescore.js";
import { SYSTEM_PREFIX } from "../src/pipeline/prompt.js";
import { scoreCase } from "../src/evals/score.js";
import { RULES } from "../src/rules/rules.js";

const golden = [...loadGoldenSet("evals/leases"), ...loadGoldenSet("evals/hard")];
const byId = new Map(golden.map((g) => [g.id, g]));
const isHard = (id: string) => id.startsWith("hard-");

// Group every stored run by model + effort + prompt version. Runs from different prompts
// are never pooled; the site compares like with like. Rescored copies are derived files.
const CURRENT_PROMPT = sha256(SYSTEM_PREFIX).slice(0, 12);
const files = readdirSync("evals/results").filter((f) => f.endsWith(".json") && !f.includes("-rescored") && !f.includes(".partial"));
const groups = new Map<string, { meta: ResultsMeta; cases: Map<string, StoredCase>; files: string[] }>();
for (const f of files) {
  const r = JSON.parse(readFileSync(`evals/results/${f}`, "utf8")) as { meta: ResultsMeta; cases: StoredCase[] };
  const key = `${r.meta.model}|${r.meta.effort}|${r.meta.promptSha ?? "earlier"}`;
  const g = groups.get(key) ?? { meta: r.meta, cases: new Map<string, StoredCase>(), files: [] as string[] };
  g.files.push(f);
  for (const c of r.cases) {
    const prev = g.cases.get(c.id);
    g.cases.set(c.id, prev ? { ...prev, runs: [...prev.runs, ...c.runs] } : c);
  }
  groups.set(key, g);
}

const slim = (r: Report) => ({ totals: r.totals, rules: r.rules, cost: r.cost });

const configs = [...groups.values()].map(({ meta, cases, files }) => {
  const all = rescoreCases([...cases.values()], golden);
  const basic = all.filter((c) => !isHard(c.id));
  const hard = all.filter((c) => isHard(c.id));
  const test = all.filter((c) => c.split === "test");
  return {
    model: meta.model,
    effort: meta.effort,
    promptSha: meta.promptSha ?? null,
    currentPrompt: meta.promptSha === CURRENT_PROMPT,
    files,
    labelsApproved: all.every((c) => byId.get(c.id)!.approved),
    basic: basic.length ? slim(buildReport(meta, golden, basic)) : null,
    hard: hard.length ? slim(buildReport(meta, golden, hard)) : null,
    test: test.length ? slim(buildReport(meta, golden, test)) : null,
    all,
  };
});

// The published configuration: the one replays and the live demo default to.
const HEADLINE = { model: "claude-opus-5-5", effort: "medium" };
// Prefer runs on the current prompt; fall back to the latest earlier ones while new runs are pending.
const head =
  configs.find((c) => c.model === HEADLINE.model && c.effort === HEADLINE.effort && c.currentPrompt && c.test) ??
  configs.find((c) => c.model === HEADLINE.model && c.effort === HEADLINE.effort && c.test);
if (!head) throw new Error("no test results for the headline configuration");

/** Everything the headline configuration got wrong, per case, with the lease text involved. */
function gallery() {
  const out = [];
  for (const sc of head!.all) {
    const gc = byId.get(sc.id)!;
    const runs = sc.runs.filter((r) => r.ok);
    const misses = new Map<number, number>();
    const fps = new Map<string, { ruleId: string; severity: string; quote: string | null; nearMiss: string | null; runs: number }>();
    const wrongSev = new Map<string, { ruleId: string; expected: string; got: string; quote: string | null; runs: number }>();
    for (const r of runs) {
      const s = scoreCase(gc, r);
      for (const i of s.missed) misses.set(i, (misses.get(i) ?? 0) + 1);
      const seen = new Set<string>();
      for (const f of s.falsePositives) {
        const p = r.findings[f.predicted]!;
        const key = `${p.ruleId}|${p.severity}|${f.nearMiss ?? p.span?.quote.slice(0, 40) ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const row = fps.get(key) ?? { ruleId: p.ruleId, severity: p.severity, quote: p.span?.quote ?? null, nearMiss: f.nearMiss ?? null, runs: 0 };
        row.runs++;
        fps.set(key, row);
      }
      for (const m of s.matches.filter((m) => !m.severityOk)) {
        const e = gc.findings[m.expected]!;
        const got = r.findings[m.predicted]!.severity;
        const key = `${m.expected}|${got}`;
        const row = wrongSev.get(key) ?? { ruleId: e.ruleId, expected: e.severity, got, quote: e.span?.quote ?? null, runs: 0 };
        row.runs++;
        wrongSev.set(key, row);
      }
    }
    if (!misses.size && !fps.size && !wrongSev.size) continue;
    out.push({
      id: sc.id,
      split: sc.split,
      hard: isHard(sc.id),
      summary: gc.summary,
      runs: runs.length,
      missed: [...misses].map(([i, n]) => {
        const e = gc.findings[i]!;
        return { ruleId: e.ruleId, severity: e.severity, note: e.note, quote: e.span?.quote ?? null, runs: n };
      }),
      falsePositives: [...fps.values()],
      wrongSeverity: [...wrongSev.values()],
    });
  }
  return out;
}

const caseCounts = (split: "dev" | "test", hard: boolean) => {
  const cs = golden.filter((g) => g.split === split && isHard(g.id) === hard);
  return { cases: cs.length, labels: cs.reduce((n, g) => n + g.findings.filter((f) => !f.optional).length, 0), nearMisses: cs.reduce((n, g) => n + g.nearMisses.length, 0) };
};

const evals = {
  generatedAt: new Date().toISOString(),
  headline: { ...HEADLINE, promptSha: head.promptSha, currentPrompt: head.currentPrompt },
  currentPrompt: CURRENT_PROMPT,
  labelsApproved: golden.every((g) => g.approved),
  set: {
    basic: { dev: caseCounts("dev", false), test: caseCounts("test", false) },
    hard: { dev: caseCounts("dev", true), test: caseCounts("test", true) },
  },
  configs: configs.map(({ all, ...c }) => {
    void all;
    return c;
  }),
  gallery: gallery(),
};

// Statute text for every citation a rule can produce, plus each rule's quoted basis.
const cited = new Set(RULES.flatMap((r) => r.basis.map((b) => b.citation)));
const citations: Record<string, { section: string; catchline: string; text: string; url: string; parents: string[] }> = {};
const ownText = new Map(corpus.sections.flatMap((s) => s.subsections.map((x) => [x.id, x.text] as const)));
/** Own text of enclosing subsections, outermost first: "(1)(b)" reads as a clause of "(1)". */
const parentsOf = (id: string): string[] => {
  const out: string[] = [];
  for (let p = id.replace(/\([^()]+\)$/, ""); p.includes("("); p = p.replace(/\([^()]+\)$/, "")) if (ownText.has(p)) out.unshift(ownText.get(p)!);
  return out;
};
for (const id of cited) {
  const s = corpus.sections.find((x) => x.number === id.split("(")[0]);
  if (!s || !isCitation(id)) throw new Error(`citation ${id} not found in corpus`);
  citations[id] = { section: s.number, catchline: s.catchline, text: citationText(id), url: s.sourceUrl, parents: parentsOf(id) };
}
const statute = {
  title: corpus.title,
  year: corpus.statuteYear,
  retrievedAt: corpus.retrievedAt,
  rules: Object.fromEntries(RULES.map((r) => [r.id, { title: r.title, basis: r.basis }])),
  citations,
};

mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/evals.json", JSON.stringify(evals));
writeFileSync("public/data/statute.json", JSON.stringify(statute));
for (const c of evals.configs) {
  const t = c.test?.totals.test;
  console.log(`${c.model} ${c.effort} [${c.promptSha ?? "earlier"}${c.currentPrompt ? ", current" : ""}]: test P ${t?.precision?.toFixed(3)} R ${t?.recall?.toFixed(3)} (${t?.runs} runs), files ${c.files.length}`);
}
console.log(`gallery: ${evals.gallery.length} cases`);
