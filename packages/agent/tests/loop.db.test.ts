// The Phase 2 regression test: cold run explores and records, a second exploration finds another route, a map run
// follows the route with zero LLM calls, then the redesign breaks one edge and the next map run detours.
// The LLM is replaced by a deterministic stand-in so the test is repeatable; `npm run p2` is the same story with the real model.
// Needs FalkorDB (FALKORDB_URL=redis://127.0.0.1:6390) and Chromium. Skipped without FALKORDB_URL.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, type Browser } from "playwright";
import { startShop, type Shop } from "../../../apps/testshop/server.ts";
import { connect, ensureSchema, graphName, plan, type Graph } from "../../core/graph.ts";
import { runTask, type RunResult } from "../loop.ts";
import type { ProposeInput, Proposer } from "../llm.ts";
import { fill, type Task } from "../task.ts";

const skip = !process.env.FALKORDB_URL;
let shop: Shop, browser: Browser, db: Awaited<ReturnType<typeof connect>>, g: Graph;
const name = graphName(`loop-${process.pid}`);
before(async () => {
  if (skip) return;
  shop = await startShop(); db = await connect(); g = db.selectGraph(name); await ensureSchema(g);
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
});
after(async () => {
  await browser?.close(); await shop?.close();
  if (db) { await db.selectGraph(name).delete().catch(() => {}); await db.close(); }
});

/** What a sensible model would pick on each screen (keyed by page title), in order of preference. */
const WANT: Record<string, Array<[role: string, name: string]>> = {
  Home: [["link", "Kitchen"]],
  Kitchen: [["button", "Quick add"], ["link", "Trail Mug"]],
  "Trail Mug": [["button", "Add to basket"]],
  Cart: [["link", "Checkout"]],
};
let standInCalls = 0;
const standIn: Proposer = async ({ obs, known, explore }: ProposeInput) => {
  standInCalls++;
  const wants = WANT[obs.screen.title.split(" | ")[0]] ?? [];
  const isKnown = (role: string, nm: string) => known.some(k => k.role === role && k.name === nm);
  const pick = (explore ? wants.filter(([r, n]) => !isKnown(r, n)) : []).concat(wants)[0];
  const index = pick ? obs.candidates.findIndex(c => c.role === pick[0] && c.name === pick[1]) + 1 : 0;
  return { index, slot: null, tokens: 100 };
};

const task = (): Task => {
  const slots = { product: "Trail Mug" };
  return { id: "shop-checkout", site: "loop", baseUrl: shop.url, start: "/", text: fill("Add the {product} to the cart and reach checkout", slots),
    slots, goal: { path: "/checkout", textIncludes: ["{product}"] } };
};
const go = async (mode: "cold" | "map", explore = false): Promise<RunResult> => {
  const ctx = await browser.newContext();
  try { return await runTask({ graph: g, page: await ctx.newPage(), task: task(), mode, propose: standIn, explore, actionTimeout: 1500 }); }
  finally { await ctx.close(); }
};
const actions = (r: RunResult) => r.steps.map(s => s.action);
const first = async (graph: Graph, q: string) => (await graph.query(q)).data![0] as Record<string, string | number>;

test("the whole story", { skip, timeout: 180_000 }, async () => {
  // 1. cold: nothing known, every step asks the LLM
  const cold = await go("cold");
  assert.equal(cold.outcome, "success");
  assert.deepEqual(actions(cold), ["[link] Kitchen -> click", "[button] Quick add -> click", "[link] Checkout -> click"]);
  assert.equal(cold.llmCalls, 3); assert.equal(cold.mapSteps, 0);

  // 2. map after one cold run: follows the route, zero LLM calls
  standInCalls = 0;
  const warm = await go("map");
  assert.equal(warm.outcome, "success");
  assert.deepEqual(actions(warm), actions(cold));
  assert.equal(warm.llmCalls, 0); assert.equal(standInCalls, 0, "the stand-in must never have been asked");
  assert.equal(warm.mapSteps, 3);

  // 3. explore: a cold run told what the map knows finds the product-page route
  const explore = await go("cold", true);
  assert.equal(explore.outcome, "success");
  assert.deepEqual(actions(explore), ["[link] Kitchen -> click", "[link] Trail Mug -> click", "[button] Add to basket -> click", "[link] Checkout -> click"]);

  // the map now has two routes from Home to the goal screen, shortest first
  const goalSig = (await first(g, "MATCH (s:State)-[:REACHES]->(:Goal) RETURN s.sig"))["s.sig"] as string;
  const home = (await first(g, "MATCH (s:State) WHERE s.title STARTS WITH 'Home' RETURN s.sig"))["s.sig"] as string;
  const routes = await plan(g, home, goalSig);
  assert.deepEqual(routes.map(r => r.hops), [3, 4]);

  // 4. the redesign: quick add stops working. The map run tries the best route, fails that one edge, and detours.
  shop.setLayout("b");
  standInCalls = 0;
  const redesigned = await go("map");
  assert.equal(redesigned.outcome, "success");
  assert.equal(redesigned.llmCalls, 0, "the detour came from the graph, not the LLM");
  assert.equal(standInCalls, 0);
  assert.equal(redesigned.failedMapSteps, 1);
  assert.deepEqual(actions(redesigned), ["[link] Kitchen -> click", "[button] Quick add -> click", "[link] Trail Mug -> click", "[button] Add to basket -> click", "[link] Checkout -> click"]);
  assert.deepEqual(redesigned.steps.map(s => s.ok), [true, false, true, true, true]);

  // 5. the failure is in the graph, and the run that caused it can be found
  const e = await first(g, "MATCH ()-[e:ACT {key:'click:button:quick add:0'}]->() RETURN e.ok, e.fail");
  assert.deepEqual(e, { "e.ok": 2, "e.fail": 1 });
  const failedSteps = (await g.query("MATCH (st:Step {action_key:'click:button:quick add:0', ok:0})-[:OF_RUN]->(r:Run {mode:'map'}) RETURN r.id")).data!;
  assert.equal(failedSteps.length, 1);

  // 6. episodic memory: every run recorded, LLM calls only where they happened
  const runs = (await g.query("MATCH (r:Run) RETURN r.mode AS mode, r.outcome AS outcome, r.llm_calls AS llm ORDER BY r.started")).data as Array<{ mode: string; outcome: string; llm: number }>;
  assert.deepEqual(runs.map(r => [r.mode, r.outcome, r.llm]), [["cold", "success", 3], ["map", "success", 0], ["cold", "success", 4], ["map", "success", 0]]);
  shop.setLayout("a");
});

test("a route through the search box replays from slot names: the typed value is never stored", { skip, timeout: 120_000 }, async () => {
  const other = db.selectGraph(graphName(`loop-search-${process.pid}`));
  const searcher: Proposer = async ({ obs }) => {
    const find = (role: string, nm: string) => obs.candidates.findIndex(c => c.role === role && c.name === nm) + 1;
    const box = obs.candidates.find(c => c.role === "textbox");
    const title = obs.screen.title.split(" | ")[0];
    if (title === "Home") return box && !box.value ? { index: find("textbox", "Search products"), slot: "product", tokens: 1 } : { index: find("button", "Search"), slot: null, tokens: 1 };
    if (title === "Search") return { index: find("button", "Quick add"), slot: null, tokens: 1 };
    return { index: find("link", "Checkout"), slot: null, tokens: 1 };
  };
  try {
    await ensureSchema(other);
    const run = async (mode: "cold" | "map") => {
      const ctx = await browser.newContext();
      try { return await runTask({ graph: other, page: await ctx.newPage(), task: task(), mode, propose: searcher, actionTimeout: 1500 }); }
      finally { await ctx.close(); }
    };
    const cold = await run("cold");
    assert.equal(cold.outcome, "success");
    assert.deepEqual(actions(cold), ["[textbox] Search products -> type", "[button] Search -> click", "[button] Quick add -> click", "[link] Checkout -> click"]);

    const warm = await run("map");
    assert.equal(warm.outcome, "success");
    assert.equal(warm.llmCalls, 0, "the fill was replayed from the edge, not asked of the LLM");
    assert.deepEqual(actions(warm), ["[button] Search -> click", "[button] Quick add -> click", "[link] Checkout -> click"]);

    const e = await first(other, "MATCH ()-[e:ACT {key:'click:button:search:0'}]->() RETURN e.pre, e.ok");
    const pre = JSON.parse(e["e.pre"] as string) as Array<{ slot: string }>;
    assert.deepEqual(pre.map(f => f.slot), ["product"]);
    assert.ok(!(e["e.pre"] as string).includes("Trail"), "the typed value must not be in the graph");
    assert.equal(e["e.ok"], 2);
  } finally { await other.delete().catch(() => {}); }
});

test("a map run with no goal in the map behaves like cold: it asks the LLM",{ skip, timeout: 60_000 }, async () => {
  const other = db.selectGraph(graphName(`loop-empty-${process.pid}`));
  try {
    await ensureSchema(other);
    const ctx = await browser.newContext();
    const r = await runTask({ graph: other, page: await ctx.newPage(), task: task(), mode: "map", propose: standIn, actionTimeout: 1500 });
    await ctx.close();
    assert.equal(r.outcome, "success"); assert.equal(r.mapSteps, 0); assert.equal(r.llmCalls, 3);
  } finally { await other.delete().catch(() => {}); }
});

test("a model that answers with a number off the list costs a step, not a crash; the run ends at maxSteps", { skip, timeout: 60_000 }, async () => {
  const other = db.selectGraph(graphName(`loop-bad-${process.pid}`));
  try {
    await ensureSchema(other);
    const ctx = await browser.newContext();
    const r = await runTask({ graph: other, page: await ctx.newPage(), task: task(), mode: "cold", maxSteps: 3,
      propose: async () => ({ index: 99, slot: null, tokens: 1 }) });
    await ctx.close();
    assert.equal(r.outcome, "failure"); assert.equal(r.steps.length, 0); assert.equal(r.llmCalls, 3);
    assert.deepEqual(await first(other, "MATCH (r:Run) RETURN r.outcome AS o, r.llm_calls AS l"), { o: "failure", l: 3 });
  } finally { await other.delete().catch(() => {}); }
});
