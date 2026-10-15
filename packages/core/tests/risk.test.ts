import { test } from "node:test";
import assert from "node:assert/strict";
import { risk, routeSuccess, successRate } from "../risk.ts";

test("risk rises monotonically with failures", () => {
  for (let f = 0; f < 20; f++) assert.ok(risk(5, f + 1) > risk(5, f));
});
test("risk falls with successes", () => {
  for (let o = 0; o < 20; o++) assert.ok(risk(o + 1, 1) < risk(o, 1));
});
test("untried edge has p = 0.5", () => assert.equal(successRate(0, 0), 0.5));
test("a 3-hop reliable route outweighs a 2-hop flaky one in the planner's favour", () => {
  const reliable = 3 * risk(20, 0), flaky = 2 * risk(2, 8);
  assert.ok(reliable < flaky);
});
test("route success inverts pathWeight", () => {
  const w = 3 * risk(20, 0);
  assert.ok(routeSuccess(w, 3) > 0.85);
  const f = 2 * risk(2, 8);
  assert.ok(routeSuccess(f, 2) < 0.25);
});
