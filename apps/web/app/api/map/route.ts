import { mapOf } from "../../../lib/data.ts";
import { siteParam } from "../../../lib/params.ts";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try { return Response.json(await mapOf(siteParam(req))); }
  catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 400 }); }
}
