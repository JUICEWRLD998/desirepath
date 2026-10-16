// Three browsers, one graph, at the same time: nothing is lost, and a tenant's private map stays private.
// Needs FalkorDB (FALKORDB_URL or FALKORDB_HOST) and Chromium. Skipped without a database.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, type Browser } from "playwright";
import { startShop, type Shop } from "../../../apps/testshop/server.ts";
import { connect, ensureSchema, graphName, type Graph } from "../../core/graph.ts";
import { runAgents } from "../concurrent.ts";
import type { ProposeInput, Proposer } from "../llm.ts";
import { fill, type Task } from "../task.ts";

const skip = !(process.env.FALKORDB_URL || process.env.FALKORDB_HOST);
let shop: Shop, browser: Browser, db: Awaited<ReturnType<typeof connect>>;
const names = [graphName(`conc-${process.pid}`), graphName(`conc-${process.pid}`, "acme")];
before(async () => {
  if (skip) return;
  shop = await startShop(); db = await connect(); browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
});
after(async () => {
  await browser?.close(); await shop?.close();
  if (db) { for (const n of names) await db.selectGraph(n).delete().catch(() => {}); await db.close(); }
});

const WANT: Record<string, Array<[string, string]>> = { Home: [["link", "Kitchen"]], Kitchen: [["button", "Quick add"]], Cart: [["link", "Checkout"]] };
const standIn: Proposer = async ({ obs }: ProposeInput) => {
  const w = WANT[obs.screen.title.split(" | ")[0]]?.[0];
  return { index: w ? obs.candidates.findIndex(c => c.role === w[0] && c.name === w[1]) + 1 : 0, slot: null, tokens: 1 };
};
const task = (): Task => {
  const slots = { product: "Trail Mug" };
  return { id: "conc", site: `conc-${process.pid}`, baseUrl: shop.url, start: "/", text: fill("Add the {product} to the cart and reach checkout", slots), slots, goal: { path: "/checkout", textIncludes: ["{product}"] } };
};
const n = async (g: Graph, q: string, params: Record<string, unknown> = {}) => Object.values((await g.query(q, { params: params as never })).data![0] as Record<string, number>)[0];

test("three agents write one graph concurrently and the counts add up exactly", { skip, timeout: 180_000 }, async () => {
  const g = db.selectGraph(names[0]); await ensureSchema(g);
  const results = await runAgents({ browser, agents: 3, graph: g, task: task(), mode: "cold", propose: standIn, actionTimeout: 3000, prefix: "worker" });
  assert.deepEqual(results.map(r => r.outcome), ["success", "success", "success"]);
  const stepsRun = results.reduce((s, r) => s + r.steps.length, 0);              // 9: three steps each
  assert.equal(stepsRun, 9);
  assert.equal(await n(g, "MATCH (r:Run) RETURN count(r)"), 3);
  assert.equal(await n(g, "MATCH (s:Step) RETURN count(s)"), 9);
  // every walked step moved exactly one edge counter: 3 edges, each walked by all 3 agents
  assert.equal(await n(g, "MATCH ()-[e:ACT]->() RETURN count(e)"), 3);
  assert.equal(await n(g, "MATCH ()-[e:ACT]->() RETURN sum(e.ok)"), 9);
  assert.equal(await n(g, "MATCH ()-[e:ACT]->() RETURN sum(e.fail)"), 0);
  assert.equal(await n(g, "MATCH (:State)-[r:REACHES]->(:Goal) RETURN sum(r.count)"), 3);
  assert.deepEqual((await g.query("MATCH (r:Run) RETURN r.agent AS a ORDER BY a")).data!.map(x => (x as { a: string }).a), ["worker-1", "worker-2", "worker-3"]);
  // each agent had its own cart: all three reached checkout with the mug
  assert.ok(results.every(r => r.steps.at(-1)?.observed.startsWith("Checkout")));
});

test("agents of one tenant write to the tenant graph; the public graph does not change", { skip, timeout: 180_000 }, async () => {
  const pub = db.selectGraph(names[0]);
  const ten = db.selectGraph(names[1]); await ensureSchema(ten);
  const before = [await n(pub, "MATCH (s:State) RETURN count(s)"), await n(pub, "MATCH ()-[e:ACT]->() RETURN sum(e.ok)"), await n(pub, "MATCH (r:Run) RETURN count(r)")];
  const results = await runAgents({ browser, agents: 2, graph: ten, tenant: "acme", task: task(), mode: "cold", propose: standIn, actionTimeout: 3000 });
  assert.deepEqual(results.map(r => r.outcome), ["success", "success"]);
  assert.deepEqual([await n(pub, "MATCH (s:State) RETURN count(s)"), await n(pub, "MATCH ()-[e:ACT]->() RETURN sum(e.ok)"), await n(pub, "MATCH (r:Run) RETURN count(r)")], before);
  assert.equal(await n(ten, "MATCH ()-[e:ACT]->() RETURN sum(e.ok)"), 6);
  assert.equal(await n(ten, "MATCH (r:Run {tenant: 'acme'}) RETURN count(r)"), 2);
});
