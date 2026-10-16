// What a client sees (plan §9): a standard MCP client starts the server over stdio and asks for a route.
//   npm run mcp:demo                 uses the books.toscrape.com map built by `npm run p3`
// Open the real page, hand its accessibility snapshot to `observe`, then ask `plan` for a route to a goal in plain words.
// Read-only: it calls observe, plan, explain and map_stats, never report.
import "dotenv/config";
import { chromium } from "playwright";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const site = process.argv[2] ?? "books.toscrape.com";
const task = process.argv[3] ?? "Open the book Under the Tuscan Sun from the Travel category";
const start = process.argv[4] ?? "https://books.toscrape.com/";

const client = new Client({ name: "demo-client", version: "0.1.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: ["--import", "tsx", "packages/mcp/server.ts"], env: process.env as Record<string, string>, stderr: "inherit" }));
const call = async (name: string, args: Record<string, unknown>) => {
  const r = await client.callTool({ name, arguments: args }) as { isError?: boolean; content: Array<{ text: string }> };
  if (r.isError) throw new Error(`${name}: ${r.content[0].text}`);
  return JSON.parse(r.content[0].text);
};
try {
  console.log("tools:", (await client.listTools()).tools.map(t => t.name).join(", "));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  const page = await (await browser.newContext()).newPage();
  await page.goto(start, { waitUntil: "load" });
  const snapshot = await page.locator("body").ariaSnapshot();
  const url = page.url();
  await browser.close();

  const here = await call("observe", { site, url, snapshot });
  console.log(`observe -> sig ${here.sig}, known in the map: ${here.known}`);
  const plan = await call("plan", { site, task, current_sig: here.sig });
  if (!plan.routes.length) { console.log("plan -> no route:", plan.reason, JSON.stringify(plan.nearest_goals ?? [])); process.exitCode = 1; }
  for (const [i, r] of plan.routes.entries()) {
    console.log(`route ${i + 1} to "${r.goal}" (${r.source}, p_success ${r.p_success}, ~${r.est_ms} ms): ` + r.steps.map((s: { kind: string; role: string; name: string }) => `${s.kind} ${s.role} "${s.name}"`).join("  ->  "));
  }
  if (plan.routes[0]) {
    const s = plan.routes[0].steps[0];
    const why = await call("explain", { site, from_sig: here.sig, action_key: s.key });
    console.log(`explain first step -> ${why.runs.length} recorded walks, ${why.runs.filter((w: { ok: boolean }) => w.ok).length} ok`);
  }
  console.log("map_stats ->", JSON.stringify((await call("map_stats", { site })).public));
} finally { await client.close(); }
