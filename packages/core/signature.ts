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

/** Landmarks from a Playwright ariaSnapshot() string: interactive roles + names, headings as bare roles. */
export function landmarksFromSnapshot(snapshot: string): string[] {
  const out: string[] = [];
  for (const line of snapshot.split("\n")) {
    const m = line.match(/^\s*- (\w+)(?: "([^"]*)")?/);
    if (!m) continue;
    if (m[1] === "heading") out.push("heading");
    else if (SIG_ROLES.has(m[1])) out.push(`${m[1]}:${normName(m[2] ?? "")}`);
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
