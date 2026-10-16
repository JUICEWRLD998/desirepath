// Which planned route to follow (plan §6.4, §6.7). Pure, so it is tested without a database.
import type { Route } from "./graph.ts";

/** Follow a route when its average per-hop success is at least this (tunable). One clean walk of every edge gives 0.667. */
export const THETA_HOP = 0.6;

/** Identity of an edge inside one run: the screen it leaves plus its action key. */
export const edgeId = (fromSig: string, key: string) => `${fromSig}|${key}`;

/** Per-hop confidence: the geometric mean of the edge success rates on the route. */
export const hopConfidence = (r: Pick<Route, "pSuccess" | "hops">) => Math.pow(r.pSuccess, 1 / r.hops);

/**
 * The first route (they arrive lowest risk first) that avoids every edge already failed in this run and is
 * trusted enough to follow without asking the LLM. A failed edge is skipped for the rest of the run even if its
 * stored risk has not yet risen enough to lose the ranking: one report moves a 1-0 edge to 1-1, which is still cheap.
 */
export function chooseRoute(routes: Route[], current: string, failed: ReadonlySet<string>, theta = THETA_HOP): Route | undefined {
  return routes.find(route => {
    if (route.hops === 0) return false;
    let from = current;
    for (const step of route.steps) {
      if (failed.has(edgeId(from, step.key))) return false;
      from = step.to;
    }
    return hopConfidence(route) >= theta;
  });
}
