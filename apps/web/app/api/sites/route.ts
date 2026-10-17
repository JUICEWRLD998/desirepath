import { sites } from "../../../lib/data.ts";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json({ sites: await sites() }); }
  catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 502 }); }
}
