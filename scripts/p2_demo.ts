// Phase 2 end to end with the REAL model (plan §14 P2): the three runs on the test shop, from one command.
//   npm run p2            needs FALKORDB_URL (or FALKORDB_HOST...) and OPENROUTER_API_KEY in .env, and Chromium
// 1. cold run: the LLM explores, the map records.   2. map run: follows the route, expects zero LLM calls.
// 3. (if the map has only one route) explore runs until it has two.   4. flip the redesign, map run: one edge fails, detour.
// It deletes and recreates ONLY the graph public:testshop-p2. Receipt: docs/receipts/p2-latest.json.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { startShop } from "../apps/testshop/server.ts";
import { connect, ensureSchema, graphName, plan } from "../packages/core/graph.ts";
import { runTask, type RunResult } from "../packages/agent/loop.ts";
import { openRouterProposer } from "../packages/agent/llm.ts";
import { loadTasks } from "../packages/agent/runner.ts";
import { fill, type Task } from "../packages/agent/task.ts";

const SITE = "testshop-p2";
const PORT = Number(process.env.SHOP_PORT || 4100);   // the port is part of the URL template, so it must not change between runs
const found = loadTasks().find(t => t.id === "testshop-add-and-checkout")!;
const shop = await startShop({ port: PORT });
const task: Task = { ...found, baseUrl: shop.url, site: SITE, text: fill(found.text, found.slots) };

const db = await connect();
const g = db.selectGraph(graphName(SITE));
await g.delete().catch(() => {});           // fresh map: the cold run must start from nothing
await ensureSchema(g);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
const propose = openRouterProposer();

const rows: Array<Record<string, unknown>> = [];
async function go(label: string, mode: "cold" | "map", explore = false): Promise<RunResult> {
  console.log(`\n== ${label}`);
  const ctx = await browser.newContext();
  try {
    const r = await runTask({ graph: g, page: await ctx.newPage(), task, mode, propose, explore, log: l => console.log("  " + l) });
    const row = { label, mode, explore, layout: shop.layout(), outcome: r.outcome, steps: r.steps.length, mapSteps: r.mapSteps,
      failedMapSteps: r.failedMapSteps, llmCalls: r.llmCalls, tokens: r.tokens, seconds: +(r.ms / 1000).toFixed(1),
      actions: r.steps.map(s => `${s.source}:${s.ok ? "ok" : "FAIL"} ${s.action}`) };
    rows.push(row);
    console.log(`  -> ${r.outcome}: ${r.steps.length} steps, ${r.llmCalls} LLM calls, ${r.tokens} tokens, ${row.seconds}s`);
    return r;
  } finally { await ctx.close(); }
}
const problems: string[] = [];
const expect = (cond: boolean, msg: string) => { if (!cond) { problems.push(msg); console.error("  !! " + msg); } };

try {
  const cold = await go("1. cold run (LLM explores)", "cold");
  expect(cold.outcome === "success", "cold run did not reach checkout");

  const warm = await go("2. map run (follow the route)", "map");
  expect(warm.outcome === "success", "map run did not reach checkout");
  expect(warm.llmCalls === 0, `map run called the LLM ${warm.llmCalls} times (expected 0)`);
  expect(warm.steps.length <= cold.steps.length, "map run took more steps than the cold run");

  const goalRow = (await g.query("MATCH (s:State)-[:REACHES]->(:Goal) RETURN s.sig")).data?.[0] as { "s.sig": string } | undefined;
  const homeRow = (await g.query("MATCH (s:State) WHERE s.title STARTS WITH 'Home' RETURN s.sig")).data?.[0] as { "s.sig": string } | undefined;
  const routeCount = async () => goalRow && homeRow ? (await plan(g, homeRow["s.sig"], goalRow["s.sig"])).length : 0;
  for (let n = 1; (await routeCount()) < 2 && n <= 3; n++) await go(`3.${n} explore run (find a second route)`, "cold", true);
  const routes = await routeCount();
  console.log(`\nroutes from Home to checkout in the map: ${routes}`);
  expect(routes >= 2, "the map has only one route, so the redesign beat cannot show a detour");

  shop.setLayout("b");
  console.log("\n-- redesign switched on: the card 'Quick add' buttons no longer work");
  const redesigned = await go("4. map run after the redesign", "map");
  expect(redesigned.outcome === "success", "map run after the redesign did not reach checkout");
  expect(redesigned.failedMapSteps >= 1, "no map step failed after the redesign (the beat did not happen)");
  expect(redesigned.llmCalls === 0, `the detour needed ${redesigned.llmCalls} LLM calls (expected 0)`);

  const healed = await go("5. map run again (the map has learned)", "map");
  expect(healed.outcome === "success", "the follow-up map run failed");
  expect(healed.failedMapSteps <= redesigned.failedMapSteps, "the follow-up run failed more steps than the first redesigned run");
} finally {
  mkdirSync("docs/receipts", { recursive: true });
  const stats = (await g.query("MATCH (r:Run) RETURN r.mode AS mode, count(r) AS runs, avg(r.steps) AS steps, avg(r.llm_calls) AS llm")).data;
  writeFileSync("docs/receipts/p2-latest.json", JSON.stringify({ model: process.env.OPENROUTER_MODEL, site: SITE, rows, problems, stats }, null, 2));
  await browser.close(); await shop.close(); await db.close();
}
console.log(problems.length ? `\nFAILED: ${problems.join("; ")}` : "\nP2 OK: cold explored, map followed with 0 LLM calls, the redesign broke one edge and the map detoured.");
process.exitCode = problems.length ? 1 : 0;
