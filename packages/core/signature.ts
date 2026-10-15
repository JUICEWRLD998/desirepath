// State signature (plan §6.1): deterministic, no LLM, no browser dependency.
import { createHash } from "node:crypto";

const SIG_ROLES = new Set(["button", "link", "textbox", "combobox", "checkbox", "tab"]);
const MAX_LANDMARKS = 40;
const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");

export function normName(s: string): string {
  return s.toLowerCase().replace(/\d/g, "#").replace(/\s+/g, " ").trim();
}

function isIdSegment(s: string): boolean {
  return /^\d+$/.test(s) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    || /^[0-9a-f]{12,}$/i.test(s) || /_\d+$/.test(s) || /^OL\d+[A-Z]$/.test(s);
}

export function urlTemplate(url: string): string {
  const u = new URL(url);
  const path = u.pathname.split("/").map(s => (isIdSegment(s) ? ":id" : s)).join("/");
  const keys = [...new Set(u.searchParams.keys())].sort();
  return `${u.protocol}//${u.host}${path}${keys.length ? "?" + keys.map(k => `${k}=:v`).join("&") : ""}`;
}

/**
 * Landmarks from a Playwright ariaSnapshot() string: interactive roles + names, headings as bare roles.
 * Controls inside a repeated item card (listitem > article) carry item-specific text (book titles, related
 * products), so their link names become "*" and the card's landmarks are listed once, however many cards render.
 * Bare "heading" is also listed once: a heading count tracks page content (optional sections), not the template.
 */
export function landmarksFromSnapshot(snapshot: string): string[] {
  const out: string[] = [];
  const seenDeduped = new Set<string>();
  const stack: { indent: number; role: string }[] = [];
  for (const line of snapshot.split("\n")) {
    const m = line.match(/^(\s*)- (\w+)(?: "([^"]*)")?/);
    if (!m) continue;
    const indent = m[1].length;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    stack.push({ indent, role: m[2] });
    const li = stack.findIndex(e => e.role === "listitem");
    const inCard = li >= 0 && stack.slice(li + 1).some(e => e.role === "article");
    let landmark: string | null = null;
    if (m[2] === "heading") landmark = "heading";
    else if (SIG_ROLES.has(m[2])) landmark = `${m[2]}:${m[2] === "link" && inCard ? "*" : normName(m[3] ?? "")}`;
    if (landmark === null) continue;
    if (inCard || landmark === "heading") {
      if (seenDeduped.has(landmark)) continue;
      seenDeduped.add(landmark);
    }
    out.push(landmark);
    if (out.length >= MAX_LANDMARKS) break;
  }
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
