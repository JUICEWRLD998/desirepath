// The five MCP tools (plan §9) as plain functions over FalkorDB, so they are tested without an MCP client.
//   observe   screen signature + is it in the map          plan      routes from here to a goal, tenant overlay first
//   report    record one walked step                       explain   the runs behind an edge
//   map_stats numbers for one site
// Reads see the tenant overlay and the public map; writes go only where the caller says (tenant graph if `tenant`, else public).
import { connect, ensureRun, ensureSchema, explain, goalCandidates, graphName, plan, recordStep, report, stats,
  type Graph, type Screen, type Step } from "../core/graph.ts";
import { actionKey, landmarksFromSnapshot, signature, urlTemplate } from "../core/signature.ts";

type Db = Awaited<ReturnType<typeof connect>>;

export interface Policy {
  /** If set, only these sites may be written or created. Reads of existing maps are always allowed. */
  writableSites?: string[];
  /** Allow `report` to create a map for a site that has none yet. */
  allowNewSites: boolean;
}

export class ToolError extends Error {}

/** Which graphs exist. GRAPH.QUERY on a missing key would create it, so reads check first. */
async function existing(db: Db): Promise<Set<string>> {
  return new Set(await db.list());
}

async function readable(db: Db, site: string, tenant?: string): Promise<Array<{ source: "tenant" | "public"; g: Graph }>> {
  const have = await existing(db);
  const out: Array<{ source: "tenant" | "public"; g: Graph }> = [];
  if (tenant && have.has(graphName(site, tenant))) out.push({ source: "tenant", g: db.selectGraph(graphName(site, tenant)) });
  if (have.has(graphName(site))) out.push({ source: "public", g: db.selectGraph(graphName(site)) });
  return out;
}

export async function observe(db: Db, a: { site: string; url: string; landmarks?: string[]; snapshot?: string; tenant?: string }) {
  const landmarks = a.landmarks ?? landmarksFromSnapshot(a.snapshot ?? "");
  const sig = signature(a.url, landmarks);
  const where: Array<{ source: string; visits: number }> = [];
  for (const { source, g } of await readable(db, a.site, a.tenant)) {
    const r = (await g.query("MATCH (s:State {sig: $sig}) RETURN s.visits AS visits", { params: { sig } })).data as Array<{ visits: number }>;
    if (r.length) where.push({ source, visits: r[0].visits });
  }
  return { sig, url_template: urlTemplate(a.url), known: where.length > 0, visits: where.reduce((n, w) => n + w.visits, 0), seen_in: where.map(w => w.source) };
}

export interface RouteOut {
  source: "tenant" | "public"; goal: string; goal_sig: string; hops: number; p_success: number; est_ms: number;
  steps: Array<Pick<Step, "key" | "kind" | "role" | "name" | "nth" | "slot" | "pre" | "to" | "ok" | "fail" | "ms">>;
}

export async function planRoute(db: Db, a: { site: string; task: string; current_sig: string; tenant?: string; max_ms?: number }) {
  const routes: Array<RouteOut & { weight: number }> = [];
  const nearest: Array<{ source: string; goal: string; times: number }> = [];
  for (const { source, g } of await readable(db, a.site, a.tenant)) {
    const cands = await goalCandidates(g, a.task);
    nearest.push(...cands.map(c => ({ source, goal: c.goalText, times: c.times })));
    for (const c of cands.slice(0, 2)) {
      for (const r of await plan(g, a.current_sig, c.goalSig, a.max_ms)) {
        routes.push({ source, goal: c.goalText, goal_sig: c.goalSig, hops: r.hops, p_success: +r.pSuccess.toFixed(4), est_ms: Math.round(r.ms), steps: r.steps, weight: r.weight });
      }
    }
  }
  routes.sort((x, y) => x.weight - y.weight);   // tenant first, then public: whichever has the lower weight wins (plan §6.4)
  return {
    source: routes[0]?.source ?? null,
    routes: routes.slice(0, 3).map(({ weight: _w, ...r }) => r),
    ...(routes.length ? {} : { reason: nearest.length ? "no known route from the current screen to a matching goal" : "no known goal matches this task", nearest_goals: nearest.slice(0, 5) }),
  };
}

export interface ScreenIn { url?: string; title?: string; landmarks?: string[] }
export interface ReportIn {
  site: string; tenant?: string; run_id: string; agent?: string; task?: string;
  from_sig: string; to_sig: string; ok: boolean; ms: number;
  action: { kind: "click" | "type" | "select" | "navigate"; role: string; name: string; nth: number; slot?: string; pre?: string };
  from?: ScreenIn; to?: ScreenIn;
}

const screenOf = (sig: string, s?: ScreenIn): Screen =>
  ({ sig, urlTemplate: s?.url ? urlTemplate(s.url) : "", title: s?.title ?? "", landmarks: s?.landmarks ?? [] });

export async function reportStep(db: Db, policy: Policy, a: ReportIn) {
  const have = await existing(db);
  const name = graphName(a.site, a.tenant);
  if (!have.has(name)) {
    if (!policy.allowNewSites) throw new ToolError(`no map exists for "${a.site}"; ask the operator to enable new sites`);
  }
  if (policy.writableSites && !policy.writableSites.includes(a.site)) throw new ToolError(`writes to "${a.site}" are not enabled on this server`);
  const g = db.selectGraph(name);
  if (!have.has(name)) await ensureSchema(g);
  const now = Date.now();
  const key = actionKey(a.action.kind, a.action.role, a.action.name, a.action.nth);
  const edge = await report(g, {
    from: a.from_sig, fromUrl: screenOf(a.from_sig, a.from).urlTemplate, fromTitle: a.from?.title ?? "", fromLandmarks: a.from?.landmarks ?? [],
    to: a.to_sig, toUrl: screenOf(a.to_sig, a.to).urlTemplate, toTitle: a.to?.title ?? "", toLandmarks: a.to?.landmarks ?? [],
    key, kind: a.action.kind, role: a.action.role, name: a.action.name, nth: a.action.nth,
    label: `[${a.action.role}] ${a.action.name} -> ${a.action.kind}`, slot: a.action.slot ?? "", pre: a.action.pre ?? "",
    ok: a.ok ? 1 : 0, fail: a.ok ? 0 : 1, ms: a.ms, now });
  await ensureRun(g, { id: a.run_id, agent: a.agent ?? "mcp-client", tenant: a.tenant, task: a.task ?? "", mode: "map", now });
  const i = ((await g.query("MATCH (s:Step {run: $run}) RETURN count(s) AS n", { params: { run: a.run_id } })).data![0] as { n: number }).n + 1;
  await recordStep(g, { run: a.run_id, i, key, ok: a.ok, ms: a.ms, source: "map", from: screenOf(a.from_sig, a.from), to: screenOf(a.to_sig, a.to), observed: a.to_sig, now });
  await g.query("MATCH (r:Run {id: $id}) SET r.steps = $n", { params: { id: a.run_id, n: i } });
  return { edge: { ok: edge.ok, fail: edge.fail, risk: +edge.risk.toFixed(4), ms: Math.round(edge.ms) }, key, step: i };
}

export async function explainEdge(db: Db, a: { site: string; from_sig: string; action_key: string; tenant?: string }) {
  const out: Array<Record<string, unknown>> = [];
  for (const { source, g } of await readable(db, a.site, a.tenant)) {
    for (const w of await explain(g, a.from_sig, a.action_key)) {
      out.push({ source, run: w["r.id"], agent: w["r.agent"], mode: w["r.mode"], ok: !!w["st.ok"], ms: w["st.ms"], at: w["r.started"] });
    }
  }
  return { runs: out };
}

export async function mapStats(db: Db, a: { site: string; tenant?: string }) {
  const out: Record<string, unknown> = {};
  for (const { source, g } of await readable(db, a.site, a.tenant)) {
    const n = (q: string) => g.query(q).then(r => Object.values((r.data![0] ?? {}) as Record<string, number>)[0] ?? 0);
    const byMode = (await stats(g)) as Array<{ mode: string; runs: number; steps: number; ms: number; llm: number }>;
    out[source] = {
      states: await n("MATCH (s:State) RETURN count(s)"), edges: await n("MATCH ()-[e:ACT]->() RETURN count(e)"),
      goals: await n("MATCH (g:Goal) RETURN count(g)"),
      runs: Object.fromEntries(byMode.map(m => [m.mode, { runs: m.runs, avg_steps: +m.steps.toFixed(2), avg_ms: Math.round(m.ms), avg_llm_calls: +m.llm.toFixed(2) }])),
    };
  }
  if (!Object.keys(out).length) throw new ToolError(`no map exists for "${a.site}"`);
  return out;
}
