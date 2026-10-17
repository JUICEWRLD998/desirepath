// Input checks for the read-only API. Site names are restricted so a query string can never name another graph.
export function siteParam(req: Request): string {
  const s = new URL(req.url).searchParams.get("site") ?? "";
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(s)) throw new Error("site is missing or has characters that are not allowed");
  return s;
}
export function textParam(req: Request, name: string): string {
  const v = new URL(req.url).searchParams.get(name) ?? "";
  if (!v.trim()) throw new Error(`${name} is required`);
  if (v.length > 400) throw new Error(`${name} is too long`);
  return v;
}
