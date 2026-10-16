// Load the human-paved layer (plan §11): Mind2Web tasks become read-only graphs m2w:<site>.
//   python scripts/measure_reuse.py --export data/m2w.json      once (needs duckdb)
//   npm run pave                                                 all sites;  npm run pave -- --sites united,yelp,resy
// A state is a position in a task: the sequence of normalised actions taken so far (so tasks that start the same way
// share states). An edge is the next action; its weight `ok` is how many human tasks walked it. Typed values are
// already masked ("[searchbox] find a location -> type"). Mind2Web (Deng et al., 2023), CC-BY-4.0.
// It deletes and rewrites ONLY the graphs named m2w:<site>.
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { connect, m2wGraphName } from "../packages/core/graph.ts";
import { risk } from "../packages/core/risk.ts";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const file = arg("file") ?? "data/m2w.json";
const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, string[][]>;
const only = arg("sites")?.split(",");
const sites = Object.keys(data).filter(s => /^[A-Za-z0-9._-]+$/.test(s) && (!only || only.includes(s)));
if (!sites.length) { console.error("no matching sites in " + file); process.exit(2); }

const sig = (site: string, prefix: string[]) => createHash("sha1").update(site + "\u0000" + prefix.join("\u0001")).digest("hex").slice(0, 16);
/** "[button] search -> click" */
function parse(action: string) {
  const m = /^\[([^\]]*)\]\s*(.*?)\s*->\s*(\w+)$/.exec(action);
  return { role: m?.[1] ?? "", name: m?.[2] ?? action, kind: (m?.[3] ?? "click").toLowerCase() };
}

const db = await connect();
let totalEdges = 0, totalStates = 0, totalTasks = 0;
const t0 = Date.now();
try {
  for (const site of sites) {
    const rows = new Map<string, { from: string; to: string; key: string; toTitle: string; n: number }>();
    const states = new Set<string>();
    for (const steps of data[site]) {
      totalTasks++;
      for (let k = 0; k < steps.length; k++) {
        const from = sig(site, steps.slice(0, k)), to = sig(site, steps.slice(0, k + 1));
        states.add(from); states.add(to);
        const id = `${from}|${steps[k]}`;
        const row = rows.get(id);
        if (row) row.n++; else rows.set(id, { from, to, key: steps[k], toTitle: steps[k], n: 1 });
      }
    }
    const g = db.selectGraph(m2wGraphName(site));
    await g.delete().catch(() => {});
    await g.query("CREATE INDEX FOR (s:State) ON (s.sig)");
    const list = [...rows.values()].map(r => ({ ...r, ...parse(r.key), risk: risk(r.n, 0) }));
    for (let i = 0; i < list.length; i += 400) {
      await g.query(`UNWIND $rows AS r
        MERGE (a:State {sig: r.from}) ON CREATE SET a.url_template = '', a.title = '', a.landmarks = [], a.first_seen = $now, a.visits = 0
        MERGE (b:State {sig: r.to}) ON CREATE SET b.url_template = '', b.title = r.toTitle, b.landmarks = [], b.first_seen = $now, b.visits = 0
        MERGE (a)-[e:ACT {key: r.key}]->(b)
          ON CREATE SET e.kind = r.kind, e.role = r.role, e.name = r.name, e.nth = 0, e.label = r.key, e.slot = '', e.pre = '',
                        e.ok = r.n, e.fail = 0, e.ms = 0.0, e.risk = r.risk, e.last_seen = $now`,
        { params: { rows: list.slice(i, i + 400), now: Date.now() } as never });
    }
    totalEdges += list.length; totalStates += states.size;
    console.log(`${site.padEnd(22)} tasks ${String(data[site].length).padStart(3)}  states ${String(states.size).padStart(4)}  edges ${String(list.length).padStart(4)}`);
  }
  // size check against the Cloud free tier (100 MB): FalkorDB reports per-graph megabytes
  let mb = 0;
  for (const site of sites) {
    const m = await db.selectGraph(m2wGraphName(site)).memoryUsage() as unknown as Array<string | number>;
    mb += Number(m[m.indexOf("total_graph_sz_mb") + 1] ?? 0);
  }
  console.log(`\n${sites.length} sites, ${totalTasks} tasks, ${totalStates} states, ${totalEdges} edges, ${((Date.now() - t0) / 1000).toFixed(0)} s; FalkorDB reports ${mb} MB (free tier: 100 MB)`);
} finally { await db.close(); }
