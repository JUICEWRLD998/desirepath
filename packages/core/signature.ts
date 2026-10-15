// State signature (plan §6.1): deterministic, no LLM, no browser dependency.
import { createHash } from "node:crypto";

const SIG_ROLES = new Set(["button", "link", "textbox", "combobox", "checkbox", "tab"]);
const MAX_LANDMARKS = 40;
const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");

export function normName(s: string): string {
  return s.toLowerCase().replace(/\d/g, "#").replace(/\s+/g, " ").trim();
}

function isIdSegment(s: string): boolean {
  return /^\d+$/.test(s)
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    || (/^[0-9a-f]{12,}$/i.test(s) && /\d/.test(s))   // long hash; needs a digit so words made of a-f are kept
    || /^[a-z0-9-]+_\d+$/.test(s)                      // slug_123 (books.toscrape); lowercase only, so Wikipedia's Windows_10 is kept
    || /^page-\d+\.html$/.test(s)                       // paginated static pages
    || /^OL\d+[A-Z]$/.test(s);                          // Open Library ids
}

export function urlTemplate(url: string): string {
  const u = new URL(url);
  const path = u.pathname.split("/").map(s => (isIdSegment(s) ? ":id" : s)).join("/");
  const keys = [...new Set(u.searchParams.keys())].sort();
  return `${u.protocol}//${u.host}${path}${keys.length ? "?" + keys.map(k => `${k}=:v`).join("&") : ""}`;
}

/**
 * Landmarks from a Playwright ariaSnapshot() string: interactive roles + names (first 40), plus one bare "heading"
 * marker if the page has any heading. Playwright YAML-quotes entries whose text has special characters
 * (- 'link "Books: all"':) and backslash-escapes inner quotes, so both are handled.
 * Controls inside a repeated item card (listitem > article) carry item-specific text (book titles, related
 * products): their link names become "*" and each distinct card landmark is listed once, however many cards render.
 */
export function landmarksFromSnapshot(snapshot: string): string[] {
  const out: string[] = [];
  const cardSeen = new Set<string>();
  const stack: { indent: number; role: string }[] = [];
  let interactive = 0, heading = false;
  for (const line of snapshot.split("\n")) {
    const m = line.match(/^(\s*)- ('?)(\w+)(?: "((?:[^"\\]|\\.)*)")?/);
    if (!m) continue;
    const [, space, quoted, role, raw] = m;
    while (stack.length && stack[stack.length - 1].indent >= space.length) stack.pop();
    stack.push({ indent: space.length, role });
    if (role === "heading") { heading = true; continue; }
    if (!SIG_ROLES.has(role) || interactive >= MAX_LANDMARKS) continue;
    const li = stack.findIndex(e => e.role === "listitem");
    const inCard = li >= 0 && stack.slice(li + 1).some(e => e.role === "article");
    let name = (raw ?? "").replace(/\\(.)/g, "$1");
    if (quoted) name = name.replace(/''/g, "'");
    const landmark = `${role}:${role === "link" && inCard ? "*" : normName(name)}`;
    if (inCard) {
      if (cardSeen.has(landmark)) continue;
      cardSeen.add(landmark);
    }
    out.push(landmark);
    interactive++;
  }
  if (heading) out.push("heading");
  return out;
}

export function signature(url: string, landmarks: string[]): string {
  const lm = [...landmarks].sort();
  return sha1(urlTemplate(url) + "|" + sha1(lm.join("\n"))).slice(0, 16);
}

/** Action key (plan §6.2). Typed values are never part of it. */
export function actionKey(kind: string, role: string, name: string, nth: number): string {
  return `${kind}:${role}:${normName(name)}:${nth}`;
}
