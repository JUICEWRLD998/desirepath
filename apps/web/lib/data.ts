import "dotenv/config";
// Server-side reads for the dashboard. Every function only reads; no graph is ever created (a GRAPH.QUERY on a missing key would create it).
import { connect, type Db } from "../../../packages/core/graph.ts";
import { planRoute } from "../../../packages/mcp/tools.ts";

let dbp: Promise<Db> | undefined;
const db = () => (dbp ??= connect());

let listed: { at: number; names: Promise<string[]> } | undefined;
/** Which graphs exist, cached for 10 s: every read checks it first and each check is a network round trip. */
const graphs = async () => {
  if (!listed || Date.now() - listed.at > 10_000) listed = { at: Date.now(), names: db().then(d => d.list()) };
  return listed.names;
};
const rows = async (g: string, q: string, params: Record<string, string | number> = {}) => {
  if (!(await graphs()).includes(g)) return [] as Array<Record<string, any>>;
  return ((await (await db()).selectGraph(g).query(q, { params })).data ?? []) as Array<Record<string, any>>;
};
const one = async (g: string, q: string) => (await rows(g, q))[0] ?? {};

export async function sites() {
  const names = (await graphs()).filter(n => n.startsWith("public:")).sort();
  return Promise.all(names.map(async n => {
    const [s, e, r, gl] = await Promise.all([
      one(n, "MATCH (s:State) RETURN count(s) AS n"), one(n, "MATCH ()-[e:ACT]->() RETURN count(e) AS n"),
      one(n, "MATCH (r:Run) RETURN count(r) AS n"), one(n, "MATCH (g:Goal) RETURN count(g) AS n")]);
    return { site: n.slice("public:".length), states: s.n ?? 0, edges: e.n ?? 0, runs: r.n ?? 0, goals: gl.n ?? 0 };
  }));
}

export async function mapOf(site: string) {
  const g = `public:${site}`;
  const [nodes, edges, goals] = await Promise.all([rows(g, "MATCH (s:State) RETURN s.sig AS sig, s.url_template AS url, s.title AS title, s.visits AS visits, s.first_seen AS first ORDER BY s.first_seen"), rows(g, "MATCH (a:State)-[e:ACT]->(b:State) RETURN a.sig AS from, b.sig AS to, e.key AS key, e.label AS label, e.name AS name, e.role AS role, e.ok AS ok, e.fail AS fail, e.risk AS risk, e.ms AS ms, e.last_seen AS last"), rows(g, "MATCH (s:State)-[r:REACHES]->(g:Goal) RETURN s.sig AS sig, g.id AS id, g.text AS text, r.count AS times")]);
  return { nodes, edges, goals };
}

export async function explainOf(site: string, from: string, key: string) {
  return (await rows(`public:${site}`, `MATCH (a:State {sig: $from})-[e:ACT {key: $key}]->(b:State)
    MATCH (st:Step)-[:FROM]->(a), (st)-[:TO]->(b), (st)-[:OF_RUN]->(r:Run)
    WHERE st.action_key = $key
    RETURN r.id AS run, r.agent AS agent, r.mode AS mode, r.task AS task, st.ok AS ok, st.ms AS ms, st.source AS source, r.started AS at ORDER BY r.started DESC LIMIT 12`, { from, key }));
}

export async function runsOf(site: string) {
  return rows(`public:${site}`, "MATCH (r:Run) RETURN r.id AS id, r.agent AS agent, r.task AS task, r.mode AS mode, r.outcome AS outcome, r.steps AS steps, r.llm_calls AS llm, r.tokens AS tokens, r.ms AS ms, r.started AS started ORDER BY r.started DESC LIMIT 60");
}

export async function stepsOf(site: string, run: string) {
  return rows(`public:${site}`, `MATCH (st:Step {run: $run})-[:FROM]->(a:State), (st)-[:TO]->(b:State)
    RETURN st.i AS i, st.action_key AS key, st.ok AS ok, st.ms AS ms, st.source AS source, a.sig AS from, b.sig AS to ORDER BY st.i`, { run });
}

export async function planFor(site: string, task: string, current: string) {
  return planRoute(await db(), { site, task, current_sig: current });
}
