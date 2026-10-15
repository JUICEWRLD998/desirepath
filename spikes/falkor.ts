// P0: FalkorDB Cloud spike. Records raw output of every check to spikes/out/falkor.json.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { FalkorDB } from "falkordb";

const url = process.env.FALKORDB_URL;
if (!url) throw new Error("FALKORDB_URL missing (see .env.example)");
const out: Record<string, unknown> = {};
const db = await FalkorDB.connect({ url });
const step = async (name: string, fn: () => Promise<unknown>) => {
  try { out[name] = { ok: true, result: await fn() }; }
  catch (e) { out[name] = { ok: false, error: (e as Error).message }; }
  console.log(name, JSON.stringify(out[name]).slice(0, 400));
};

await step("version", async () => (await db.configGet("*")).length);
const t0 = performance.now();
const g = db.selectGraph("p0_toy");
await step("roundtrip", async () => { await g.query("RETURN 1"); return { ms: performance.now() - t0 }; });
await g.delete().catch(() => {});

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

// two graphs, one request-time pair
await step("two_graphs", async () => {
  const a = db.selectGraph("public:x"), b = db.selectGraph("tenant:a:x");
  await a.query("CREATE (:State {sig:'pub'})"); await b.query("CREATE (:State {sig:'ten'})");
  const [ra, rb] = await Promise.all([a.query("MATCH (s:State) RETURN s.sig"), b.query("MATCH (s:State) RETURN s.sig")]);
  await a.delete(); await b.delete();
  return { public: ra.data, tenant: rb.data };
});
await g.delete().catch(() => {});
writeFileSync("spikes/out/falkor.json", JSON.stringify(out, null, 2));
await db.close();
