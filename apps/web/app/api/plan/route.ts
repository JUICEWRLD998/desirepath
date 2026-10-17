import { planFor } from "../../../lib/data.ts";
import { siteParam, textParam } from "../../../lib/params.ts";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const task = textParam(req, "task");
    if (task.length > 300) throw new Error("task is limited to 300 characters");
    return Response.json(await planFor(siteParam(req), task, textParam(req, "from")));
  } catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 400 }); }
}
