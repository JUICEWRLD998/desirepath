// Edge risk (plan §6.3). Laplace-smoothed success rate; the constant prefers fewer hops.
export const HOP_COST = 0.05;

export function successRate(ok: number, fail: number): number {
  return (ok + 1) / (ok + fail + 2);
}

export function risk(ok: number, fail: number): number {
  return -Math.log(successRate(ok, fail)) + HOP_COST;
}

/** Route success probability from the SPpaths pathWeight (plan §6.4). */
export function routeSuccess(pathWeight: number, hops: number): number {
  return Math.exp(-(pathWeight - HOP_COST * hops));
}
