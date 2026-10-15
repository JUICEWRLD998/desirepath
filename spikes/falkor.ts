// P0: FalkorDB Cloud spike. Records raw output of every check to spikes/out/falkor.json.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("spikes/out", { recursive: true });
import { FalkorDB } from "falkordb";

const { FALKORDB_URL, FALKORDB_HOST, FALKORDB_PORT, FALKORDB_USERNAME, FALKORDB_PASSWORD, FALKORDB_TLS } = process.env;
// Either FALKORDB_URL, or the separate FALKORDB_* fields (avoids URL-encoding problems with special characters in the password).
const options = FALKORDB_HOST
  ? { username: FALKORDB_USERNAME || "default", password: FALKORDB_PASSWORD,
      socket: { host: FALKORDB_HOST, port: Number(FALKORDB_PORT || 6379), tls: FALKORDB_TLS === "true" } }
  : FALKORDB_URL ? { url: FALKORDB_URL } : null;
if (!options) throw new Error("Set FALKORDB_URL or FALKORDB_HOST (see .env.example)");
const out: Record<string, unknown> = {};
const db = await FalkorDB.connect(options).catch((e: Error) => {
  console.error("FalkorDB connection failed:", e.message);
  if (/WRONGPASS/.test(e.message)) console.error("The host answered but rejected the username/password. Re-copy them from the FalkorDB Cloud instance page.");
  process.exit(1);
});
db.on("error", (e: Error) => console.error("FalkorDB error:", e.message));
const step = async (name: string, fn: () => Promise<unknown>) => {
  try { out[name] = { ok: true, result: await fn() }; }
  catch (e) { out[name] = { ok: false, error: (e as Error).message }; }
  console.log(name, JSON.stringify(out[name]).slice(0, 400));
};

const runId = randomUUID().replaceAll("-", "");
const toyName = `p0_toy_${runId}`;
const publicName = `public:p0_${runId}`;
const tenantName = `tenant:p0_${runId}:x`;
const g = db.selectGraph(toyName);
const graphs = [g, db.selectGraph(publicName), db.selectGraph(tenantName)];

try {
  await step("server_info", async () => db.info("server"));
  const t0 = performance.now();
  await step("roundtrip", async () => { await g.query("RETURN 1"); return { ms: performance.now() - t0 }; });

  // 6-node toy graph: A->B->F (2 hops, flaky), A->C->D->F (3 hops, reliable), A->E->F (2 hops, medium)
  await g.query(`CREATE (a:S {n:'A'}),(b:S {n:'B'}),(c:S {n:'C'}),(d:S {n:'D'}),(e:S {n:'E'}),(f:S {n:'F'}),
    (a)-[:ACT {key:'ab',risk:1.5,ms:100.0}]->(b),(b)-[:ACT {key:'bf',risk:1.5,ms:100.0}]->(f),
    (a)-[:ACT {key:'ac',risk:0.1,ms:100.0}]->(c),(c)-[:ACT {key:'cd',risk:0.1,ms:100.0}]->(d),(d)-[:ACT {key:'df',risk:0.1,ms:100.0}]->(f),
    (a)-[:ACT {key:'ae',risk:0.6,ms:100.0}]->(e),(e)-[:ACT {key:'ef',risk:0.6,ms:100.0}]->(f)`);

  await step("SPpaths_float_weight_pathCount3", async () => {
    const r = await g.query(`MATCH (s:S {n:'A'}),(t:S {n:'F'})
      CALL algo.SPpaths({sourceNode:s,targetNode:t,relTypes:['ACT'],weightProp:'risk',costProp:'ms',maxCost:1000,pathCount:3})
      YIELD path,pathWeight,pathCost
      RETURN [r IN relationships(path) | r.key] AS keys, pathWeight, pathCost ORDER BY pathWeight ASC`);
    return r.data;
  });
  await step("log_function", async () => (await g.query("RETURN -log(0.5) AS x")).data);
  await step("fulltext_create", async () => (await g.query("CALL db.idx.fulltext.createNodeIndex('Goal','text')")).data);
  await g.query("CREATE (:Goal {id:'g1', text:'cheapest book in travel category'})");
  await step("fulltext_query", async () => (await g.query("CALL db.idx.fulltext.queryNodes('Goal','travel') YIELD node,score RETURN node.id,score")).data);
  await step("pagerank", async () => (await g.query("CALL algo.pageRank('S','ACT') YIELD node,score RETURN node.n,score ORDER BY score DESC")).data);
  await step("wcc", async () => (await g.query("CALL algo.WCC({nodeLabels:['S'],relationshipTypes:['ACT']}) YIELD node,componentId RETURN node.n,componentId")).data);

  // Unique graph names ensure cleanup cannot delete an existing user's graph.
  await step("two_graphs", async () => {
    const [publicGraph, tenantGraph] = graphs.slice(1);
    await publicGraph.query("CREATE (:State {sig:'pub'})");
    await tenantGraph.query("CREATE (:State {sig:'ten'})");
    const [ra, rb] = await Promise.all([
      publicGraph.query("MATCH (s:State) RETURN s.sig"),
      tenantGraph.query("MATCH (s:State) RETURN s.sig"),
    ]);
    return { public: ra.data, tenant: rb.data };
  });
  const required = ["server_info", "roundtrip", "SPpaths_float_weight_pathCount3", "log_function",
    "fulltext_create", "fulltext_query", "pagerank", "wcc", "two_graphs"];
  out.summary = Object.fromEntries(required.map(name => [name, (out[name] as { ok: boolean }).ok]));
  writeFileSync("spikes/out/falkor.json", JSON.stringify(out, null, 2));
  if (required.some(name => !(out[name] as { ok: boolean }).ok)) process.exitCode = 1;
} finally {
  for (const graph of graphs) {
    try { await graph.delete(); }
    catch (e) { console.error("Temporary graph cleanup failed:", (e as Error).message); }
  }
  await db.close();
}
