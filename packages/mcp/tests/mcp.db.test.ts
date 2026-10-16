// The MCP server end to end: a real MCP client over Streamable HTTP against a real FalkorDB.
// Needs FALKORDB_URL or FALKORDB_HOST (.env is loaded by `npm test`). Skipped otherwise.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { connect, ensureSchema, graphName, recordReach, report, type ReportParams } from "../../core/graph.ts";
import { actionKey, signature } from "../../core/signature.ts";
import { startHttp } from "../server.ts";

const skip = !(process.env.FALKORDB_URL || process.env.FALKORDB_HOST);
const site = `mcp-${process.pid}.test`;
const TOKEN = "t0ken-for-tests";
let db: Awaited<ReturnType<typeof connect>>, http: Awaited<ReturnType<typeof startHttp>>;
const made = [graphName(site), graphName(site, "acme"), graphName(`new-${process.pid}.test`)];

const sigOf = (n: string) => signature(`https://${site}/${n}`, [`link:${n}`]);
const [A, B, C, GOAL] = ["a", "b", "c", "goal"].map(sigOf);
const edge = (from: string, to: string, name: string, ok: 0 | 1): ReportParams => ({
  from, fromUrl: "u", fromTitle: from, fromLandmarks: [], to, toUrl: "u", toTitle: to, toLandmarks: [],
  key: actionKey("click", "link", name, 0), kind: "click", role: "link", name, nth: 0, label: "", ok, fail: (1 - ok) as 0 | 1, ms: 100, now: 1 });

async function client(token?: string) {
  const c = new Client({ name: "test", version: "0" });
  await c.connect(new StreamableHTTPClientTransport(new URL(http.url), token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : undefined));
  return c;
}
const call = async (c: Client, name: string, args: Record<string, unknown>) => {
  const r = await c.callTool({ name, arguments: args }) as { isError?: boolean; content: Array<{ text: string }> };
  return { error: !!r.isError, body: r.isError ? r.content[0].text : JSON.parse(r.content[0].text) };
};
const one = async (q: string, params: Record<string, unknown> = {}, graph = graphName(site)) =>
  Object.values((await db.selectGraph(graph).query(q, { params: params as never })).data![0] as Record<string, number>)[0];

before(async () => {
  if (skip) return;
  db = await connect();
  const g = db.selectGraph(graphName(site)); await ensureSchema(g);
  for (const [f, t, n] of [[A, B, "to-b"], [B, GOAL, "to-goal"], [A, C, "to-c"], [C, GOAL, "slow"]] as const) for (let i = 0; i < 3; i++) await report(g, edge(f, t, n, 1));
  await recordReach(g, { id: "g1", text: "reach the goal screen", site, sig: GOAL, now: 1 });
  http = await startHttp(db, { allowNewSites: false, writableSites: [site] }, 0, TOKEN);
});
after(async () => {
  await http?.close();
  if (db) { for (const n of made) await db.selectGraph(n).delete().catch(() => {}); await db.close(); }
});

test("the server lists exactly the five tools of the plan", { skip }, async () => {
  const c = await client(TOKEN);
  assert.deepEqual((await c.listTools()).tools.map(t => t.name).sort(), ["explain", "map_stats", "observe", "plan", "report"]);
  await c.close();
});

test("plan returns routes best-first with the steps to take; an unknown screen or goal says so instead of guessing", { skip }, async () => {
  const c = await client();
  const ok = await call(c, "plan", { site, task: "reach the goal screen", current_sig: A });
  assert.equal(ok.body.source, "public");
  assert.equal(ok.body.routes.length, 2);
  assert.deepEqual(ok.body.routes[0].steps.map((s: { name: string }) => s.name), ["to-b", "to-goal"]);
  assert.ok(ok.body.routes[0].p_success > 0 && ok.body.routes[0].p_success <= 1);
  const unknownScreen = await call(c, "plan", { site, task: "reach the goal screen", current_sig: "0000000000000000" });
  assert.deepEqual(unknownScreen.body.routes, []); assert.match(unknownScreen.body.reason, /no known route/);
  const unknownGoal = await call(c, "plan", { site, task: "buy a unicorn", current_sig: A });
  assert.match(unknownGoal.body.reason, /no known goal/);
  await c.close();
});

test("observe computes the same signature the agent does, and knows the stored screens", { skip }, async () => {
  const c = await client();
  const r = await call(c, "observe", { site, url: `https://${site}/a`, landmarks: ["link:a"] });
  assert.equal(r.body.sig, A); assert.equal(r.body.known, true);
  const fresh = await call(c, "observe", { site, url: `https://${site}/never`, landmarks: ["link:never"] });
  assert.equal(fresh.body.known, false);
  await c.close();
});

test("report needs the write token over HTTP, validates input, and refuses sites it was not told to write", { skip }, async () => {
  const anon = await client();
  await assert.rejects(call(anon, "report", { site, run_id: "r0", from_sig: A, to_sig: B, ok: true, ms: 5, action: { kind: "click", role: "link", name: "to-b", nth: 0 } }));
  await anon.close();
  const c = await client(TOKEN);
  const bad = await call(c, "report", { site, run_id: "r0", from_sig: "nope", to_sig: B, ok: true, ms: 5, action: { kind: "click", role: "link", name: "x", nth: 0 } }).catch(() => ({ error: true, body: "" }));
  assert.equal(bad.error, true);
  const other = await call(c, "report", { site: "elsewhere.test", run_id: "r0", from_sig: A, to_sig: B, ok: true, ms: 5, action: { kind: "click", role: "link", name: "x", nth: 0 } });
  assert.equal(other.error, true); assert.match(other.body, /not enabled|no map exists/);
  const evil = await call(c, "plan", { site: "x`) MATCH (n) DETACH DELETE n //", task: "reach the goal screen", current_sig: A }).catch(() => ({ error: true, body: "" }));
  assert.equal(evil.error, true);
  assert.equal(await one("MATCH (s:State) RETURN count(s) AS n"), 4);
  await c.close();
});

test("report then explain: the edge counts move and the run that moved them is on record", { skip }, async () => {
  const c = await client(TOKEN);
  const r = await call(c, "report", { site, run_id: "mcp-run-1", agent: "claude-code", task: "reach the goal screen", from_sig: A, to_sig: B, ok: true, ms: 80,
    action: { kind: "click", role: "link", name: "to-b", nth: 0 } });
  assert.equal(r.body.edge.ok, 4);
  const failed = await call(c, "report", { site, run_id: "mcp-run-1", from_sig: A, to_sig: B, ok: false, ms: 900, action: { kind: "click", role: "link", name: "to-b", nth: 0 } });
  assert.deepEqual([failed.body.edge.ok, failed.body.edge.fail, failed.body.step], [4, 1, 2]);
  const why = await call(c, "explain", { site, from_sig: A, action_key: r.body.key });
  assert.deepEqual(why.body.runs.map((x: { run: string; ok: boolean }) => [x.run, x.ok]).sort(), [["mcp-run-1", false], ["mcp-run-1", true]]);
  await c.close();
});

test("map_stats reports the size of the map", { skip }, async () => {
  const c = await client();
  const s = await call(c, "map_stats", { site });
  assert.equal(s.body.public.states, 4); assert.equal(s.body.public.edges, 4); assert.equal(s.body.public.goals, 1);
  assert.equal((await call(c, "map_stats", { site: "never-mapped.test" })).error, true);
  await c.close();
});

test("a tenant overlay is planned first when it is cheaper, and tenant reports never reach the public map", { skip }, async () => {
  const c = await client(TOKEN);
  const pubEdges = () => one("MATCH ()-[e:ACT]->() RETURN count(e) AS n");
  const before = await pubEdges();
  const t = db.selectGraph(graphName(site, "acme")); await ensureSchema(t);
  for (let i = 0; i < 12; i++) await report(t, edge(A, GOAL, "private-shortcut", 1));    // a private one-hop route, well worn
  await recordReach(t, { id: "g1", text: "reach the goal screen", site, sig: GOAL, now: 1 });
  const mine = await call(c, "plan", { site, task: "reach the goal screen", current_sig: A, tenant: "acme" });
  assert.equal(mine.body.source, "tenant");
  assert.deepEqual(mine.body.routes[0].steps.map((s: { name: string }) => s.name), ["private-shortcut"]);
  const everyone = await call(c, "plan", { site, task: "reach the goal screen", current_sig: A });
  assert.equal(everyone.body.source, "public");
  assert.ok(!JSON.stringify(everyone.body).includes("private-shortcut"), "the private route must not appear for a caller with no tenant");
  const wrote = await call(c, "report", { site, tenant: "acme", run_id: "t1", from_sig: B, to_sig: GOAL, ok: true, ms: 10, action: { kind: "click", role: "link", name: "tenant-only", nth: 0 } });
  assert.equal(wrote.error, false);
  assert.equal(await pubEdges(), before, "a tenant report must not write to the public graph");
  await c.close();
});

test("three clients writing the same edge at once lose no updates", { skip }, async () => {
  const clients = await Promise.all([client(TOKEN), client(TOKEN), client(TOKEN)]);
  const key = actionKey("click", "link", "to-c", 0);
  const okCount = () => one("MATCH ()-[e:ACT {key: $k}]->() RETURN e.ok AS n", { k: key });
  const start = await okCount();
  await Promise.all(clients.map((c, ci) => (async () => {
    for (let i = 0; i < 8; i++) {
      const r = await call(c, "report", { site, run_id: `conc-${ci}`, from_sig: A, to_sig: C, ok: true, ms: 10, action: { kind: "click", role: "link", name: "to-c", nth: 0 } });
      assert.equal(r.error, false);
    }
  })()));
  assert.equal((await okCount()) - start, 24);
  for (let ci = 0; ci < 3; ci++) assert.equal(await one("MATCH (s:Step {run: $r}) RETURN count(s) AS n", { r: `conc-${ci}` }), 8);
  await Promise.all(clients.map(c => c.close()));
});

test("new sites are created only when the operator allows it", { skip }, async () => {
  const fresh = `new-${process.pid}.test`;
  const open = await startHttp(db, { allowNewSites: true }, 0, undefined);
  const c = new Client({ name: "t", version: "0" });
  await c.connect(new StreamableHTTPClientTransport(new URL(open.url)));
  const r = await call(c, "report", { site: fresh, run_id: "n1", from_sig: A, to_sig: B, ok: true, ms: 1, action: { kind: "click", role: "link", name: "x", nth: 0 } });
  assert.equal(r.error, false);
  assert.ok((await db.list()).includes(graphName(fresh)));
  await c.close(); await open.close();
});
