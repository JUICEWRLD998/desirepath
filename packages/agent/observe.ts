// observe(): what the agent sees on a page (plan §8). The accessibility snapshot gives the roles and names that both the
// signature and the action candidates are built from.
import type { Page } from "playwright";
import type { Screen } from "../core/graph.ts";
import { landmarksFromSnapshot, signature, urlTemplate } from "../core/signature.ts";

export type Kind = "click" | "type" | "select";
/** `value` is what a textbox or dropdown currently holds, so the agent can see that it has already filled it. */
export interface Candidate { role: string; name: string; nth: number; kind: Kind; value?: string }
export interface Observation { url: string; screen: Screen; candidates: Candidate[]; text: string }

const ACT_ROLES = new Set(["button", "link", "textbox", "combobox", "checkbox", "tab"]);
export const kindOf = (role: string): Kind => (role === "textbox" ? "type" : role === "combobox" ? "select" : "click");

/**
 * Every interactive element with a name, in document order. `nth` counts earlier elements with the same role and name,
 * which is exactly the index `page.getByRole(role, { name, exact: true }).nth(nth)` needs. Unlike the signature's
 * landmarks this list is neither capped nor de-duplicated: the agent must be able to pick the third "Quick add".
 */
export function candidatesFromSnapshot(snapshot: string): Candidate[] {
  const seen = new Map<string, number>();
  const out: Candidate[] = [];
  for (const line of snapshot.split("\n")) {
    const m = line.match(/^(\s*)- ('?)(\w+)(?: "((?:[^"\\]|\\.)*)")?/);
    if (!m) continue;
    const [, , quoted, role, raw] = m;
    if (!ACT_ROLES.has(role) || raw === undefined) continue;
    let name = raw.replace(/\\(.)/g, "$1");
    if (quoted) name = name.replace(/''/g, "'");
    if (!name.trim()) continue;
    const k = `${role}\u0000${name}`;
    const nth = seen.get(k) ?? 0;
    seen.set(k, nth + 1);
    // Playwright prints a field's content after the name:  - textbox "Search products": Trail Mug
    const value = !quoted && (role === "textbox" || role === "combobox")
      ? /^(?: \[[^\]]+\])*:\s+(.+)$/.exec(line.slice(m[0].length))?.[1]
      : undefined;
    out.push(value ? { role, name, nth, kind: kindOf(role), value } : { role, name, nth, kind: kindOf(role) });
  }
  return out;
}

export async function observe(page: Page): Promise<Observation> {
  const snapshot = await page.locator("body").ariaSnapshot();
  const url = page.url();
  const landmarks = landmarksFromSnapshot(snapshot);
  const screen: Screen = { sig: signature(url, landmarks), urlTemplate: urlTemplate(url), title: await page.title(), landmarks };
  return { url, screen, candidates: candidatesFromSnapshot(snapshot), text: await page.locator("body").innerText() };
}
