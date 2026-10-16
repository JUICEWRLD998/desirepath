import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseRoute, edgeId, hopConfidence, THETA_HOP } from "../route.ts";
import { routeSuccess, risk } from "../risk.ts";
import type { Route, Step } from "../graph.ts";

const step = (key: string, to: string, ok = 1, fail = 0): Step =>
  ({ key, to, kind: "click", role: "link", name: key, nth: 0, ok, fail, ms: 100 });
// Build a route the way the planner would score it from per-edge counts.
const route = (...edges: Step[]): Route => {
  const weight = edges.reduce((w, e) => w + risk(e.ok, e.fail), 0);
  return { steps: edges, hops: edges.length, weight, ms: 100 * edges.length, pSuccess: routeSuccess(weight, edges.length) };
};

test("one clean walk of every edge is trusted (per-hop 0.667 >= theta)", () => {
  const r = route(step("a", "B"), step("b", "C"), step("c", "D"));
  assert.ok(Math.abs(hopConfidence(r) - 2 / 3) < 1e-9);
  assert.ok(hopConfidence(r) >= THETA_HOP);
  assert.equal(chooseRoute([r], "A", new Set()), r);
});

test("an edge that failed as often as it worked is not trusted", () => {
  const r = route(step("a", "B"), step("b", "C", 1, 1));
  assert.ok(hopConfidence(r) < THETA_HOP);
  assert.equal(chooseRoute([r], "A", new Set()), undefined);
});

test("an edge failed in this run is skipped even when it still ranks first", () => {
  const short = route(step("quick", "CART"), step("pay", "DONE"));
  const long = route(step("product", "P"), step("add", "CART"), step("pay", "DONE"));
  assert.equal(chooseRoute([short, long], "CAT", new Set()), short);
  // "quick" leaves CAT and failed once in this run
  assert.equal(chooseRoute([short, long], "CAT", new Set([edgeId("CAT", "quick")])), long);
});

test("a failure is scoped to the screen it left", () => {
  const r = route(step("go", "B"));
  assert.equal(chooseRoute([r], "A", new Set([edgeId("OTHER", "go")])), r);
  assert.equal(chooseRoute([r], "A", new Set([edgeId("A", "go")])), undefined);
});

test("a failed edge deep in a route disqualifies the whole route", () => {
  const r = route(step("a", "B"), step("b", "C"));
  assert.equal(chooseRoute([r], "A", new Set([edgeId("B", "b")])), undefined);
});

test("no routes, and zero-hop routes, give nothing to follow", () => {
  assert.equal(chooseRoute([], "A", new Set()), undefined);
  assert.equal(chooseRoute([{ steps: [], hops: 0, weight: 0, ms: 0, pSuccess: 1 }], "A", new Set()), undefined);
});

test("a route this task has walked before beats a cheaper route that belongs to another task", () => {
  const other = route(step("mystery", "SHELF"), step("book", "DONE"));              // 2 hops, walked by someone else's task
  const mine = route(step("travel", "SHELF"), step("book", "DONE"), step("x", "Y"));
  assert.equal(chooseRoute([other, mine], "HOME", new Set()), other, "without task memory the cheaper route wins");
  // mine = HOME -travel-> SHELF -book-> DONE -x-> Y ; owned lists those exact (from, key) pairs
  assert.equal(chooseRoute([other, mine], "HOME", new Set(), 0.6, new Set([edgeId("HOME", "travel"), edgeId("SHELF", "book"), edgeId("DONE", "x")])), mine);
  assert.equal(chooseRoute([other, mine], "HOME", new Set(), 0.6, new Set()), other, "nothing owned: fall back to the cheapest");
});
