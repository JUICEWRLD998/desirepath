// One browser context per agent. Real sites see who we are (plan §3: public sites, polite, rule 6).
import type { Browser, BrowserContext } from "playwright";

export const USER_AGENT_SUFFIX = "Desirepath/0.1 (research agent; +https://github.com/juicewrld998/desirepath)";

export async function newAgentContext(browser: Browser, opts: { identify?: boolean } = {}): Promise<BrowserContext> {
  if (!opts.identify) return browser.newContext();
  // Start from the browser's own user agent so pages render as they would for a normal visitor, then say who we are.
  const probe = await browser.newContext();
  const base = await (await probe.newPage()).evaluate(() => navigator.userAgent);
  await probe.close();
  return browser.newContext({ userAgent: `${base} ${USER_AGENT_SUFFIX}` });
}
