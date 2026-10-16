// Desirepath MCP server (plan §9). Five tools: observe, plan, report, explain, map_stats.
//   npm run mcp                      stdio, for a local client:   claude mcp add desirepath -- npx tsx packages/mcp/server.ts
//   npm run mcp -- --http [port]     Streamable HTTP at /mcp (stateless), GET /health
// Env: FALKORDB_* (see .env.example); MCP_WRITE_TOKEN (if set, `report` needs "Authorization: Bearer <token>" over HTTP);
//      MCP_WRITABLE_SITES=a.com,b.com (limit writes); MCP_ALLOW_NEW_SITES=1 (let `report` create maps).
import "dotenv/config";
import { createServer, type IncomingMessage } from "node:http";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { connect } from "../core/graph.ts";
import { ToolError, explainEdge, mapStats, observe, planRoute, reportStep, type Policy } from "./tools.ts";

type Db = Awaited<ReturnType<typeof connect>>;

const name = z.string().min(1).max(120).regex(/^[A-Za-z0-9._-]+$/, "letters, digits, . _ - only");
const sig = z.string().regex(/^[0-9a-f]{16}$/, "a 16-hex-digit screen signature from observe");
const screen = z.object({ url: z.string().url().max(2000).optional(), title: z.string().max(300).optional(), landmarks: z.array(z.string().max(200)).max(60).optional() });
const text = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 1) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: "text" as const, text: e instanceof ToolError || e instanceof Error && /^(site|tenant)/.test(e.message) ? e.message : "request failed" }] });
const guarded = <A>(fn: (a: A) => Promise<unknown>) => async (a: A) => { try { return text(await fn(a)); } catch (e) { return fail(e); } };

export function buildServer(db: Db, policy: Policy): McpServer {
  const s = new McpServer({ name: "desirepath", version: "0.1.0" });
  s.registerTool("observe", {
    description: "Turn the page you are on into a screen signature and say whether the shared map already knows it. Pass the URL and either the accessibility snapshot (Playwright ariaSnapshot text) or the landmark list.",
    inputSchema: { site: name, url: z.string().url().max(2000), snapshot: z.string().max(200_000).optional(), landmarks: z.array(z.string().max(200)).max(200).optional(), tenant: name.optional() },
  }, guarded(a => observe(db, a)));
  s.registerTool("plan", {
    description: "Ask the map for routes (best first) from your current screen to the goal screen of a task, described in plain words. Follow a route if p_success is high; otherwise explore, then report what you did. Returns nearest known goals when none match.",
    inputSchema: { site: name, task: z.string().min(2).max(500), current_sig: sig, tenant: name.optional(), max_ms: z.number().int().positive().max(600_000).optional() },
  }, guarded(a => planRoute(db, a)));
  s.registerTool("report", {
    description: "Record one step you walked: the screen you left, the action, the screen you reached (or the one you expected, if it failed), and whether it worked. Never send typed values: name the task slot instead.",
    inputSchema: {
      site: name, tenant: name.optional(), run_id: name, agent: name.optional(), task: z.string().max(500).optional(),
      from_sig: sig, to_sig: sig, ok: z.boolean(), ms: z.number().min(0).max(600_000),
      action: z.object({ kind: z.enum(["click", "type", "select", "navigate"]), role: z.string().min(1).max(40), name: z.string().max(300), nth: z.number().int().min(0).max(1000), slot: z.string().max(60).optional(), pre: z.string().max(2000).optional() }),
      from: screen.optional(), to: screen.optional(),
    },
  }, guarded(a => reportStep(db, policy, a)));
  s.registerTool("explain", {
    description: "Which runs walked this edge, and did they succeed? Evidence behind a route step.",
    inputSchema: { site: name, from_sig: sig, action_key: z.string().min(3).max(400), tenant: name.optional() },
  }, guarded(a => explainEdge(db, a)));
  s.registerTool("map_stats", {
    description: "Size of a site's map and how cold runs compare with map runs (average steps, milliseconds, LLM calls).",
    inputSchema: { site: name, tenant: name.optional() },
  }, guarded(a => mapStats(db, a)));
  return s;
}

export function policyFromEnv(env: NodeJS.ProcessEnv = process.env): Policy {
  return { allowNewSites: env.MCP_ALLOW_NEW_SITES === "1", writableSites: env.MCP_WRITABLE_SITES?.split(",").map(x => x.trim()).filter(Boolean) };
}

/** Is any JSON-RPC message in this body a call to the `report` tool? */
export function callsReport(body: unknown): boolean {
  return (Array.isArray(body) ? body : [body]).some(m => m && typeof m === "object" && (m as { method?: string }).method === "tools/call"
    && (m as { params?: { name?: string } }).params?.name === "report");
}

async function readBody(req: IncomingMessage, limit = 1_000_000): Promise<unknown> {
  let n = 0; const chunks: Buffer[] = [];
  for await (const c of req) { n += (c as Buffer).length; if (n > limit) throw new Error("body too large"); chunks.push(c as Buffer); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
}

export function startHttp(db: Db, policy: Policy, port: number, token = process.env.MCP_WRITE_TOKEN) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const send = (code: number, body: unknown) => res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(body));
    try {
      if (req.method === "GET" && url.pathname === "/health") return send(200, { ok: true, name: "desirepath-mcp" });
      if (url.pathname !== "/mcp") return send(404, { error: "POST /mcp" });
      if (req.method !== "POST") return send(405, { jsonrpc: "2.0", error: { code: -32000, message: "POST only (stateless server)" }, id: null });
      const body = await readBody(req);
      if (token && callsReport(body) && req.headers.authorization !== `Bearer ${token}`) return send(401, { jsonrpc: "2.0", error: { code: -32001, message: "report needs the write token" }, id: null });
      const mcp = buildServer(db, policy);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => { void transport.close(); void mcp.close(); });
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch {
      if (!res.headersSent) send(400, { jsonrpc: "2.0", error: { code: -32700, message: "bad request" }, id: null });
    }
  });
  return new Promise<{ url: string; close: () => Promise<void> }>(resolve => server.listen(port, () => {
    const p = (server.address() as { port: number }).port;
    resolve({ url: `http://127.0.0.1:${p}/mcp`, close: () => new Promise(r => { server.closeAllConnections(); server.close(() => r()); }) });
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = await connect();
  const policy = policyFromEnv();
  const at = process.argv.indexOf("--http");
  if (at >= 0) {
    const port = Number(process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : process.env.PORT || 8787);
    const h = await startHttp(db, policy, port);
    console.error(`desirepath MCP (HTTP) on ${h.url}`);
  } else {
    await buildServer(db, policy).connect(new StdioServerTransport());
    console.error("desirepath MCP (stdio) ready");
  }
}
