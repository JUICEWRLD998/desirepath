// Needs a FalkorDB: FALKORDB_URL=redis://127.0.0.1:6390 npm test. Skipped otherwise.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { connect, ensureSchema, ftQuery, goalCandidates, graphName, plan, report, type ReportParams } from "../graph.ts";

const run = `t${process.pid}`;
const skip = !process.env.FALKORDB_URL;
let db: Awaited<ReturnType<typeof connect>>;
const made: string[] = [];
const graph = (site: string, tenant?: string) => { const n = graphName(`${site}-${run}`, tenant); made.push(n); return db.selectGraph(n); };
before(async () => { if (!skip) db = await connect(); });
after(async () => { if (!skip) { for (const n of made) await db.selectGraph(n).delete().catch(() => {}); await db.close(); } });

const edge = (from: string, to: string, ok: 0 | 1, ms = 100): ReportParams => ({
  from, fromUrl: `u/${from}`, fromTitle: from, fromLandmarks: [], to, toUrl: `u/${to}`, toTitle: to, toLandmarks: [],
  key: `click:link:${from}-${to}:0`, kind: "click", role: "link", name: `${from}-${to}`, nth: 0, label: "", ok, fail: (1 - ok) as 0 | 1, ms, now: 1 });
async function walk(g: ReturnType<typeof graph>, from: string, to: string, ok: number, fail: number) {
  for (let i = 0; i < ok; i++) await report(g, edge(from, to, 1));
  for (let i = 0; i < fail; i++) await report(g, edge(from, to, 0));
}

test("planner prefers a 3-hop reliable route over a 2-hop flaky one", { skip }, async () => {
  const g = graph("reliable");
  await walk(g, "A", "B", 2, 8); await walk(g, "B", "F", 2, 8);                       // flaky, 2 hops
  await walk(g, "A", "C", 20, 0); await walk(g, "C", "D", 20, 0); await walk(g, "D", "F", 20, 0); // reliable, 3 hops
  const routes = await plan(g, "A", "F");
  assert.equal(routes.length, 2);
  assert.deepEqual(routes[0].steps.map(s => s.to), ["C", "D", "F"]);
  assert.equal(routes[0].hops, 3);
  assert.ok(routes[0].pSuccess > 0.6 && routes[1].pSuccess < 0.6, `p: ${routes.map(r => r.pSuccess)}`);
  assert.ok(routes[0].weight < routes[1].weight);
});

test("a failed edge makes the second route win", { skip }, async () => {
  const g = graph("reroute");
  await walk(g, "A", "F", 10, 0);                                       // direct, worn
  await walk(g, "A", "C", 10, 0); await walk(g, "C", "F", 10, 0);       // detour
  assert.deepEqual((await plan(g, "A", "F"))[0].steps.map(s => s.to), ["F"]);
  await walk(g, "A", "F", 0, 15);                                       // the site changed; direct edge now fails
  const after = await plan(g, "A", "F");
  assert.deepEqual(after[0].steps.map(s => s.to), ["C", "F"]);
  assert.deepEqual(after[1].steps.map(s => s.to), ["F"]);
});

test("tenant graphs never leak into public (and the reverse)", { skip }, async () => {
  const pub = graph("shop"), ten = graph("shop", "acme");
  assert.notEqual(graphName("shop", "acme"), graphName("shop"));
  await walk(ten, "A", "B", 3, 0);
  assert.deepEqual(await plan(pub, "A", "B"), []);
  assert.equal(((await pub.query("MATCH (n) RETURN count(n)")).data![0] as Record<string, number>)["count(n)"], 0);
  await walk(pub, "X", "Y", 1, 0);
  assert.deepEqual(await plan(ten, "X", "Y"), []);
  assert.equal((await plan(ten, "A", "B")).length, 1);
});

test("unknown screens and identical start/goal give no routes instead of errors", { skip }, async () => {
  const g = graph("empty");
  assert.deepEqual(await plan(g, "nope", "nada"), []);
  await walk(g, "A", "B", 1, 0);
  assert.deepEqual(await plan(g, "A", "A"), []);
});

test("goal lookup works with free text and punctuation", { skip }, async () => {
  const g = graph("goals");
  await ensureSchema(g); await ensureSchema(g);               // idempotent
  await g.query("CREATE (s:State {sig:'S1'}), (x:Goal {id:'g1', text:'find the cheapest book in the travel category'}), (s)-[:REACHES {count: 2}]->(x)");
  for (const text of ["Find the cheapest TRAVEL book?", "travel: cheapest -book", "cheapest"]) {
    const r = await goalCandidates(g, text);
    assert.equal(r[0]?.goalSig, "S1", text);
  }
  assert.deepEqual(await goalCandidates(g, "???"), []);
  assert.equal(ftQuery("Find the cheapest TRAVEL book?"), "cheapest|travel|book");
});

test("graphName rejects characters that could escape the namespace", () => {
  assert.throws(() => graphName("a b")); assert.throws(() => graphName("x", "a:b")); assert.throws(() => graphName("x", "t/../y"));
});

test("report refuses an ambiguous outcome", { skip }, async () => {
  const g = graph("bad");
  await assert.rejects(report(g, { ...edge("A", "B", 1), fail: 1 }));
});
