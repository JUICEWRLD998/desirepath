// FalkorDB client for the map. One graph per site (public) or per tenant+site (private overlay), plan §5.
import { readFileSync } from "node:fs";
import { FalkorDB } from "falkordb";
import { routeSuccess } from "./risk.ts";

type Db = Awaited<ReturnType<typeof FalkorDB.connect>>;
type G = ReturnType<Db["selectGraph"]>;

const query = (name: string) => readFileSync(new URL(`./queries/${name}.cypher`, import.meta.url), "utf8");
const SQL = { report: query("report"), plan: query("plan"), goals: query("goals"), stats: query("stats") };

export function graphName(site: string, tenant?: string): string {
  const bad = /[^A-Za-z0-9._-]/;
  if (bad.test(site) || (tenant !== undefined && bad.test(tenant))) throw new Error("site and tenant may only contain letters, digits, . _ -");
  return tenant ? `tenant:${tenant}:${site}` : `public:${site}`;
}

export function connect(env: NodeJS.ProcessEnv = process.env): Promise<Db> {
  const { FALKORDB_URL, FALKORDB_HOST, FALKORDB_PORT, FALKORDB_USERNAME, FALKORDB_PASSWORD, FALKORDB_TLS } = env;
  if (FALKORDB_HOST) {
    return FalkorDB.connect({ username: FALKORDB_USERNAME || "default", password: FALKORDB_PASSWORD,
      socket: { host: FALKORDB_HOST, port: Number(FALKORDB_PORT || 6379), tls: FALKORDB_TLS === "true" } as never });
  }
  if (!FALKORDB_URL) throw new Error("Set FALKORDB_URL or FALKORDB_HOST (see .env.example)");
  return FalkorDB.connect({ url: FALKORDB_URL });
}

/** Indexes from plan §5. Safe to call repeatedly. */
export async function ensureSchema(g: G): Promise<void> {
  const stmts = ["CREATE INDEX FOR (s:State) ON (s.sig)", "CREATE INDEX FOR (g:Goal) ON (g.id)",
    "CALL db.idx.fulltext.createNodeIndex('Goal','text')"];
  for (const s of stmts) {
    try { await g.query(s); } catch (e) { if (!/already|exist/i.test((e as Error).message)) throw e; }
  }
}

export interface ReportParams {
  from: string; fromUrl: string; fromTitle: string; fromLandmarks: string[];
  to: string; toUrl: string; toTitle: string; toLandmarks: string[];
  key: string; kind: string; role: string; name: string; nth: number; label: string;
  ok: 0 | 1; fail: 0 | 1; ms: number; now: number;
}
export interface EdgeStats { ok: number; fail: number; ms: number; risk: number }

export async function report(g: G, p: ReportParams): Promise<EdgeStats> {
  if (p.ok + p.fail !== 1) throw new Error("report: exactly one of ok/fail must be 1");
  const r = (await g.query(SQL.report, { params: p as never })).data![0] as Record<string, number>;
  return { ok: r["e.ok"], fail: r["e.fail"], ms: r["e.ms"], risk: r["e.risk"] };
}

export interface Step { key: string; to: string; kind: string; role: string; name: string; nth: number; ok: number; fail: number; ms: number }
export interface Route { steps: Step[]; hops: number; weight: number; ms: number; pSuccess: number }

/** Up to three routes, lowest risk first. Empty if either screen is unknown or no route exists. */
export async function plan(g: G, current: string, goal: string, maxMs = 60_000): Promise<Route[]> {
  if (current === goal) return [];
  const known = (await g.query("MATCH (s:State) WHERE s.sig IN [$a, $b] RETURN count(s)", { params: { a: current, b: goal } })).data![0] as Record<string, number>;
  if (Object.values(known)[0] < 2) return [];
  const rows = (await g.query(SQL.plan, { params: { current, goal, maxMs } })).data as Array<Record<string, unknown>>;
  return rows.map(r => ({ steps: r.steps as Step[], hops: r.hops as number, weight: r.pathWeight as number, ms: r.pathCost as number,
    pSuccess: routeSuccess(r.pathWeight as number, r.hops as number) }));
}

/** Full-text queries are AND-ed by default and break on punctuation; reduce free text to OR-ed word tokens. */
const STOP = new Set(["the", "a", "an", "of", "to", "in", "on", "and", "or", "for", "with", "from", "find", "open", "go", "get", "is", "it"]);
export function ftQuery(text: string): string {
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g)?.filter(t => !STOP.has(t) && t.length > 1) ?? [];
  return [...new Set(tokens)].join("|");
}

export async function goalCandidates(g: G, text: string) {
  const q = ftQuery(text);
  if (!q) return [];
  return (await g.query(SQL.goals, { params: { text: q } })).data as Array<{ goalSig: string; goalText: string; score: number; times: number }>;
}

export async function stats(g: G) { return (await g.query(SQL.stats)).data; }
