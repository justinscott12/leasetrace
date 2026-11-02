// Runs the pipeline over the golden set and scores it (DECISIONS.md, Decision 4).
//   npm run eval -- [--split dev|test|all] [--runs N] [--model M] [--effort E] [--only id,id] [--concurrency N]
//   npm run eval -- --rescore evals/results/<file>.json   (no API call: current rules + labels on stored extractions)
//   npm run eval -- --dry                                  (list cases and estimate cost, no API call)
//   npm run eval -- --resume evals/results/<file>.partial.json   (finish an interrupted run; done runs aren't repaid)
//   npm run eval -- --resume evals/results/<file>.json --runs 3  (add runs to a finished file, e.g. 1 → 3)
// Every finished run is checkpointed to <name>.partial.json, so a crash loses at most the calls in flight.
// --max-usd (default 15) stops starting new calls once spend reaches it; calls in flight still finish.
// Live runs cost real money. Defaults to the dev split: test numbers are the published ones,
// so prompts are never tuned against them.
import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { type GoldenCase, loadGoldenSet } from "../src/evals/golden.js";
import { buildReport, type Report, type ResultsMeta, type StoredCase, type StoredRun } from "../src/evals/report.js";
import { rescoreCases, sha256 as sha } from "../src/evals/rescore.js";
import { precision, recall } from "../src/evals/score.js";
import { audit } from "../src/pipeline/audit.js";
import { SYSTEM_PREFIX } from "../src/pipeline/prompt.js";
import { DEFAULT_MODEL, type Effort } from "../src/pipeline/extract.js";

const { values } = parseArgs({
  options: {
    split: { type: "string", default: "dev" },
    runs: { type: "string" },
    model: { type: "string", default: DEFAULT_MODEL },
    effort: { type: "string", default: "medium" },
    only: { type: "string" },
    concurrency: { type: "string", default: "3" },
    rescore: { type: "string" },
    resume: { type: "string" },
    "max-usd": { type: "string", default: "15" },
    dry: { type: "boolean", default: false },
    dir: { type: "string", default: "evals/leases" },
    out: { type: "string", default: "evals/results" },
  },
});

const split = values.split as ResultsMeta["split"];
if (!["dev", "test", "all"].includes(split)) throw new Error(`--split must be dev, test or all`);
const golden = loadGoldenSet(values.dir);
const only = values.only?.split(",");
const cases = golden.filter((g) => (split === "all" || g.split === split) && (!only || only.includes(g.id)));
const gitCommit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
})();
const labelsApproved = cases.every((c) => c.approved);

if (values.rescore) await rescore(values.rescore);
else if (values.dry) dry();
else await live();

function dry() {
  const runs = Number(values.runs ?? 1);
  const chars = cases.reduce((t, c) => t + c.lease.length, 0);
  // Measured on the first dev run (Opus 5.5, medium): $0.22 for the cache-writing call, then $0.04–0.08 per golden lease.
  console.log(`${cases.length} cases × ${runs} run(s), ${chars.toLocaleString()} lease chars`);
  console.log(`estimate: ~$${(0.2 + cases.length * runs * 0.08).toFixed(2)} on Opus 5.5 medium (other models/efforts: re-measure)`);
  for (const c of cases) console.log(`  ${c.split}  ${c.id}  (${c.findings.length} labels)`);
}

async function live() {
  loadDotEnv();
  const client = new Anthropic();
  const prior = values.resume ? (JSON.parse(readFileSync(values.resume, "utf8")) as { meta: ResultsMeta; cases: StoredCase[] }) : null;
  // Resuming keeps the old file's settings; `--runs N` there extends a finished run to N runs per case.
  const meta: ResultsMeta = prior
    ? { ...prior.meta, runsPerCase: values.runs ? Number(values.runs) : prior.meta.runsPerCase, gitCommit, labelsApproved }
    : {
        createdAt: new Date().toISOString(),
        model: values.model!,
        effort: values.effort!,
        runsPerCase: Number(values.runs ?? 1),
        split,
        gitCommit,
        labelsApproved,
        promptSha: sha(SYSTEM_PREFIX).slice(0, 12),
      };
  if (prior && (values.model !== DEFAULT_MODEL || values.effort !== "medium") && (values.model !== meta.model || values.effort !== meta.effort))
    throw new Error(`--resume keeps the file's model/effort (${meta.model}, ${meta.effort}); start a new run to change them`);
  const name = values.resume
    ? basename(values.resume).replace(/(\.partial)?\.json$/, "")
    : `${stamp()}-${meta.model}-${meta.effort}${split === "dev" ? "" : `-${split}`}${basename(values.dir!) === "leases" ? "" : `-${basename(values.dir!)}`}`;
  const results = new Map<string, StoredRun[]>(cases.map((c) => [c.id, []]));
  for (const sc of prior?.cases ?? []) {
    const c = cases.find((x) => x.id === sc.id);
    if (!c) continue;
    if (sha(c.lease) !== sc.leaseSha256) throw new Error(`${sc.id}: lease changed since the interrupted run; start a new run`);
    results.set(sc.id, sc.runs.filter((r) => r.ok)); // failed runs are retried
  }
  const jobs = cases.flatMap((c) => Array.from({ length: Math.max(0, meta.runsPerCase - results.get(c.id)!.length) }, () => c));
  const cap = Number(values["max-usd"]);
  const priorSpend = [...results.values()].flat().reduce((t, r) => t + (r.ok ? (r.usage.costUsd ?? 0) : 0), 0);
  let spent = priorSpend;
  let done = 0;
  let failedInARow = 0;
  let stopped: string | null = null;
  mkdirSync(values.out!, { recursive: true });
  const partial = `${values.out}/${name}.partial.json`;
  const snapshot = (): StoredCase[] => cases.map((c) => ({ id: c.id, split: c.split, leaseSha256: sha(c.lease), runs: results.get(c.id)! }));
  const checkpoint = () => writeFileSync(partial, JSON.stringify({ meta, cases: snapshot() }) + "\n");
  if (priorSpend) console.log(`resuming: $${priorSpend.toFixed(2)} already spent, ${jobs.length} run(s) left`);

  const one = async (c: GoldenCase) => {
    if (stopped) return;
    if (spent >= cap) {
      stopped = `spend cap $${cap} reached`;
      return;
    }
    const r = await audit(client.beta.messages, c.lease, { model: meta.model, effort: meta.effort as Effort });
    const stored: StoredRun = r.ok
      ? {
          ok: true,
          scope: r.scope,
          findings: r.findings,
          dropped: r.dropped,
          outOfScope: r.outOfScope,
          locates: r.extraction.locates,
          facts: r.extraction.facts,
          problems: r.extraction.problems,
          model: r.extraction.model,
          usage: r.extraction.usage,
          latencyMs: r.extraction.latencyMs,
        }
      : { ok: false, error: { kind: r.error.kind, message: r.error.message }, latencyMs: r.error.latencyMs };
    results.get(c.id)!.push(stored);
    done++;
    if (stored.ok) {
      spent += stored.usage.costUsd ?? 0;
      failedInARow = 0;
    } else if (++failedInARow >= 3 || ["auth", "too_long"].includes(stored.error.kind) || /credit balance/i.test(stored.error.message)) stopped = `stopping after ${stored.error.kind}: ${stored.error.message.replace(/\.$/, "")}`;
    checkpoint();
    const cost = stored.ok && stored.usage.costUsd !== null ? `$${stored.usage.costUsd.toFixed(3)}` : "";
    console.log(
      `[${done}/${jobs.length}] ${c.id}: ${stored.ok ? `${stored.findings.length} findings ${cost}` : `FAILED ${stored.error.kind}`} · spent $${spent.toFixed(2)}`,
    );
  };
  // First call alone: it writes the prompt cache the rest read, and a bad key or config fails once, not 39 times.
  const [first, ...rest] = jobs;
  if (first) await one(first);
  if (first && !results.get(first.id)!.at(-1)?.ok) stopped ??= "first call failed";
  if (!stopped) await pool(rest, Number(values.concurrency), one);

  if (stopped) {
    console.log(`\nSTOPPED: ${stopped}. Finished runs are saved in ${partial}.\nResume with: npm run eval -- --resume ${partial}`);
    process.exit(1);
  }
  save(meta, snapshot(), name);
  rmSync(partial, { force: true });
}

async function rescore(file: string) {
  const old = JSON.parse(readFileSync(file, "utf8")) as { meta: ResultsMeta; cases: StoredCase[] };
  const byId = new Map(golden.map((g) => [g.id, g]));
  const stored = rescoreCases(old.cases.filter((sc) => !only || only.includes(sc.id)), golden);
  const meta: ResultsMeta = { ...old.meta, rescoredFrom: basename(file), gitCommit, labelsApproved: stored.every((s) => byId.get(s.id)!.approved) };
  save(meta, stored, `${basename(file, ".json")}-rescored`);
}

function save(meta: ResultsMeta, stored: StoredCase[], name: string) {
  const report = buildReport(meta, golden, stored);
  mkdirSync(values.out!, { recursive: true });
  const file = `${values.out}/${name}.json`;
  writeFileSync(file, JSON.stringify({ meta, report, cases: stored }, null, 2) + "\n");
  print(report);
  console.log(`\nresults: ${file}`);
}

function print(r: Report) {
  const pct = (x: number | null) => (x === null ? "  —  " : `${(x * 100).toFixed(1).padStart(5)}%`);
  if (!r.meta.labelsApproved) console.log("\n⚠ Labels not yet approved by Justin: these scores are provisional.");
  console.log(`\n${r.meta.model} · effort ${r.meta.effort} · ${r.meta.runsPerCase} run(s)/case${r.meta.rescoredFrom ? ` · rescored from ${r.meta.rescoredFrom}` : ""}`);
  for (const s of ["dev", "test", "all"] as const) {
    const t = r.totals[s];
    if (!t.cases) continue;
    console.log(
      `\n[${s}] ${t.cases} cases, ${t.runs} runs${t.errors ? `, ${t.errors} FAILED` : ""}\n` +
        `  strict   P ${pct(t.precision)}  R ${pct(t.recall)}   (tp ${t.strict.tp}, fp ${t.strict.fp}, fn ${t.strict.fn})\n` +
        `  lenient  P ${pct(t.lenientPrecision)}  R ${pct(t.lenientRecall)}\n` +
        `  fabricated citations ${pct(t.fabricatedCitationRate)} · unlocated quotes ${pct(t.unlocatedQuoteRate)} · scope ${pct(t.scopeAccuracy)} · out-of-scope recall ${pct(t.outOfScopeRecall)}` +
        (t.invalidRendered ? `\n  !! ${t.invalidRendered} invalid findings rendered` : ""),
    );
  }
  const all = r.rules.all.filter((x) => x.strict.tp + x.strict.fp + x.strict.fn > 0);
  console.log(`\nper rule (strict, all splits run)\n  ${"rule".padEnd(28)}  tp  fp  fn      P       R`);
  for (const x of all)
    console.log(
      `  ${x.ruleId.padEnd(28)} ${String(x.strict.tp).padStart(3)} ${String(x.strict.fp).padStart(3)} ${String(x.strict.fn).padStart(3)}  ${pct(precision(x.strict))}  ${pct(recall(x.strict))}`,
    );
  console.log("\ncases with errors (agreement = share of runs with the most common outcome)");
  for (const c of r.cases) {
    const misses = c.hitRate.filter((h) => !h.optional && h.rate < 1);
    if (!misses.length && !c.falsePositives.length && !c.wrongSeverity.length && c.agreement === 1 && !c.errors) continue;
    console.log(`  ${c.id} [${c.split}] agreement ${pct(c.agreement)}`);
    for (const h of misses) console.log(`    missed ${h.ruleId} (${h.severity}) in ${pct(1 - h.rate)} of runs`);
    for (const w of c.wrongSeverity) console.log(`    ${w.ruleId}: expected ${w.expected}, got ${w.got} (${w.runs} run(s))`);
    for (const f of c.falsePositives)
      console.log(`    false positive ${f.ruleId} (${f.severity})${f.nearMiss ? ` on near-miss: ${f.nearMiss}` : ""} (${f.runs} run(s))`);
  }
  console.log(
    `\ncost $${r.cost.totalUsd.toFixed(2)} total` +
      (r.cost.perRunUsd === null ? "" : `, $${r.cost.perRunUsd.toFixed(3)}/run`) +
      (r.cost.latencyP50Ms === null ? "" : ` · latency p50 ${(r.cost.latencyP50Ms / 1000).toFixed(1)} s, p90 ${(r.cost.latencyP90Ms! / 1000).toFixed(1)} s`),
  );
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, n) }, async () => {
      while (next < items.length) await fn(items[next++]!);
    }),
  );
}

function stamp() {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
}

/** Minimal .env reader (Node 20.9 has no loadEnvFile). Never prints values. */
function loadDotEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, "$2");
  }
}
