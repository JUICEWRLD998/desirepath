// Phase 3: real public sites. Per task: cold runs (the LLM explores, the map records), then map runs.
//   npm run p3                       all tasks on books.toscrape.com, quotes.toscrape.com, en.wikipedia.org
//   npm run p3 -- --only books-page2,quotes-tag-author --cold 3 --map 2
// Polite by construction: identified user agent, robots.txt obeyed (navigations aborted), 1 action per second.
// It deletes and rebuilds ONLY the graphs public:<domain> of the sites it runs. Receipt: docs/receipts/p3-latest.json.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { connect, ensureSchema, graphName } from "../packages/core/graph.ts";
import { runTask } from "../packages/agent/loop.ts";
import { openRouterProposer } from "../packages/agent/llm.ts";
import { fetchRobots } from "../packages/agent/robots.ts";
import { newAgentContext } from "../packages/agent/browser.ts";
import { loadTasks } from "../packages/agent/runner.ts";
import { fill } from "../packages/agent/task.ts";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const COLD = Number(arg("cold") ?? 2), MAP = Number(arg("map") ?? 2);
const only = arg("only")?.split(",");
const tasks = loadTasks().filter(t => !/^(127\.0\.0\.1|localhost)/.test(new URL(t.baseUrl).hostname) && (!only || only.includes(t.id)));
if (!tasks.length) { console.error("no matching real-site tasks"); process.exit(2); }

const db = await connect();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
const propose = openRouterProposer();
const receipt: Array<Record<string, unknown>> = [];
const verdict: Record<string, unknown> = {};
const wiped = new Set<string>();
const robotsBy = new Map<string, Awaited<ReturnType<typeof fetchRobots>>>();
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

try {
  for (const t of tasks) {
    const task = { ...t, text: fill(t.text, t.slots) };
    const g = db.selectGraph(graphName(task.site));
    if (!wiped.has(task.site)) { await g.delete().catch(() => {}); wiped.add(task.site); }
    await ensureSchema(g);
    const origin = new URL(task.baseUrl).origin;
    if (!robotsBy.has(origin)) robotsBy.set(origin, await fetchRobots(origin));
    const robots = robotsBy.get(origin)!;
    const cold: number[] = [], warm: number[] = [];
    console.log(`\n##### ${task.id}: ${task.text}`);
    for (const [mode, n] of [["cold", COLD], ["map", MAP]] as const) {
      for (let k = 1; k <= n; k++) {
        const ctx = await newAgentContext(browser, { identify: true });
        let row: Record<string, unknown>;
        try {
          const r = await runTask({ graph: g, page: await ctx.newPage(), task, mode, robots, propose, maxSteps: 15, actionTimeout: 8000, log: l => console.log("   " + l) });
          row = { task: task.id, mode, n: k, outcome: r.outcome, steps: r.steps.length, mapSteps: r.mapSteps, failedMapSteps: r.failedMapSteps,
            llmCalls: r.llmCalls, tokens: r.tokens, seconds: +(r.ms / 1000).toFixed(1) };
          if (r.outcome === "success") (mode === "cold" ? cold : warm).push(r.steps.length);
        } catch (e) {
          row = { task: task.id, mode, n: k, outcome: "error", error: (e as Error).message.split("\n")[0] };
        } finally { await ctx.close(); }
        receipt.push(row);
        console.log(`  ${mode} #${k}: ${JSON.stringify(row)}`);
      }
    }
    // the plan's criterion: a map run needed fewer steps than the task's cold runs (compared with their mean)
    const ok = warm.length > 0 && cold.length > 0 && Math.min(...warm) < mean(cold);
    verdict[task.id] = { coldSteps: cold, mapSteps: warm, mapFewerThanColdMean: ok };
    console.log(`  => cold steps [${cold}], map steps [${warm}] -> best map run fewer than the cold mean: ${ok}`);
  }
} finally {
  mkdirSync("docs/receipts", { recursive: true });
  writeFileSync("docs/receipts/p3-latest.json", JSON.stringify({ model: process.env.OPENROUTER_MODEL, verdict, runs: receipt }, null, 2));
  await browser.close(); await db.close();
}
console.log("\nverdict per task:", JSON.stringify(verdict, null, 1));
