// CLI: run one task in cold or map mode against the shared map.
//   npx tsx packages/agent/runner.ts --task testshop-add-and-checkout --mode cold
//   npx tsx packages/agent/runner.ts --task testshop-add-and-checkout --mode map --base http://127.0.0.1:4100
// Flags: --mode cold|map  --base <url>  --site <graph site>  --tenant <id>  --explore  --headed  --max-steps <n>
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { connect, ensureSchema, graphName } from "../core/graph.ts";
import { fill, type Task } from "./task.ts";
import { runTask } from "./loop.ts";
import { openRouterProposer } from "./llm.ts";
import { fetchRobots } from "./robots.ts";
import { newAgentContext } from "./browser.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

export function loadTasks(): Task[] {
  const dir = new URL("./tasks/", import.meta.url);
  return readdirSync(dir).filter(f => f.endsWith(".json")).flatMap(f => JSON.parse(readFileSync(new URL(f, dir), "utf8")) as Task[]);
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("packages/agent/runner.ts")) {
  const id = arg("task"), mode = arg("mode") ?? "map";
  if (!id || (mode !== "cold" && mode !== "map")) { console.error("usage: runner.ts --task <id> --mode cold|map [--base url] [--site name] [--tenant id] [--explore] [--headed]"); process.exit(2); }
  const found = loadTasks().find(t => t.id === id);
  if (!found) { console.error(`unknown task "${id}"; known: ${loadTasks().map(t => t.id).join(", ")}`); process.exit(2); }
  const task: Task = { ...found, baseUrl: arg("base") ?? found.baseUrl, site: arg("site") ?? found.site, text: fill(found.text, found.slots) };
  const tenant = arg("tenant");

  const db = await connect();
  const graph = db.selectGraph(graphName(task.site, tenant));
  await ensureSchema(graph);
  const browser = await chromium.launch({ headless: !flag("headed"), executablePath: process.env.CHROMIUM_PATH });
  try {
    const real = !/^(127\.0\.0\.1|localhost)$/.test(new URL(task.baseUrl).hostname);   // real sites: say who we are, obey robots.txt
    const robots = real ? await fetchRobots(new URL(task.baseUrl).origin) : undefined;
    const page = await (await newAgentContext(browser, { identify: real })).newPage();
    const result = await runTask({ graph, page, task, mode, tenant, robots, explore: flag("explore"), propose: openRouterProposer(),
      maxSteps: arg("max-steps") ? Number(arg("max-steps")) : undefined, log: console.log });
    console.log(JSON.stringify({ outcome: result.outcome, steps: result.steps.length, mapSteps: result.mapSteps,
      failedMapSteps: result.failedMapSteps, llmCalls: result.llmCalls, tokens: result.tokens, ms: result.ms }, null, 2));
    process.exitCode = result.outcome === "success" ? 0 : 1;
  } finally {
    await browser.close(); await db.close();
  }
}
