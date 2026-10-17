import { explainOf } from "../../../lib/data.ts";
import { siteParam, textParam } from "../../../lib/params.ts";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { return Response.json({ runs: await explainOf(siteParam(req), textParam(req, "from"), textParam(req, "key")) }); }
  catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 400 }); }
}
