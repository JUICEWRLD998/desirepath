// Several agents at once on the same map (plan §8: `runner --agents 3 --tenant acme`). Each agent has its own browser
// context (own cookies, own cart) and its own Run; all of them read and write one FalkorDB graph.
import type { Browser } from "playwright";
import { newAgentContext } from "./browser.ts";
import { runTask, type RunOptions, type RunResult } from "./loop.ts";

export interface ManyOptions extends Omit<RunOptions, "page" | "agent"> {
  browser: Browser;
  agents: number;
  /** Real sites: send the identified user agent. */
  identify?: boolean;
  /** Agent ids are `${prefix}-1` .. `${prefix}-N`. */
  prefix?: string;
}

export async function runAgents(o: ManyOptions): Promise<RunResult[]> {
  const { browser, agents, identify, prefix = "agent", ...rest } = o;
  return Promise.all(Array.from({ length: agents }, async (_, i) => {
    const ctx = await newAgentContext(browser, { identify });
    try {
      const id = `${prefix}-${i + 1}`;
      return await runTask({ ...rest, page: await ctx.newPage(), agent: id, log: rest.log ? l => rest.log!(`[${id}] ${l}`) : undefined });
    } finally { await ctx.close(); }
  }));
}
