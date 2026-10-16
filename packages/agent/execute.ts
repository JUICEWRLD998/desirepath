// execute(): perform one action on the page (plan §8). Typed values come from the task's slots at run time and are never
// stored in the graph.
import type { Page } from "playwright";
import type { Kind } from "./observe.ts";

export interface Action { kind: Kind; role: string; name: string; nth: number; slot?: string }
export interface ExecResult { ok: boolean; error?: string }

export async function execute(page: Page, a: Action, slots: Record<string, string>, timeout = 4000): Promise<ExecResult> {
  try {
    const loc = page.getByRole(a.role as Parameters<Page["getByRole"]>[0], { name: a.name, exact: true }).nth(a.nth);
    if (a.kind === "click") {
      await loc.click({ timeout });
    } else {
      const value = a.slot ? slots[a.slot] : undefined;
      if (value === undefined) return { ok: false, error: `no value for slot "${a.slot ?? ""}"` };
      if (a.kind === "type") await loc.fill(value, { timeout });
      else await loc.selectOption(value, { timeout });
    }
    // The action worked. A slow page may still be loading; that is not a failure of the action.
    await page.waitForLoadState("load", { timeout }).catch(() => {});
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message.split("\n")[0] };
  }
}
