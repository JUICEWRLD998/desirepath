# Decisions

Raw output of every spike: `spikes/out/`. Raw output of the Phase 2 run: `docs/receipts/p2-latest.json`.

**Local** = a FalkorDB module (ver 41803) from the `falkordblite` 0.10.0 PyPI package, started by hand with `redis-server --loadmodule falkordb.so` (see README, "Local FalkorDB"). Every database test and the Phase 2 run used it.
**Cloud** = the FalkorDB Cloud free instance. It has **never accepted the credentials** (see Phase 0 below).

## Where each phase stands (2026-10-16)

| Phase | State | Evidence |
|---|---|---|
| P0 Spikes | **Open on three items, all need something from the author**: Cloud connection (`WRONGPASS`), the 100 MB size check (needs Cloud), Open Library signature (host times out from this machine). Everything else passed. | table below |
| P1 Core | **Done.** 38 core tests green (risk, signature, route chooser, and the graph, report, run/step/goal database tests), `docs/GRAPH_MODEL.md` written. | `npm test` |
| P2 Thin path | **Done on local FalkorDB with the real model** (`google/gemini-2.5-flash` via OpenRouter). | `npm run p2`, `docs/receipts/p2-latest.json` |

Whole suite: `FALKORDB_URL=redis://127.0.0.1:6390 npm test` gives 50 tests, 50 pass (without a database 33 run and 17 skip).

## Phase 0

| Spike | Local | Cloud | Result |
|---|---|---|---|
| Connection round trip | pass (6.6 ms, meaningless for Cloud) | **not run** | `WRONGPASS` from Cloud, reproduced 2026-10-16: the host answers and rejects the username/password in `.env` |
| `algo.SPpaths`, float `weightProp`, `costProp`+`maxCost`, `pathCount: 3` | pass | **not run** | three routes in weight order, see below |
| Cypher `log()` | pass | **not run** | `-log(0.5)` = 0.693147180559945; risk is computed in Cypher |
| Full-text index on `Goal` | pass | **not run** | `CALL db.idx.fulltext.createNodeIndex('Goal','text')`, `queryNodes('Goal','travel')` |
| `algo.pageRank`, `algo.WCC` syntax | pass | **not run** | `CALL algo.pageRank('S','ACT')`, `CALL algo.WCC({nodeLabels:['S'],relationshipTypes:['ACT']})` |
| Two graphs (`public:x`, `tenant:a:x`) in one request | pass | **not run** | colon names work and are isolated |
| Playwright accessibility snapshot | pass (headless Chromium, `ariaSnapshot()`) on his machine | n/a | roles and names on all sites; quoted entries need the parser fix below |
| OpenRouter structured output | n/a | **pass** | `google/gemini-2.5-flash`, 85 in / 24 out tokens, $0.0000855. Phase 2 moved it to `generateText` + `Output.object` (the SDK deprecates `generateObject`) |
| Signature stability, books.toscrape | pass | n/a | 3 loads of 4 URLs give one `sig` each; two product pages share a `sig`; category differs from product |
| Signature stability, quotes.toscrape | pass | n/a | same |
| Signature stability, Wikipedia | pass | n/a | same |
| Signature stability, **test shop** | pass | n/a | `packages/agent/tests/shop.test.ts`: six page types, three loads each, one `sig`; two categories share one, two products share one; the five templates all differ |
| Signature stability, Open Library | **not measured** | n/a | home page: 3 loads, one `sig`. Editions page: 2 loads agree, the third timed out. The 2026-10-16 re-run (90 s timeout) timed out on every load (`ERR_CONNECTION_TIMED_OUT`). The host is unreachable or throttled from this machine, so this says nothing about the signature. Per the plan's cut list Open Library goes before books, quotes and the test shop. |

**Switch trigger (plan §6.1): not hit.** The trigger was a failure on 3 of 5 sites; the four that load are stable.

`SPpaths` on the toy graph (A to F; `risk` 1.5 / 0.1 / 0.6 per hop):
```
[ac,cd,df]  pathWeight 0.3  pathCost 300
[ae,ef]     pathWeight 1.2  pathCost 200
[ab,bf]     pathWeight 3    pathCost 200
```
Float weights are accepted; no need for the integer-scaling fallback.

**To close Phase 0** the author must give a working FalkorDB Cloud connection (re-copy the password from the instance page, or use the split `FALKORDB_HOST/PORT/USERNAME/PASSWORD` fields). Then `npm run p0:falkor` repeats every row above on Cloud and the size check can run. Nothing built so far depends on Cloud-only behaviour, but it has not been shown to work there.

## Phase 1 decisions

1. **Risk is computed in Cypher, from the new counts.** Separate `SET` clauses do not see each other's writes on this FalkorDB, so the first `report.cypher` computed `risk` from the previous counts (one report stale: 0.7431 after one success, should be 0.4555). Fixed by computing `ok2`, `fail2`, `ms2` in `WITH` and deriving `risk` from them. Covered by `report.db.test.ts`; that test fails against the old query.
2. **Landmark parser handles Playwright's YAML quoting.** Entries with special characters are emitted as `- 'button "Say: hi"'`; the first parser silently dropped them. Escaped quotes are unescaped.
3. **Headings add one `heading` marker**, not one entry each, and do not use the 40-landmark cap. This is a reading of "plus heading roles" in plan §6.1; per-heading entries would make the signature vary with heading count.
4. **Id detection is narrower than the first version.** `slug_123` collapses only when lowercase (books.toscrape), so Wikipedia's `Windows_10` and `Boeing_747` stay distinct. 12+ hex segments need a digit. `page-N.html` collapses.
5. **Free-text goal lookup goes through `ftQuery()`** (OR-ed tokens). The raw full-text query is AND-ed and breaks on punctuation.
6. **Repeated item cards collapse.** Links inside `listitem > article` become `link:*` and each distinct card landmark is listed once. Without it two books.toscrape product pages got different signatures ("Products you recently viewed" cards carry other books' titles). Covered by `signature.test.ts`; confirmed on the live site.

## Phase 2 decisions

Deviations from the plan text are marked **(deviation)**.

7. **Follow a route on per-hop confidence, not route probability (deviation from §6.4).** The plan says follow at `pSuccess >= 0.6`. With Laplace smoothing one clean walk of an edge is 2/3, so a 3-hop route walked once scores 0.30 and would never be followed after a single exploration. The rule is now: geometric-mean per-hop success `>= 0.6` (`THETA_HOP` in `packages/core/route.ts`). One clean walk of every edge passes (0.667); an edge that failed as often as it worked (0.5) does not.
8. **A failed edge is not retried inside the same run (`chooseRoute`).** One failure moves an edge from 2-0 to 2-1, which is still the cheapest route, so a planner that only reads the stored risk retries the broken edge. Per-run memory fixes the run; the stored counts fix the next agents. Negative control: with the memory disabled the Phase 2 test fails (three failures instead of one).
9. **How fast the map stops choosing a broken edge is a property of the risk formula, and it is measured, not assumed.** In the recorded run the broken edge (2 successes) was tried and failed on the first redesigned run and again on the next; the third run went around it with no wasted wait. The cost of each failed try is the action timeout (4 s here). A recency weight or a faster decay is a possible change; it is not made.
10. **The "redesign" breaks one action, not the screens (deviation from §10).** Layout B turns the category-card "Quick add" buttons into disabled buttons and adds a text note. The plan also lists renaming "Add to basket", moving search into a menu and changing the category URL. Every one of those changes a screen's signature, so the agent would stand on an unknown screen and have nothing to re-route from; that is a different (and later) story, "the site moved". What this beat shows is the case the graph can answer: the screen is the same, one way out of it stopped working, and another way is known. `shop.test.ts` asserts that B changes no signature.
11. **A fill is stored on the click that leaves the screen, not as an edge.** Typing changes no screen, so a `type` edge would be a self-loop that `SPpaths` never uses, and a route through a search box would replay the click without the text. `ACT.pre` holds a JSON list of `{kind, role, name, nth, slot}` and `ACT.slot` the slot name; **values are never stored** (`loop.db.test.ts` asserts the typed text is not in the graph). Needed because the real model chose the search box.
12. **Exploring is a flag, not a third mode.** `explore: true` on a cold run tells the model which actions the map already knows from the current screen and asks it to prefer others. The plan has two modes (`cold`, `map`); this keeps them and gives the second route the redesign beat needs.
13. **Actions that did nothing are not offered again on that screen in the same run.** Without it the real model retyped the same search box 40 times (first real-model run, 40 LLM calls, failure). The model picks a numbered action from a list the code builds, and the slot is a Zod enum of the task's slot names; the first real run had the model put the typed value where the slot name belongs.
14. **An LLM action becomes an edge only if it worked**: a click must change the screen's `sig`; a fill must succeed. A map step is a failure unless the next `sig` is the one the edge promised, even if the click itself worked. A failed map step keeps its expected target so `explain.cypher` finds it; the screen actually reached is stored on the step as `observed`.
15. **Tests run one file at a time** (`--test-concurrency=1`). Two files each launching Chromium made one navigation hang for 90 s on this machine.
16. **The demo graph is `public:testshop-p2`, deleted and recreated by `npm run p2`.** The shop port (4100) is part of the URL template, so it is fixed.

### Phase 2 result (real model, `docs/receipts/p2-latest.json`)

| Run | Steps | LLM calls | Tokens | Seconds | Notes |
|---|---|---|---|---|---|
| 1 cold | 4 | 4 | 1180 | 11.7 | type search, Search, Quick add, Checkout |
| 2 map | 3 | **0** | 0 | 0.6 | same route, planner only |
| 3.1 explore | 5 | 5 | 1745 | 8.7 | finds the product-page route; the map now has 2 routes |
| 4 map, redesign on | 5 | **0** | 0 | 4.8 | Quick add fails (1 failed step), detour taken from the graph |
| 5.1 map, redesign on | 5 | 0 | 0 | 4.9 | planner still tries Quick add first, fails, detours |
| 5.2 map, redesign on | 4 | 0 | 0 | 0.8 | planner picks the working route first |

One run on one model, one product, one site. These are not the Phase 6 numbers (3 cold + 3 map runs per task, medians and ranges); do not quote them as such.

## Known limitations (not fixed)

- A template screen is shared by every item of that kind, so a route is not product-specific: after two different products are explored, the planner can pick the wrong item's edge. The goal predicate (`checkout` shows the product) catches it; the run then fails or falls back to the LLM. The demo task has one product.
- `ms` averages failed attempts too, so timeouts inflate it.
- `b.visits` is incremented only when a state is the source of a step, so a final-only state shows 0.
- `last_fail` (plan §5) is not written yet.
- After a failed map step that left the screen, the agent presses Back once; if the site has no history entry it stays where it is and the next plan starts from there (unknown screens fall back to the LLM).
- Names containing `:` make action keys ambiguous in theory; collisions are not expected on the demo sites.
- Two edges with the same `key` from one screen to different screens are possible if a site's behaviour changes; the planner treats them as separate edges.
- Tenant-first planning (§6.4), concurrent agents (P4) and the MCP server (P4) are not built yet.
