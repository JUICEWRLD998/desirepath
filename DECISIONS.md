# Decisions

Raw output of every spike: `spikes/out/`. Raw output of the Phase 2 run: `docs/receipts/p2-latest.json`.

**Local** = a FalkorDB module (ver 41803) from the `falkordblite` 0.10.0 PyPI package, started by hand with `redis-server --loadmodule falkordb.so` (see README, "Local FalkorDB"). Phase 1 and 2 were first developed against it; since 2026-10-16 everything also passes on Cloud.
**Cloud** = the FalkorDB Cloud free instance. Connected on 2026-10-16 with the split FALKORDB_HOST/PORT/USERNAME/PASSWORD fields (the FALKORDB_URL form is rejected, probably URL-encoding of the password).

## Where each phase stands (2026-10-16)

| Phase | State | Evidence |
|---|---|---|
| P0 Spikes | **Done except Open Library** (its host times out from this machine). Every FalkorDB spike passes on Cloud. | table below, `spikes/out/falkor.json` |
| P1 Core | **Done.** 38 core tests green (risk, signature, route chooser, and the graph, report, run/step/goal database tests), `docs/GRAPH_MODEL.md` written. | `npm test` |
| P2 Thin path | **Done, on local FalkorDB and on Cloud, with the real model** (`google/gemini-2.5-flash` via OpenRouter). | `npm run p2`, `docs/receipts/p2-latest.json` |
| P3 Real sites | **Done except the "fewer steps" criterion**: 32 of 32 runs succeeded on books.toscrape.com, quotes.toscrape.com and Wikipedia; map runs used 0 LLM calls against 26 for cold; steps were equal. Open Library not run. | `npm run p3`, `docs/receipts/p3-latest.json`, `docs/SITES.md` |
| P4 MCP and coordination | **Done** (verified with the MCP SDK client, not Claude Code itself): five tools, concurrent writes lose nothing, tenant overlay, Mind2Web paved and measured. | `packages/mcp`, `npm test`, `npm run mcp:demo`, `npm run pave` |

Whole suite: `npm test` gives 70 tests, 70 pass **on Cloud** (also on a local FalkorDB). `npm run p2` also passes on Cloud (cold 4 steps / 4 LLM calls; map 3 steps / 0; redesign: 1 failed step, detour with 0 LLM calls; 2 failures before the planner stopped choosing the broken edge). Cloud is about 300 ms per query, so runs are slower there than local (map run 5.5 s against 0.6 s).

Size check: the Phase 2 demo graph (43 nodes, 96 edges) and every Mind2Web graph report 0 MB on Cloud (the server rounds to whole megabytes), so nothing has come close to the 100 MB free tier.

## Phase 0

| Spike | Local | Cloud | Result |
|---|---|---|---|
| Connection round trip | pass (6.6 ms) | **pass (305 ms)** | Cloud first rejected the URL form and the old password; split fields work |
| `algo.SPpaths`, float `weightProp`, `costProp`+`maxCost`, `pathCount: 3` | pass | **pass** | three routes in weight order, see below |
| Cypher `log()` | pass | **pass** | `-log(0.5)` = 0.693147180559945; risk is computed in Cypher |
| Full-text index on `Goal` | pass | **pass** | `CALL db.idx.fulltext.createNodeIndex('Goal','text')`, `queryNodes('Goal','travel')` |
| `algo.pageRank`, `algo.WCC` syntax | pass | **pass** | `CALL algo.pageRank('S','ACT')`, `CALL algo.WCC({nodeLabels:['S'],relationshipTypes:['ACT']})` |
| Two graphs (`public:x`, `tenant:a:x`) in one request | pass | **pass** | colon names work and are isolated |
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

**Cloud:** connected on 2026-10-16 (split host fields); `npm run p0:falkor` passes every row above on Cloud. The only open Phase 0 item is Open Library.

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

## Phase 3 and 4 decisions

Numbers from `docs/receipts/p3-latest.json` (`npm run p3`, 8 tasks on 3 real sites, 2 cold + 2 map runs each, `google/gemini-2.5-flash`). One run of the script, one model: not the Phase 6 measurement.

| | Runs | Succeeded | LLM calls | Tokens | Steps | Failed map steps | Seconds (sum) |
|---|---|---|---|---|---|---|---|
| cold | 16 | 16 | 26 | 39,552 | 26 | n/a | 198 |
| map | 16 | 16 | **0** | **0** | 26 | **0** | 190 |

**The plan's Phase 3 criterion is not met, and I am not going to bend it.** The criterion was "at least one task per site has a map-mode run with fewer steps than its cold run". On every one of the 8 tasks the cold run already took the shortest path (1 to 3 steps), so the map run takes the same number of steps. What the map removes is the model: 26 calls and about 39.5k tokens became 0, with no failures. Wall time is the same because the 1-action-per-second politeness delay and page loads dominate. Steps do drop when a fill precedes a click (test shop, search box: cold 4 steps, map 3), but the real sites cannot show that: Wikipedia's `robots.txt` disallows its search, Open Library is unreachable from this machine, and the two toscrape sites have no search.

17. **Robots, pacing and identity are in the loop, not in the scripts.** `robots.txt` is fetched per origin; a main-frame navigation it disallows is aborted (a 5xx answer stops the run, a 404 allows everything); one action per second; user agent says who we are (`docs/SITES.md`). Wikipedia's search is disallowed for generic agents, so the Wikipedia tasks follow article links only.
18. **Scripted tasks find their goal by exact id; free text is the fallback.** Sharing one graph per site, a task's text matched another task's goal ("open page 3 of Default" followed the Mystery route) and a Yosemite run landed on the Erosion goal. `goalSigById` fixes scripted runs; goal text is stored with underscores as spaces because the full-text index keeps `Yosemite_National_Park` as one token.
19. **Template screens are shared by every item of their kind, so the cheapest route can belong to another task.** All category pages are one screen, so "Mystery then book X" and "Travel then book X" are both routes to X's page. Fix: among eligible routes the agent takes one whose every step *the same task* has walked in a successful run (`owned_edges.cypher`), else the cheapest. `plan` over MCP does the same for the matched goal (`walked_for_this_goal`). It is a patch for a real limit of signature-based states, not a cure: a brand-new slot value has no history and falls back to the cheapest route.
20. **Pagination is a self-loop.** Page 2 and page 3 have the same template and landmarks, so they are one screen and "next" is an edge from it to itself. Two fixes: a click counts as having moved when the URL changed even if the signature did not, and on the goal's screen with the predicate still unmet the agent repeats the most-walked self-loop edge. Goals that need a specific page add `urlIncludes`.
21. **A slow page is not a failed click.** A click that worked but whose `load` event took more than the timeout was recorded as a failure, the state was never stored, and the goal write crashed on the missing screen (`Cannot convert undefined or null to object`, books-open-book). Now the load wait is best-effort, and `recordReach` creates the screen if it is missing.
22. **Free-text goal ranking is done in code.** The full-text index scored "Open page 2 of the Mystery category" (2.0) above the exact text of the book goal (1.0) for the task "Open the book Under the Tuscan Sun from the Travel category". The index now only fetches candidates (12); they are re-ranked by word overlap with the task (Jaccard), then by times reached.
23. **MCP server: five tools, stateless Streamable HTTP and stdio, writes behind a token.** `observe`, `plan`, `report`, `explain`, `map_stats` (`packages/mcp`). Reads never create a graph (a read on a missing key would). `report` over HTTP needs `MCP_WRITE_TOKEN` when set; writes can be limited to named sites (`MCP_WRITABLE_SITES`); new maps need `MCP_ALLOW_NEW_SITES=1`. Inputs are length-limited and site and tenant names are restricted to `[A-Za-z0-9._-]`; a name that tries to escape the graph namespace is rejected (tested). **The done-criterion says "Claude Code calls `plan`". It was verified with the official MCP SDK client over stdio and over HTTP (`npm run mcp:demo`, `mcp.db.test.ts`), not with Claude Code itself.** The repo ships `.mcp.json` and the README has the `claude mcp add` line; running it from Claude Code is the author's check.
24. **Tenants: separate graphs, planned first, never copied.** `plan` with a `tenant` reads `tenant:<id>:<site>` and `public:<site>` and, for the same goal, the lower-weight route wins (§6.4); `report` with a `tenant` writes only to the tenant graph (test: public edge count unchanged).
25. **Concurrency: the database serialises writes to a graph, so counters cannot lose updates; this is tested, not assumed.** Three browser agents on the test shop: 9 steps, 3 runs, every edge `ok` = 9, goal reached 3 times. Three MCP clients reporting the same edge 8 times each: exactly +24.
26. **Paving: a state is a position in a task, not a page.** `scripts/pave_mind2web.ts` loads all 73 Mind2Web sites into `m2w:<site>` (7,157 states, 7,084 edges, 137 s on Cloud). Because a state is the action prefix, the graphs are close to trees (edges = states - 1 per site) and share much less than the transition measure below suggests. Free-tier size: FalkorDB reports 0 MB for every graph (rounded to whole megabytes), so each is under half a megabyte and the 77 graphs together are under about 38 MB; a precise figure is not available from the server.
27. **The reuse measurement reproduces.** `scripts/measure_reuse.py` (DuckDB over three columns of the public parquet files): 24.5% of 7,775 steps were already walked by another task on the same site; growth curve 4.9 / 8.5 / 13.8 / 20.2 / 27.8% for 1 / 2 / 4 / 8 / 12 earlier tasks; control cross-site 0.2% (want near 0), planted duplicate 100.0%. The script exits 1 if a control fails.

## Known limitations (not fixed)

- A template screen is shared by every item of that kind, so a route is not product-specific: after two different products are explored, the planner can pick the wrong item's edge. The goal predicate (`checkout` shows the product) catches it; the run then fails or falls back to the LLM. The demo task has one product.
- `ms` averages failed attempts too, so timeouts inflate it.
- `b.visits` is incremented only when a state is the source of a step, so a final-only state shows 0.
- `last_fail` (plan §5) is not written yet.
- After a failed map step that left the screen, the agent presses Back once; if the site has no history entry it stays where it is and the next plan starts from there (unknown screens fall back to the LLM).
- Names containing `:` make action keys ambiguous in theory; collisions are not expected on the demo sites.
- Two edges with the same `key` from one screen to different screens are possible if a site's behaviour changes; the planner treats them as separate edges.
- Tenant-first planning (§6.4), concurrent agents (P4) and the MCP server (P4) are not built yet.
