// Needs a FalkorDB: FALKORDB_URL=redis://127.0.0.1:6390 npm test. Skipped otherwise.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { connect, endRun, ensureSchema, goalCandidates, graphName, outgoing, recordReach, recordStep, report, startRun,
  type ReportParams, type Screen } from "../graph.ts";

const run = `e${process.pid}`;
const skip = !(process.env.FALKORDB_URL || process.env.FALKORDB_HOST);
let db: Awaited<ReturnType<typeof connect>>;
const made: string[] = [];
const graph = (site: string) => { const n = graphName(`${site}-${run}`); made.push(n); return db.selectGraph(n); };
before(async () => { if (!skip) db = await connect(); });
after(async () => { if (!skip) { for (const n of made) await db.selectGraph(n).delete().catch(() => {}); await db.close(); } });

type Gr = ReturnType<typeof graph>;
const count = async (g: Gr, q: string) => Object.values((await g.query(q)).data![0] as Record<string, number>)[0];
const screen = (sig: string): Screen => ({ sig, urlTemplate: `https://x/${sig}`, title: sig, landmarks: [`link:${sig}`] });
const edge = (from: string, to: string, key: string, ok: 0 | 1): ReportParams => ({
  from, fromUrl: `https://x/${from}`, fromTitle: from, fromLandmarks: [], to, toUrl: `https://x/${to}`, toTitle: to, toLandmarks: [],
  key, kind: "click", role: "link", name: key, nth: 0, label: "", ok, fail: (1 - ok) as 0 | 1, ms: 50, now: 1 });

test("a run, its steps and the edge they walked can be read back through explain.cypher", { skip }, async () => {
  const g = graph("episodic"); await ensureSchema(g);
  await startRun(g, { id: "r1", agent: "a1", task: "t", mode: "cold", now: 10 });
  await report(g, edge("A", "B", "k1", 1));
  await recordStep(g, { run: "r1", i: 1, key: "k1", ok: true, ms: 50, source: "llm", from: screen("A"), to: screen("B"), observed: "B", now: 10 });
  await endRun(g, { id: "r1", now: 20, outcome: "success", steps: 1, llm: 1, tokens: 99, ms: 500 });

  const run = (await g.query("MATCH (r:Run {id:'r1'}) RETURN r.outcome, r.steps, r.llm_calls, r.tokens, r.ms, r.tenant")).data![0] as Record<string, unknown>;
  assert.deepEqual(run, { "r.outcome": "success", "r.steps": 1, "r.llm_calls": 1, "r.tokens": 99, "r.ms": 500, "r.tenant": "" });

  const explain = await g.roQuery(
    "MATCH (a:State {sig:$from})-[e:ACT {key:$key}]->(b:State) MATCH (st:Step)-[:FROM]->(a), (st)-[:TO]->(b), (st)-[:OF_RUN]->(r:Run) WHERE st.action_key = $key RETURN r.id, st.ok, st.source",
    { params: { from: "A", key: "k1" } });
  assert.deepEqual(explain.data, [{ "r.id": "r1", "st.ok": 1, "st.source": "llm" }]);
});

test("a failed map step is attributed to the edge it expected to walk, not the screen it landed on", { skip }, async () => {
  const g = graph("failed"); await ensureSchema(g);
  await startRun(g, { id: "r2", agent: "a1", task: "t", mode: "map", now: 10 });
  await report(g, edge("A", "B", "k1", 0));
  await recordStep(g, { run: "r2", i: 1, key: "k1", ok: false, ms: 3000, source: "map", from: screen("A"), to: screen("B"), observed: "A", now: 11 });
  const r = (await g.query("MATCH (st:Step)-[:FROM]->(a:State), (st)-[:TO]->(b:State) RETURN a.sig, b.sig, st.ok, st.observed")).data;
  assert.deepEqual(r, [{ "a.sig": "A", "b.sig": "B", "st.ok": 0, "st.observed": "A" }]);
  // recording the step created no extra edge
  assert.equal(await count(g, "MATCH ()-[e:ACT]->() RETURN count(e)"), 1);
});

test("a step does not create a duplicate state, and a step without an edge leaves no ACT behind", { skip }, async () => {
  const g = graph("noedge"); await ensureSchema(g);
  await startRun(g, { id: "r3", agent: "a1", task: "t", mode: "cold", now: 10 });
  await recordStep(g, { run: "r3", i: 1, key: "click:button:nothing:0", ok: false, ms: 10, source: "llm", from: screen("A"), to: screen("A"), observed: "A", now: 10 });
  await recordStep(g, { run: "r3", i: 2, key: "click:button:nothing:0", ok: false, ms: 10, source: "llm", from: screen("A"), to: screen("A"), observed: "A", now: 10 });
  assert.equal(await count(g, "MATCH (s:State) RETURN count(s)"), 1);
  assert.equal(await count(g, "MATCH ()-[e:ACT]->() RETURN count(e)"), 0);
  assert.equal(await count(g, "MATCH (st:Step) RETURN count(st)"), 2);
});

test("recordReach creates the goal once, counts repeats, and is found by free text", { skip }, async () => {
  const g = graph("goal"); await ensureSchema(g);
  await report(g, edge("A", "DONE", "k1", 1));
  const p = { id: "shop-checkout", text: "add the Trail Mug to the cart and reach checkout", site: "testshop", sig: "DONE", now: 5 };
  assert.equal(await recordReach(g, p), 1);
  assert.equal(await recordReach(g, { ...p, now: 6 }), 2);
  assert.equal(await count(g, "MATCH (g:Goal) RETURN count(g)"), 1);
  const found = await goalCandidates(g, "Please add a trail mug to my cart, then check out!");
  assert.equal(found[0]?.goalSig, "DONE");
  assert.equal(found[0]?.times, 2);
});

test("outgoing lists what the map knows from a screen, most-walked first", { skip }, async () => {
  const g = graph("outgoing"); await ensureSchema(g);
  await report(g, edge("A", "B", "rare", 1));
  for (let i = 0; i < 3; i++) await report(g, edge("A", "C", "common", 1));
  const known = await outgoing(g, "A");
  assert.deepEqual(known.map(k => [k.key, k.to, k.ok]), [["common", "C", 3], ["rare", "B", 1]]);
  assert.deepEqual(await outgoing(g, "nowhere"), []);
});

test("report stores the slot, and an absent slot is ''", { skip }, async () => {
  const g = graph("slot"); await ensureSchema(g);
  await report(g, { ...edge("A", "B", "type", 1), slot: "query" });
  await report(g, edge("A", "C", "plain", 1));
  const r = (await g.query("MATCH ()-[e:ACT]->() RETURN e.key, e.slot ORDER BY e.key")).data;
  assert.deepEqual(r, [{ "e.key": "plain", "e.slot": "" }, { "e.key": "type", "e.slot": "query" }]);
});
