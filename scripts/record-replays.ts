// Records the sample audits the site replays (BUILD_PROMPT §6). Each replay is one
// real pipeline run: every trace event with its timestamp, the findings, tokens and
// cost. Never hand-written. Costs real money (one call per sample).
//   npm run replays:record [-- --only id,id]
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { audit } from "../src/pipeline/audit.js";
import { DEFAULT_MODEL } from "../src/pipeline/extract.js";
import { SAMPLES } from "../src/ui/samples.js";
import type { Replay } from "../src/ui/types.js";

const { values } = parseArgs({ options: { only: { type: "string" }, effort: { type: "string", default: "medium" } } });
const only = values.only?.split(",");

if (existsSync(".env"))
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, "$2");
  }

const client = new Anthropic();
mkdirSync("public/replays", { recursive: true });
for (const s of SAMPLES.filter((s) => !only || only.includes(s.id))) {
  const lease = readFileSync(s.source, "utf8");
  const r = await audit(client.beta.messages, lease, { model: DEFAULT_MODEL, effort: values.effort as "medium" });
  if (!r.ok) {
    console.log(`${s.id}: FAILED ${r.error.kind} ${r.error.message}`);
    process.exitCode = 1;
    continue;
  }
  const replay: Replay = {
    id: s.id,
    recordedAt: new Date().toISOString(),
    model: r.extraction.model,
    effort: values.effort!,
    lease,
    scope: r.scope,
    findings: r.findings,
    dropped: r.dropped,
    outOfScope: r.outOfScope,
    trace: r.trace,
    usage: r.extraction.usage,
    latencyMs: r.extraction.latencyMs,
  };
  writeFileSync(`public/replays/${s.id}.json`, JSON.stringify(replay));
  console.log(`${s.id}: ${r.findings.length} findings, $${r.extraction.usage.costUsd?.toFixed(3)}, ${(r.extraction.latencyMs / 1000).toFixed(1)} s`);
}
