// Phase 6: turn docs/receipts/p6-runs.json into medians and ranges per task and overall. Raw rows stay in the receipt.
//   npm run p6           (runs the measurement, then this)      npx tsx scripts/p6_summary.ts      (summary only)
import { readFileSync, writeFileSync } from "node:fs";

interface Row { task: string; mode: "cold" | "map"; outcome: string; steps?: number; llmCalls?: number; tokens?: number; seconds?: number; failedMapSteps?: number }
const raw = JSON.parse(readFileSync("docs/receipts/p6-runs.json", "utf8")) as { model: string; runs: Row[] };
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN; };
const rng = (xs: number[]) => (xs.length ? `${Math.min(...xs)} to ${Math.max(...xs)}` : "n/a");
const stat = (rows: Row[], k: "steps" | "llmCalls" | "tokens" | "seconds") => { const v = rows.map(r => r[k] ?? 0); return { median: med(v), range: rng(v) }; };

const tasks = [...new Set(raw.runs.map(r => r.task))];
const per = tasks.map(t => {
  const rows = raw.runs.filter(r => r.task === t);
  const out: Record<string, unknown> = { task: t };
  for (const mode of ["cold", "map"] as const) {
    const m = rows.filter(r => r.mode === mode);
    out[mode] = { runs: m.length, success: m.filter(r => r.outcome === "success").length, steps: stat(m, "steps"), llmCalls: stat(m, "llmCalls"), tokens: stat(m, "tokens"), seconds: stat(m, "seconds"), failedMapSteps: m.reduce((a, r) => a + (r.failedMapSteps ?? 0), 0) };
  }
  return out;
});
const total = (mode: "cold" | "map") => { const m = raw.runs.filter(r => r.mode === mode); return { runs: m.length, success: m.filter(r => r.outcome === "success").length, llmCallsTotal: m.reduce((a, r) => a + (r.llmCalls ?? 0), 0), tokensTotal: m.reduce((a, r) => a + (r.tokens ?? 0), 0), stepsMedian: med(m.map(r => r.steps ?? 0)), secondsMedian: med(m.map(r => r.seconds ?? 0)) }; };
const summary = { model: raw.model, overall: { cold: total("cold"), map: total("map") }, perTask: per };
writeFileSync("docs/receipts/p6-summary.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary.overall, null, 1));
for (const p of per as Array<any>) console.log(`${p.task}: cold steps ${p.cold.steps.median} (${p.cold.steps.range}), map steps ${p.map.steps.median} (${p.map.steps.range}); LLM calls cold ${p.cold.llmCalls.median} map ${p.map.llmCalls.median}; seconds cold ${p.cold.seconds.median} map ${p.map.seconds.median}; success ${p.cold.success}/${p.cold.runs} and ${p.map.success}/${p.map.runs}`);

// CLAIMS.md: every number the README and the video may use, with the command that reproduces it. Generated, so the table cannot drift from the receipt.
const o = summary.overall, f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "n/a");
const rows = (per as Array<any>).map(p => `| ${p.task} | ${p.cold.steps.median} (${p.cold.steps.range}) | ${p.map.steps.median} (${p.map.steps.range}) | ${p.cold.llmCalls.median} | ${p.map.llmCalls.median} | ${p.cold.seconds.median} (${p.cold.seconds.range}) | ${p.map.seconds.median} (${p.map.seconds.range}) | ${p.cold.success}/${p.cold.runs} and ${p.map.success}/${p.map.runs} |`).join("\n");
const md = `# Claims

Every number in the README and the demo video is in this file, next to the command that reproduces it. Single user, single model (\`${raw.model}\`), one machine, FalkorDB Cloud free tier. Nothing here is a benchmark against other systems.

## Measured on real sites (\`npm run p6\`, receipt \`docs/receipts/p6-runs.json\`, summary \`docs/receipts/p6-summary.json\`)

Per task: 3 cold runs (the model explores and the graph records), then 3 map runs. Sites: books.toscrape.com, quotes.toscrape.com, en.wikipedia.org (robots.txt obeyed, one action per second, identified user agent). Open Library is not measured: its host times out from my machine.

| | Runs | Succeeded | Model calls (total) | Tokens (total) | Steps (median) | Seconds (median) |
|---|---|---|---|---|---|---|
| cold | ${o.cold.runs} | ${o.cold.success} | ${o.cold.llmCallsTotal} | ${o.cold.tokensTotal.toLocaleString()} | ${f(o.cold.stepsMedian)} | ${f(o.cold.secondsMedian)} |
| map | ${o.map.runs} | ${o.map.success} | ${o.map.llmCallsTotal} | ${o.map.tokensTotal.toLocaleString()} | ${f(o.map.stepsMedian)} | ${f(o.map.secondsMedian)} |

Per task, median (range) over 3 runs:

| Task | Steps cold | Steps map | Model calls cold | Model calls map | Seconds cold | Seconds map | Succeeded cold and map |
|---|---|---|---|---|---|---|---|
${rows}

What this supports: a map run needs no model call and no tokens, and it succeeds as often as a cold run (48 of 48 runs succeeded). Map runs were about 1 second quicker in the median (the cold run pays for the model call), but that gap is small next to the one-action-per-second delay and page loads, so do not sell it as a speedup. Steps were equal on every task: the cold run already finds a short path on these small sites, so do not claim fewer steps.

## Other claims

| Claim | Value | Command | Receipt |
|---|---|---|---|
| Share of Mind2Web steps already walked by another task on the same site | 24.5% of 7,775 steps; 4.9 / 8.5 / 13.8 / 20.2 / 27.8% after 1 / 2 / 4 / 8 / 12 earlier tasks; control across sites 0.2%; planted duplicate 100% | \`python scripts/measure_reuse.py\` (needs duckdb) | prints its own controls, exits 1 if one fails |
| Test shop, cold run | 4 steps, 4 model calls | \`npm run p2\` | \`docs/receipts/p2-latest.json\` |
| Test shop, map run | 3 steps, 0 model calls | \`npm run p2\` | same |
| Test shop after the redesign | 1 failed step, detour taken, 0 model calls; the planner stopped choosing the broken edge after 2 failures | \`npm run p2\` | same |
| Concurrent writers lose no update | 3 agents: 9 steps, 3 runs, every edge ok = 9; 3 MCP clients reporting one edge 8 times each: exactly +24 | \`npm test\` (\`concurrent.db.test.ts\`, \`mcp.db.test.ts\`) | test output |
| Mind2Web paving | 73 sites, 7,157 states, 7,084 edges, 137 s on Cloud | \`npm run pave\` | DECISIONS 26 |
| Tests | 70 of 70 pass on FalkorDB Cloud | \`npm test\` | DECISIONS |
| Dashboard | ui-score 92/100, axe 0 violations in 16 states, 8 widths, both themes | see DECISIONS "Phase 5 verification" | \`docs/receipts/p5/\` |

## What this is not

Not a benchmark of agent accuracy. Not tested with more than one real user (me). The site redesign is our own test shop, because a real site cannot be redesigned on cue. Mind2Web paths are human-recorded history from 2023 snapshots; no agent runs on those sites. No logins, form submissions or captchas on real sites.
`;
writeFileSync("CLAIMS.md", md);
console.log("wrote CLAIMS.md");
