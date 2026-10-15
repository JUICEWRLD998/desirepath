# Desirepath — implementation plan

> **Don't explore the same site twice. Walk the worn path. Report every step.**
> A shared map of every website's screens and actions, drawn in FalkorDB by the agents that walk them.
> The next agent plans its route on the map instead of re-exploring.

Event: Graph Hacks: Context for AI Agents (WeMakeDevs × FalkorDB). Submissions close **Oct 18, 11:59 PM IST**.
Tracks entered: **Track 02 Agent Memory and Coordination (primary)**, **Track 01 Agents That Act on Connected Data**,
plus the blog side prize. Strategy and evidence: `strategy/` (outside the public repo; do not commit it).
Status: **PLAN ONLY. Nothing is built until he says "GO Desirepath".**

---

## 1. What we are building, in one paragraph

Browser agents explore every website as if no agent had ever been there. On Mind2Web (1,009 human-recorded tasks on
73 real sites), 24.5% of all steps re-walk a step another task on the same site already took, rising to 27.8% once a
site has seen 12 tasks (`strategy/data/m2w_reuse.py`, controls passed). Desirepath turns every agent run into edges
of a per-site graph: **State** (a screen, identified by a deterministic signature) → **ACT** (click, type, select,
navigate) → **State**, with success and failure counts, latency and last-seen time. Before each step an agent asks
the graph for the best route to its goal (`algo.SPpaths`, weighted by failure risk, capped by time). When the graph
has a confident path, the agent executes it without calling the LLM. When it does not, the LLM proposes one action,
and that action becomes an edge only if it works. When a site changes, the edge fails, the planner takes the next-best
path (`pathCount`), and every other agent gets the detour. The map is exposed as an MCP server, so any agent can use it.

## 2. Real-product contract (his G14: a product, never a demo)

Must be real:
- FalkorDB is the only store for the map, the runs and the goals. No shadow copy in memory or SQL.
- Agent runs happen on real public websites through a real headless browser. Every number on screen comes from those runs.
- The planner's route is what the agent executes. No scripted click list anywhere in the demo path.
- The MCP server answers `plan` from the deployed map, for any client.
- The measured reuse curve is reproducible from a clean checkout (`scripts/measure_reuse.py`).

Declared openly (README "What this is NOT" + `CLAIMS.md`):
- The "site redesign" beat runs on **our own test shop** (`apps/testshop`), because we cannot change a real site on cue.
- Mind2Web paths are **human-paved history from 2023 snapshots**. They seed the map and the measurement; agents do not execute on those sites.
- No logins, no captchas, no form submission on real sites (rule 6, and basic manners).
- The live URL shows the map, plans and recorded runs. Live browser execution runs locally or in one worker container (stretch); this is stated in the README.

## 3. Rules compliance (checked against the rules page, 2026-10-15)

| Rule | How we meet it |
|---|---|
| 2, 3: FalkorDB primary and central; "if the product still works once FalkorDB is taken out, the graph is decoration" | Without the graph every agent explores blind; `plan()` *is* a FalkorDB query. The README shows the ablation: same task, map off vs on |
| 6: public, synthetic or own data only | Public sites (robots.txt checked per site, ≤ 1 request/s), our own test shop, Mind2Web (CC-BY-4.0, attributed). Typed values are masked before they reach the graph |
| 8: main coding after Oct 15 12:01 AM IST | All code written after GO; this plan and the strategy notes are allowed preparation |
| 10: repo, README with setup **and graph data model**, **the Cypher queries/algorithms**, demo video, live deployment, tracks | §5 and §7 become `docs/GRAPH_MODEL.md` and `docs/QUERIES.md`, linked from the README; every query lives in `packages/core/queries/*.cypher` |
| 11: disclose AI assistants | `docs/AI_DISCLOSURE.md`: Claude Code used for implementation; he reviewed every file; list of what was generated vs written |
| 12, 13: he must explain the model, queries, architecture, decisions | `DECISIONS.md` written as we go; Phase 8 includes a walkthrough he records in his own words |

## 4. Architecture

```
            ┌───────────────────────────── FalkorDB (Cloud free tier, 100 MB) ─────────────────────────────┐
            │  graph  public:books.toscrape.com   public:quotes.toscrape.com   public:en.wikipedia.org     │
            │         public:openlibrary.org      public:testshop               tenant:acme:testshop  ...  │
            │         m2w:<site> (Mind2Web paving, read-only)                                              │
            └───────────────▲──────────────────────────▲───────────────────────────▲───────────────────────┘
                            │ plan / report / observe   │ map, runs, stats          │ plan / report
                 ┌──────────┴───────────┐    ┌──────────┴───────────┐    ┌──────────┴───────────┐
                 │ packages/agent        │    │ apps/web (Next.js)    │    │ packages/mcp          │
                 │ Playwright loop:      │    │ live map, run replay, │    │ MCP server (HTTP):    │
                 │ observe → plan →      │    │ cold-vs-warm meter,   │    │ plan, report, observe,│
                 │ act → report          │    │ "plan a task" box     │    │ explain, map_stats    │
                 │ LLM only when no path │    └───────────────────────┘    └───────────────────────┘
                 └──────────▲────────────┘                                          ▲
                            │ drives                                                 │ any MCP client
                 real public sites + apps/testshop (redesign toggle)        Claude Code, browser-use, ...
```

All three packages share `packages/core` (signature, risk, Cypher). TypeScript end to end; one Python script for
Mind2Web (DuckDB reads only three columns of the parquet files).

## 5. Graph data model

**Graph naming (FalkorDB multigraph, one isolated graph per key):**
- `public:<domain>`: the shared map of one site, written by every agent.
- `tenant:<tenantId>:<domain>`: a tenant's private overlay (internal pages, private task history). Never copied into `public:*`.
- `m2w:<site>`: Mind2Web human-paved paths, read-only, used for the reuse curve and the "paved" layer on the map.

**Nodes**

| Label | Properties | Meaning |
|---|---|---|
| `State` | `sig` (unique), `url_template`, `title`, `landmarks` (list), `first_seen`, `visits` | a screen, identified by signature (§6.1) |
| `Goal` | `id`, `text`, `site`, `created` | a task that has been completed at least once (semantic memory) |
| `Run` | `id`, `agent`, `tenant`, `task`, `mode` (`cold`/`map`), `started`, `ended`, `outcome`, `steps`, `llm_calls`, `tokens`, `ms` | one agent episode (episodic memory) |
| `Step` | `i`, `action_key`, `ok`, `ms`, `source` (`map`/`llm`) | one step of a run |

**Relationships**

| Type | From → To | Properties | Meaning |
|---|---|---|---|
| `ACT` | State → State | `key` (unique per from-node), `kind` (`click`/`type`/`select`/`navigate`), `role`, `name`, `nth`, `label` (Mind2Web style `[button] search -> click`), `ok`, `fail`, `risk`, `ms`, `last_seen`, `last_fail` | a way to get from one screen to another (procedural memory) |
| `REACHES` | State → Goal | `count`, `last_seen` | this screen satisfied this goal |
| `OF_RUN` | Step → Run | | |
| `FROM` / `TO` | Step → State | | which edge the step walked |

**Indexes:** exact-match on `State(sig)` and `Goal(id)`; full-text on `Goal(text)` for goal lookup (§6.5).

**The three memory types (the Track 02 list, mapped):**
- *Procedural*: `ACT` edges and their statistics, i.e. how to get things done on this site.
- *Episodic*: `Run` and `Step`, what happened, in order, per agent and tenant.
- *Semantic*: `Goal` and `REACHES`, which screens satisfy which kinds of task.
- *Shared state and handoffs*: every agent reads and writes the same `public:*` graph; a failure one agent reports re-routes the next agent's plan.
- *Separate memory per tenant*: `tenant:*` graphs are separate FalkorDB graphs, not filtered rows.

## 6. Core algorithms

### 6.1 State signature (deterministic, no LLM)
1. `url_template`: scheme + host + path, with numeric, UUID and long-hash path segments replaced by `:id`; query keys kept and sorted, values replaced by `:v`.
2. `landmarks`: visible interactive elements and their roles (button, link, textbox, combobox, checkbox, tab) with normalised accessible names (lowercase, digits → `#`, whitespace collapsed), plus heading *roles* without their text, so template pages (every product page) collapse into one state. Keep the first 40 by DOM order, sort them, then hash.
3. `sig = sha1(url_template + "|" + landmark_hash)[0:16]`.
4. **Stability test (Phase 0 and CI):** load each demo URL three times → identical `sig`; two product pages of the same template → identical `sig`; category page vs product page → different `sig`.

### 6.2 Action key
`key = kind + ":" + role + ":" + name + ":" + nth`. Typed values are never stored; the agent fills them from the task at execution time.

### 6.3 Edge risk (the planner minimises it)
`p = (ok + 1) / (ok + fail + 2)` (Laplace-smoothed success rate) · `risk = -ln(p) + 0.05` (the constant prefers fewer steps).
Computed in the recorder query when Cypher `log()` is available; otherwise computed in `packages/core` and SET. Phase 0 checks which.

### 6.4 Planner
`algo.SPpaths({sourceNode, targetNode, relTypes:['ACT'], weightProp:'risk', costProp:'ms', maxCost, pathCount:3})`.
Returns up to three routes. The route's success probability is `exp(-(pathWeight - 0.05·hops))`; the agent follows it
when that is ≥ 0.6 (tunable), otherwise it explores. Tenants: plan on `tenant:*` first, then `public:*`, take the lower weight.

### 6.5 Goal resolution
The task text is matched to known `Goal` nodes with the full-text index; candidate goal states are the `REACHES`
sources of the top matches. If nothing matches, the agent explores and, on success, creates the `Goal` and `REACHES`.
For the scripted demo tasks the goal is a deterministic predicate (URL template + landmark present), so "done" never
depends on an LLM's opinion (G10).

### 6.6 Recording
After each executed action: `observe` the new page → `sig`; `report(from, action, to, ok, ms)` upserts both states
and the edge, increments `ok` or `fail`, updates `ms` (running mean), `last_seen` and `risk`, and writes the `Step`.
A failure is "the expected next state did not appear within the timeout" or "the locator was not found".

### 6.7 Re-route (the redesign beat)
On a failure the agent re-plans from its current state; the failed edge's `risk` has risen, so `SPpaths` returns the
second route. Nothing special-cased: the detour is just the graph doing its job.

### 6.8 Map insights (dashboard, nice-to-have)
`PageRank` over `State`/`ACT` shows hub screens (where most routes pass). `WCC` shows islands: screens no route
reaches any more after a redesign.

## 7. Cypher (lives in `packages/core/queries/`, quoted in `docs/QUERIES.md`)

Exact procedure syntax for full-text, PageRank and WCC is UNVERIFIED until Phase 0 runs each one on the instance.

```cypher
// report.cypher: upsert one walked step (params: from, to, key, kind, role, name, nth, label, ok, fail, ms, now, ...)
MERGE (a:State {sig: $from})
  ON CREATE SET a.url_template = $fromUrl, a.title = $fromTitle, a.landmarks = $fromLandmarks, a.first_seen = $now, a.visits = 0
SET a.visits = a.visits + 1
MERGE (b:State {sig: $to})
  ON CREATE SET b.url_template = $toUrl, b.title = $toTitle, b.landmarks = $toLandmarks, b.first_seen = $now, b.visits = 0
MERGE (a)-[e:ACT {key: $key}]->(b)
  ON CREATE SET e.kind = $kind, e.role = $role, e.name = $name, e.nth = $nth, e.label = $label,
                e.ok = 0, e.fail = 0, e.ms = 0.0
SET e.ok = e.ok + $ok, e.fail = e.fail + $fail,
    e.ms = (e.ms * (e.ok + e.fail - 1) + $ms) / (e.ok + e.fail),
    e.last_seen = $now,
    e.risk = -log((e.ok + 1.0) / (e.ok + e.fail + 2.0)) + 0.05
RETURN e.ok, e.fail, e.risk
```

```cypher
// plan.cypher: up to three routes from the current screen to a goal screen
MATCH (s:State {sig: $current}), (g:State {sig: $goal})
CALL algo.SPpaths({sourceNode: s, targetNode: g, relTypes: ['ACT'],
                   weightProp: 'risk', costProp: 'ms', maxCost: $maxMs, pathCount: 3})
YIELD path, pathWeight, pathCost
RETURN [r IN relationships(path) | {key: r.key, kind: r.kind, role: r.role, name: r.name, nth: r.nth,
                                    ok: r.ok, fail: r.fail, ms: r.ms}] AS steps,
       pathWeight, pathCost
ORDER BY pathWeight ASC
```

```cypher
// goals.cypher: which screens satisfied tasks like this one
CALL db.idx.fulltext.queryNodes('Goal', $text) YIELD node, score
MATCH (st:State)-[r:REACHES]->(node)
RETURN st.sig AS goalSig, node.text AS goalText, score, r.count AS times
ORDER BY score DESC, times DESC LIMIT 5
```

```cypher
// explain.cypher: the runs that walked one edge (the dashboard's "proof" click)
MATCH (a:State)-[e:ACT {key: $key}]->(b:State) WHERE a.sig = $from
MATCH (st:Step)-[:FROM]->(a), (st)-[:TO]->(b), (st)-[:OF_RUN]->(r:Run)
WHERE st.action_key = $key
RETURN r.id, r.agent, r.mode, st.ok, st.ms, r.started ORDER BY r.started DESC LIMIT 20
```

```cypher
// stats.cypher: per-map numbers for the meter
MATCH (r:Run) RETURN r.mode AS mode, count(r) AS runs, avg(r.steps) AS steps, avg(r.ms) AS ms, avg(r.llm_calls) AS llm
```

## 8. The agent loop (`packages/agent`)

```
run(task, site, mode):
  page = browser.open(site.start)
  goal = mode == 'map' ? resolveGoal(task) : null              # §6.5
  for step in 1..MAX_STEPS (40):
    cur = observe(page)                                        # §6.1 → sig, landmarks, candidates
    if goalPredicate(task, cur): finish(success)
    route = (mode == 'map' && goal) ? plan(cur.sig, goal) : null
    if route && route.p >= THETA:
        action = route.steps[0]; source = 'map'                # no LLM call
    else:
        action = llm.propose(task, cur.candidates, hints = nearbyEdges(cur.sig)); source = 'llm'
    t0 = now(); ok = execute(page, action, task.slots); ms = now() - t0
    nxt = observe(page)
    report(cur, action, nxt, ok, ms, source, runId)            # §6.6, map always learns, both modes
    if !ok and source == 'map': continue                       # re-plan next loop (§6.7)
  finish(failure)
```

- `observe`: Playwright's accessibility tree for roles and names (`locator.ariaSnapshot()` or element queries; Phase 0 picks the one that works on all five sites), plus `page.url()` and `page.title()`.
- `execute`: `page.getByRole(role, { name, exact: true }).nth(nth)` then click / fill / selectOption. Typed values come from the task's slots (e.g. `query: "travel"`).
- `llm.propose`: one structured-output call (`{kind, role, name, nth, value?}`) over a numbered list of at most 60 candidates and the task. Provider-agnostic through the Vercel AI SDK, so Gemini, Anthropic, OpenRouter or a local Ollama model all work (decided by Q1).
- **Cold mode** (`mode='cold'`) is the honest baseline: same loop, planner disabled, map still recorded. **Map mode** is the product.
- Concurrency: `runner --agents 3 --tenant acme` launches three browser contexts in parallel against the same `public:*` graph.

## 9. MCP server (`packages/mcp`, Streamable HTTP + stdio)

| Tool | Input | Output |
|---|---|---|
| `observe` | `site`, `url`, `landmarks[]` (or raw accessibility snapshot) | `{ sig, known, visits }` |
| `plan` | `site`, `task`, `current_sig`, `tenant?`, `max_ms?` | `{ goal_sig, routes: [{ steps[], p_success, est_ms }], source: 'map' }` or `{ routes: [] }` |
| `report` | `site`, `from_sig`, `action`, `to_sig`, `ok`, `ms`, `run_id`, `tenant?` | `{ edge: { ok, fail, risk } }` |
| `explain` | `site`, `from_sig`, `action_key` | runs that walked the edge, with outcomes |
| `map_stats` | `site` | states, edges, runs, cold-vs-map averages |

Any MCP agent (Claude Code, a browser-use agent, Cursor) can add Desirepath with one config line. The README shows
Claude Code calling `plan` for a books.toscrape.com task.

## 10. Sites and tasks (the demo set)

Chosen because they are public, permit reading by bots at low rates, need no login, and have multi-step navigation.
Phase 0 checks each `robots.txt` and records it in `docs/SITES.md`.

| Site | Example tasks (slots) | Goal predicate |
|---|---|---|
| books.toscrape.com (built for scraping practice) | open the `{category}` category and find the cheapest book; open page 2 of `{category}` | URL template `/catalogue/category/books/:id/` + price list present |
| quotes.toscrape.com (same) | find quotes tagged `{tag}` by `{author}` | `/tag/:id/` + author filter visible |
| openlibrary.org | find the editions page of `{title}` | `/works/:id/editions` |
| en.wikipedia.org (read-only, ≤1 req/s) | from the article on `{topic}`, reach its "History" section's linked main article | target article URL |
| **apps/testshop** (ours) | add `{product}` to the cart and reach checkout (no payment) | `/checkout` with the cart line |

**Test shop (`apps/testshop`):** about 6 pages (home, category, product, search, cart, checkout). It has a **"redesign" switch** (`?layout=b` or an admin toggle) that renames the "Add to basket" button to "Buy now", moves the search box into a menu, and changes the category URL scheme. That gives the deterministic failure beat (B3), and it is our own data (rule 6).

## 11. Mind2Web paving and the measurement (`scripts/`)

- `scripts/measure_reuse.py`: the cleaned version of `strategy/data/m2w_reuse.py` (DuckDB over the remote parquet files, three columns). It prints overall reuse, the per-site table, the growth curve, and both controls (cross-site ≈ 0%, planted duplicate = 100%). It must reproduce **24.5%** and the curve (4.9 / 8.5 / 13.8 / 20.2 / 27.8 %) from a clean machine.
- `scripts/pave_mind2web.ts`: loads each Mind2Web site's tasks into `m2w:<site>`: states are step positions keyed by `(site, normalised action prefix)`, edges are the normalised actions, weighted by how many tasks walked them. This is the "human-paved" layer the dashboard draws in a different colour. Attribution: "Mind2Web (Deng et al., 2023), CC-BY-4.0".
- Recorded 2026-10-15: 1,009 tasks, 73 sites, 7,775 steps in the partial-train parquet. About 8k edges fits FalkorDB Cloud's 100 MB (checked in Phase 0).

## 12. Dashboard (`apps/web`) — design the wow screen first

Run **`ui-studio`** with its kickoff. House stack: Next.js, CSS Modules with design tokens, Motion (`motion/react`),
**no Tailwind**. Derive the visual vocabulary from the subject, not from a reference: desire paths, foot traffic,
worn trails, contour lines, survey markers. Edges get thicker with traffic and warmer with success; failed edges go
dashed and red; the planned route glows. One choreographed signature moment: **the route lighting up hop by hop while
the agent's browser follows it.** Measure contrast and colour difference; check every width from 320 to 1920 px.

Screens:
1. **The map** (wow screen): force-directed or layered layout of one site's `State`/`ACT` graph; human-paved layer toggle; click an edge → the `explain` panel with the runs, success rate, latency, last seen.
2. **Cold vs map** meter: two recorded runs side by side (browser frames from Playwright's trace or screenshots per step), step counter, seconds, LLM calls, tokens.
3. **Plan a task** (the judge's own input): pick a mapped site, type a task → `plan` returns the route instantly from the graph and draws it. If the goal is unknown, it says so plainly and shows the nearest known goals.
4. **Runs**: the episodic log, per agent and tenant, with a concurrency view of three agents writing at once.

## 13. Repo layout

```
desirepath/
  packages/core/        signature.ts, risk.ts, graph.ts (FalkorDB client), queries/*.cypher, tests/
  packages/agent/       loop.ts, observe.ts, execute.ts, llm.ts (AI SDK), runner.ts (CLI), tasks/*.json
  packages/mcp/         server.ts (tools §9)
  apps/web/             Next.js dashboard (§12)
  apps/testshop/        our test site with the redesign switch (§10)
  scripts/              measure_reuse.py, pave_mind2web.ts, demo_runs.ts
  docs/                 GRAPH_MODEL.md, QUERIES.md, SITES.md, AI_DISCLOSURE.md
  README.md  CLAIMS.md  DECISIONS.md  LICENSE (MIT)
```

## 14. Phases (milestones; each ends with evidence, not a feeling)

**P0 Spikes (nothing else starts until all pass)**
- FalkorDB Cloud free instance created; `falkordb` npm client connects; one `GRAPH.QUERY` round trip timed.
- On a 6-node toy graph: `algo.SPpaths` with a **float** `weightProp`, `costProp` + `maxCost`, and `pathCount: 3` returns three routes in weight order. Record the exact output in `DECISIONS.md`.
- Cypher `log()` exists (else compute risk in TS); full-text index create + query on `Goal`; `PageRank` and `WCC` procedure syntax on this version.
- Two graphs (`public:x`, `tenant:a:x`) on one instance, queried in the same request.
- Playwright Chromium launches headless on his machine; the accessibility-snapshot method returns roles and names on all five sites.
- Signature stability test (§6.1) passes on the five sites. **Switch trigger to Rota if it fails on 3 of 5.**
- LLM key (Q1) answers one structured-output call.
- Done when: `DECISIONS.md` has every result with its raw output.

**P1 Core (TDD)**: `signature.ts`, `risk.ts`, the four Cypher files, `graph.ts`. Tests on fixtures: risk rises with failures; the planner prefers a 3-hop reliable route over a 2-hop flaky one; a failed edge makes the second route win; tenant graphs never leak into public. Done when: tests green, `docs/GRAPH_MODEL.md` written.

**P2 Thin path on the test shop**: test shop pages + redesign switch; the agent loop in cold and map modes; one task end to end: a cold run explores and records, then a map run follows the route with zero LLM calls; flip the switch, and the next map run fails one edge and re-routes. Done when: the three runs are reproducible from a clean checkout with one command.

**P3 Real sites**: tasks for books, quotes, Open Library, Wikipedia; 2-3 exploration runs per task recorded; `robots.txt` notes in `docs/SITES.md`; rate limiting. Done when: each site has a map in which at least one task has a map-mode run with fewer steps than its cold run.

**P4 MCP + coordination**: MCP server with the five tools; the runner's three-agent concurrent mode; tenant overlay; `scripts/pave_mind2web.ts`. Done when: Claude Code calls `plan` and gets a route; three agents write concurrently with no lost updates (counts add up).

**P5 Dashboard**: `ui-studio` pipeline, wow screen first; map, meter, plan box, runs. Done when: verified in a real browser at all widths, with screenshots, and the plan box answers a judge's free text.

**P6 Measure the claims**: `scripts/demo_runs.ts`: for each of 9 tasks, 3 cold and 3 map runs (warm after one exploration). Report median and range of steps, seconds, LLM calls and tokens, plus success rate. Commit the raw run log. These numbers, and only these, go in the README and the video. Done when: `CLAIMS.md` maps every README number to the command that reproduces it.

**P7 Deploy**: web + test shop on Vercel; MCP server on Render or Fly (HTTP); FalkorDB Cloud. Run the judge's path from a clean browser: open the URL → map → click an edge → plan a task. Done when: that works on the deployed URL, not localhost.

**P8 Package and submit**: README (scoring map, graph model, queries, setup, live links, what this is NOT, AI disclosure); 2-minute video via `demo-video` from the deployed link; his blog post in his own words (`humanizer` pass); pre-submit grep `mock|fake|dummy|lorem|0x0000|picsum|randomuser|example.com`; submission form with **Track 02 + Track 01** named. **He presses submit.**

Dates (facts, for packaging only): thin path (P2) by Oct 16 18:00 IST · feature-complete (P5) by Oct 17 20:00 IST · demo freeze Oct 18 10:00 IST · submitted by Oct 18 20:00 IST (4 hours of buffer before the close).

## 15. README scoring map (the top third)

| What the event asks | Where it is in Desirepath |
|---|---|
| "The graph has to do real work" (rule 3) | ablation: map off = cold run; map on = route from `algo.SPpaths` |
| Procedural / episodic / semantic memory | `ACT` / `Run`+`Step` / `Goal`+`REACHES` (§5) |
| Shared state and handoffs between agents | one agent's failure re-routes the next agent (P2 beat) |
| High-concurrency reads and writes | three agents writing one graph at once (P4) |
| Separate memory per user or tenant | `tenant:*` graphs on the same instance (multigraph) |
| Graph algorithms as agent tools | `SPpaths` every step; `PageRank`, `WCC` on the dashboard |
| Tool selection through MCP | the MCP server (§9), used from Claude Code |
| Explainable results | every step shows the edge it took and the runs behind it |

## 16. Demo video (2 minutes, made with `demo-video` after P7)

1. 0:00 the pain: a cold agent wandering on a real site, step counter climbing (real recorded run, sped up and labelled).
2. 0:15 same task, map on: the route lights up, the agent follows it (measured numbers from P6 on screen).
3. 0:35 the measurement: "a quarter of steps were already walked by someone" + the growth curve.
4. 0:55 the test shop redesign: an edge goes red, the detour is taken, the map heals.
5. 1:15 three agents, two tenants, one graph; private stays private.
6. 1:35 Claude Code calls `plan` through MCP.
7. 1:50 end on proof: live URL, MCP endpoint, repo, `scripts/measure_reuse.py`.

## 17. Risks, fallbacks, cut list

| Risk | Trigger | Fallback |
|---|---|---|
| No usable LLM key (Q1) | P0 call fails | local Ollama model for exploration on the test shop; Mind2Web paving; map-mode runs need no LLM |
| `SPpaths` rejects float weights | P0 | scale `risk` to an integer (×1000) |
| Signatures unstable | P0 stability test | add landmark filters per site; drop unstable sites; switch to Rota if 3 of 5 fail |
| A real site blocks or changes mid-event | P3 / P6 | record runs early; keep the test shop as the scripted beat; drop the site |
| FalkorDB Cloud 100 MB too small | P0 size check | load fewer Mind2Web sites; or run FalkorDB in Docker on the MCP host |
| Hosting Chromium for live runs | P7 | live URL shows map, plans and recorded runs; execution stays local (declared) |

Cut in this order: hosted live-execution worker → Wikipedia and Open Library (keep books, quotes, test shop) →
PageRank/WCC insights → Mind2Web map layer (keep the measurement script) → tenant UI (keep the backend test).
**Never cut:** planner + recorder, the test-shop re-route beat, the cold-vs-map measurement, the MCP `plan` tool.

## 18. Verification plan

- Unit: signature stability fixtures; risk monotonic in `fail`; planner prefers reliable over short; tenant isolation.
- Integration: the P2 three-run script is the regression test; run it before every deploy.
- Claims: every number in README and video maps to a command in `CLAIMS.md`; the measurement script reproduces 24.5% and the curve.
- Browser: dashboard checked in a real browser (ui-studio gate) at 320/375/414/768/1024/1280/1440/1920 px.
- Pre-submit: grep for placeholders; clean-browser judge path on the deployed URL; `npm run verify` green.

## 19. Answers (2026-10-15)

1. **Q1 answered: OpenRouter key.** Agent LLM goes through OpenRouter (OpenAI-compatible endpoint, Vercel AI SDK `@openrouter/ai-sdk-provider` or base URL swap). P0 picks one cheap tool-calling model and records its id, price and a structured-output test. Key lives in `.env` only, never committed.
2. **Solo.** Phases run in sequence; P5 dashboard follows P4.
3. **FalkorDB Cloud free tier only, no Docker.** P0 size check decides how many Mind2Web sites load into 100 MB.
4. **Real users: only him.** Honest effect: G14's "real users" and moat M1 are NOT met. Mitigation, all in the window: log every run as real usage, publish the MCP endpoint, post once in the FalkorDB and WeMakeDevs Discords in P8 (he sends it), and report only measured numbers. README says "single-user so far". M2 (the Mind2Web curve), M4 (live map + MCP) and M6 (taste) carry the entry.

**Next step: reply "GO Desirepath" to start P0.**

**Next step: reply "GO Desirepath" (with the Q1 answer) to start P0.**
