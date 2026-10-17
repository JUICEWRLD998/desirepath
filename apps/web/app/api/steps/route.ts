import { stepsOf } from "../../../lib/data.ts";
import { siteParam, textParam } from "../../../lib/params.ts";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { return Response.json({ steps: await stepsOf(siteParam(req), textParam(req, "run")) }); }
  catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 400 }); }
}
