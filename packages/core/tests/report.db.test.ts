// Needs a FalkorDB: FALKORDB_URL=redis://127.0.0.1:6390 npm test. Skipped otherwise.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FalkorDB } from "falkordb";
import { risk } from "../risk.ts";

const url = process.env.FALKORDB_URL;
const q = (f: string) => readFileSync(new URL(`../queries/${f}`, import.meta.url), "utf8");
const base = { from: "s1", fromUrl: "u1", fromTitle: "t1", fromLandmarks: ["a"], to: "s2", toUrl: "u2", toTitle: "t2",
  toLandmarks: ["b"], key: "click:link:x:0", kind: "click", role: "link", name: "x", nth: 0, label: "[link] x -> click", slot: "", now: 1 };
const name = `test_report_${process.pid}`;
let db: Awaited<ReturnType<typeof FalkorDB.connect>> | undefined;
after(async () => { if (db) { await db.selectGraph(name).delete().catch(() => {}); await db.close(); } });

test("report.cypher: counts, running-mean ms, and risk reflect the NEW counts", { skip: !url }, async () => {
  db = await FalkorDB.connect({ url: url! });
  const g = db.selectGraph(name);
  const r1 = (await g.query(q("report.cypher"), { params: { ...base, ok: 1, fail: 0, ms: 100 } })).data![0] as Record<string, number>;
  assert.equal(r1["e.ok"], 1); assert.equal(r1["e.fail"], 0); assert.equal(r1["e.ms"], 100);
  assert.ok(Math.abs(r1["e.risk"] - risk(1, 0)) < 1e-9, `risk after 1 ok: ${r1["e.risk"]}`);
  const r2 = (await g.query(q("report.cypher"), { params: { ...base, ok: 0, fail: 1, ms: 300 } })).data![0] as Record<string, number>;
  assert.equal(r2["e.ok"], 1); assert.equal(r2["e.fail"], 1); assert.equal(r2["e.ms"], 200);
  assert.ok(Math.abs(r2["e.risk"] - risk(1, 1)) < 1e-9, `risk after ok+fail: ${r2["e.risk"]}`);
});
