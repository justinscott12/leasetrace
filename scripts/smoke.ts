// Runs one real audit on a lease text file and prints the result.
//   npx tsx --env-file=.env scripts/smoke.ts private/lease.txt [--model claude-opus-5-5] [--effort medium] [--out private/runs]
// Costs real money (one API call). The full result is written to --out, which
// defaults to private/runs so real-lease output never lands in a tracked folder.
import Anthropic from "@anthropic-ai/sdk";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import type { Fact } from "../src/facts/schema.js";
import { audit } from "../src/pipeline/audit.js";
import type { Effort } from "../src/pipeline/extract.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { model: { type: "string" }, effort: { type: "string" }, out: { type: "string", default: "private/runs" } },
});
const path = positionals[0];
if (!path) throw new Error("usage: smoke.ts <lease.txt> [--model M] [--effort E] [--out DIR]");

const lease = await readFile(path, "utf8");
const client = new Anthropic();
const result = await audit(client.beta.messages, lease, {
  ...(values.model && { model: values.model }),
  ...(values.effort && { effort: values.effort as Effort }),
  onEvent: (e) => console.log(`[${String(e.atMs).padStart(6)} ms] ${e.step}`, JSON.stringify(e.detail)),
});

await mkdir(values.out, { recursive: true });
const file = `${values.out}/run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
await writeFile(file, JSON.stringify(result, null, 2));

if (!result.ok) {
  console.log(`\nFAILED (${result.error.kind}): ${result.error.message}`);
  process.exit(1);
}
const { extraction: ex } = result;
console.log(`\nscope: ${result.scope} · model: ${ex.model} · ${ex.latencyMs} ms`);
console.log(
  `tokens: in ${ex.usage.inputTokens}, cache write ${ex.usage.cacheWriteTokens}, cache read ${ex.usage.cacheReadTokens}, out ${ex.usage.outputTokens}` +
    ` · cost ${ex.usage.costUsd === null ? "unknown" : `$${ex.usage.costUsd.toFixed(4)}`}`,
);
console.log(`\nfindings (${result.findings.length}):`);
for (const f of result.findings)
  console.log(`  [${f.severity}] ${f.ruleId} ${f.citation}: ${f.problem}${f.span ? `\n      “${f.span.quote.slice(0, 160)}”` : ""}`);
if (result.dropped.length) console.log(`dropped: ${result.dropped.map((d) => `${d.finding.ruleId} (${d.reason})`).join("; ")}`);
console.log(`\nout of scope (${result.outOfScope.length}):`);
for (const o of result.outOfScope) console.log(`  - ${o.topic}: ${o.reason}${o.span ? "" : " (quote not located)"}`);
console.log(`\nfacts:`);
const describe = (v: Fact<unknown>) =>
  `${v.status}${v.status === "present" ? ` = ${JSON.stringify(v.value)}` : v.status === "unclear" ? ` (${v.note})` : ""}`;
for (const [k, v] of Object.entries(ex.facts) as [string, Fact<unknown> | Fact<unknown>[]][]) {
  if (!Array.isArray(v)) console.log(`  ${k}: ${describe(v)}`);
  else if (v.length === 0) console.log(`  ${k}: none`);
  else for (const [i, c] of v.entries()) console.log(`  ${k}[${i}]: ${describe(c)}${c.status !== "absent" && c.span ? ` — “${c.span.quote.slice(0, 80)}”` : ""}`);
}
console.log(`\nfull result: ${file}`);
