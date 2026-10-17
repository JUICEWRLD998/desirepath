# Desirepath

> Do not explore the same site twice. Walk the worn path. Report every step.

A shared map of the screens of every website and actions, stored in FalkorDB and drawn by the agents that walk them. Before each step an agent asks the graph for the best route to its goal. When the graph has a confident path, the agent follows it without calling the model. When a site changes, the failed edge is recorded and the next agent is routed around it.

Built for **Graph Hacks: Context for AI Agents** (WeMakeDevs x FalkorDB). Tracks: **02 Agent Memory and Coordination** (primary) and **01 Agents That Act on Connected Data**.

| | |
|---|---|
| Live dashboard | TODO-URL (see [deploy.md](deploy.md)) |
| MCP endpoint | TODO-URL/mcp |
| Demo video | TODO-URL |
| Numbers behind every claim | [CLAIMS.md](CLAIMS.md) |
| Graph model, Cypher, decisions | [docs/GRAPH_MODEL.md](docs/GRAPH_MODEL.md), [docs/QUERIES.md](docs/QUERIES.md), [DECISIONS.md](DECISIONS.md) |
| AI assistants used | [docs/AI_DISCLOSURE.md](docs/AI_DISCLOSURE.md) |

## The problem

Browser agents explore every website as if no agent had ever been there. On Mind2Web (1,009 human-recorded tasks on 73 real sites), 24.5% of all steps repeat a step another task on the same site already took (`python scripts/measure_reuse.py`, controls pass). That work is thrown away on every run.

## How FalkorDB does the work

Take FalkorDB out and every agent explores blind: the planner **is** a FalkorDB query (`algo.SPpaths`).

| What the event asks | Where it is in Desirepath |
|---|---|
| The graph has to do real work | Every step starts with `algo.SPpaths` (weighted by failure risk, `pathCount: 3`, capped by time). Map off is a cold run; map on is a route from the graph |
| Procedural memory | `ACT` edges between screens: success and failure counts, latency, risk, last seen |
| Episodic memory | `Run` and `Step` nodes: what each agent did, in order |
| Semantic memory | `Goal` nodes and `REACHES` edges, found by full-text search on a task written in words |
| Shared state and handoffs | Every agent reads and writes the same `public:<site>` graph. One agent failure re-routes the next |
| Concurrent reads and writes | Three browser agents on one graph lose no update (9 steps, 3 runs, every edge count exact), and three MCP clients reporting one edge 8 times each give exactly +24 |
| Separate memory per tenant | `tenant:<id>:<site>` is a separate FalkorDB graph, planned first and never copied into the public one |
| Graph algorithms as agent tools | `plan` and `explain` over MCP; `algo.SPpaths` on every plan |
| Tool selection through MCP | Five tools: `observe`, `plan`, `report`, `explain`, `map_stats` (stdio and Streamable HTTP) |
| Explainable results | Every trail on the dashboard shows the runs behind it |

Graph data model (full version in [docs/GRAPH_MODEL.md](docs/GRAPH_MODEL.md)): `State` (a screen, identified by a deterministic signature of its URL template and landmarks) with `ACT` edges to other `State` nodes; `Goal`, `Run` and `Step` nodes for the semantic and episodic memory. The Cypher is in [docs/QUERIES.md](docs/QUERIES.md).

## What the measurements show

Details, commands and every number: [CLAIMS.md](CLAIMS.md). In short, on real sites (books.toscrape.com, quotes.toscrape.com, Wikipedia; 3 cold and 3 map runs per task):

- a map run makes **no model call and uses no tokens**, and it succeeds as often as a cold run;
- a map run takes the **same number of steps** (the cold run already finds a short path on these small sites) and is only about a second quicker in the median, because a one-action-per-second politeness delay and page loads dominate the time. All 48 runs succeeded.

On our own test shop, after a simulated redesign breaks one button, the next map run fails that one step, takes the next route from the graph with zero model calls, and the planner stops choosing the broken edge.

## What this is NOT

- Not a benchmark of agent accuracy, and not compared with other systems.
- **Single user so far.** I am the only user; there is no usage from anyone else.
- The redesign beat runs on **our own test shop** (`apps/testshop`), because a real site cannot be redesigned on cue.
- Mind2Web paths are human-recorded history from 2023 snapshots. They seed the measurement and a read-only graph layer; no agent runs on those sites.
- No logins, form submissions, payments or captchas on real sites. robots.txt is obeyed, one action per second, identified user agent ([docs/SITES.md](docs/SITES.md)).
- Open Library is not measured: its host times out from my machine.
- The live dashboard and MCP server read and plan from the stored map. Browser execution (the agent) runs on your machine.

## Demo

[DEMO.md](DEMO.md) has the step-by-step demo and the voiceover script. Quickest check without a browser: `npm run mcp:demo` asks the MCP server for a route on books.toscrape.com.

## What works today

On our own test shop (`apps/testshop`), with `google/gemini-2.5-flash` through OpenRouter (`npm run p2`,
raw numbers in [`docs/receipts/p2-latest.json`](docs/receipts/p2-latest.json); one run, not the Phase 6 measurement):

| Run | Steps | LLM calls | What happened |
|---|---|---|---|
| cold | 4 | 4 | the model explores; every step is recorded in the graph |
| map | 3 | **0** | the planner returns the route; the agent follows it |
| map, after the shop's "redesign" | 5 | **0** | the best route's last click fails; the next route is taken from the graph |

The redesign disables the product cards' "Quick add" buttons. It does not touch any other control or URL, so the
screens keep their signatures and the graph still knows another way. See DECISIONS 10.

## Setup

```bash
git clone https://github.com/juicewrld998/desirepath.git
cd desirepath
npm install
npx playwright install chromium     # if Playwright cannot find a browser
cp .env.example .env                # then fill in the keys, see below
```

### Keys (go in `.env`, never committed)

| Variable | Where to get it |
|---|---|
| `FALKORDB_URL` | Create a free instance at <https://app.falkordb.cloud>, copy its connection string. Docs: <https://docs.falkordb.com/cloud>. If the password has special characters use the split `FALKORDB_HOST/PORT/USERNAME/PASSWORD` fields |
| `OPENROUTER_API_KEY` | <https://openrouter.ai/keys> (credit: <https://openrouter.ai/credits>) |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash` (all models: <https://openrouter.ai/models>) |

### Local FalkorDB (what the tests and `npm run p2` ran against)

Optional: everything also passes on FalkorDB Cloud; a local one avoids network latency. It is a FalkorDB module from the `falkordblite` PyPI package. On Windows that means WSL (Ubuntu); this is what was run:

```bash
# once, inside WSL
mkdir -p ~/fdb && cd ~/fdb
python3 -m venv --without-pip v && curl -sSL https://bootstrap.pypa.io/get-pip.py -o get-pip.py
./v/bin/python get-pip.py && ./v/bin/pip install falkordblite
# every time. No password: use it only on your own machine.
./v/lib/python3.12/site-packages/redislite/bin/redis-server --port 6390 --bind 0.0.0.0 --protected-mode no --save "" \
  --loadmodule ./v/lib/python3.12/site-packages/redislite/bin/falkordb.so
```

Then point the tools at it for one command: `FALKORDB_HOST= FALKORDB_URL=redis://127.0.0.1:6390 npm test` (the empty `FALKORDB_HOST` stops a host in `.env` from taking priority). A value in the shell wins
over `.env`.

## Commands

```bash
npm test                  # 70 tests (needs FalkorDB via `.env` and Chromium; the database tests skip when none is configured)
FALKORDB_HOST= FALKORDB_URL=redis://127.0.0.1:6390 npm test      # against a local FalkorDB instead (files run one at a time on purpose)
npm run typecheck         # tsc --noEmit

npm run p2                # Phase 2 with the real model: cold run, map run, explore, redesign, detour. Resets public:testshop-p2
npm run shop              # the test shop on http://127.0.0.1:4100  (flip the redesign: /_layout?set=b, back: /_layout?set=a)
npm run agent -- --task testshop-add-and-checkout --mode cold        # one run against the shared map
npm run agent -- --task testshop-add-and-checkout --mode map         # flags: --explore --headed --base --site --tenant --max-steps

npm run p6                # Phase 6: 3 cold + 3 map runs per task, writes docs/receipts/p6-*.json and CLAIMS.md (about an hour)
npm run web:build && npm run web:start   # dashboard on http://localhost:3100 (read-only)
npm run p3                # Phase 3: cold and map runs on books.toscrape.com, quotes.toscrape.com, Wikipedia (polite: robots.txt, 1 action/s)
npm run agent -- --task testshop-add-and-checkout --mode cold --agents 3   # three agents at once, one graph
python scripts/measure_reuse.py [--export data/m2w.json]   # Mind2Web reuse measurement + controls (needs duckdb)
npm run pave              # load data/m2w.json into read-only graphs m2w:<site>

npm run p0:net            # which demo hosts this machine can reach
npm run p0:falkor         # FalkorDB: SPpaths, log(), full-text, PageRank, WCC, two graphs  (writes spikes/out/falkor.json)
npm run p0:llm            # one structured-output call through OpenRouter
npm run p0:sites          # signature stability on the live demo sites (ONLY=openlibrary GOTO_TIMEOUT=90000 to narrow)
```

## Use the map from any MCP client

Five tools: `observe` (page to screen signature, is it in the map), `plan` (routes to a goal described in words), `report` (record a step you walked), `explain` (the runs behind an edge), `map_stats`.

```bash
claude mcp add desirepath -- npx tsx packages/mcp/server.ts        # stdio; the repo also ships a project-scoped .mcp.json
npm run mcp -- --http 8787                                          # Streamable HTTP at /mcp, GET /health
npm run mcp:demo                                                    # a standard MCP client asks for a route on books.toscrape.com
```

HTTP safety: set `MCP_WRITE_TOKEN` and `report` needs `Authorization: Bearer <token>`; `MCP_WRITABLE_SITES=a.com,b.com` limits writes; new maps are created only with `MCP_ALLOW_NEW_SITES=1`. Reads never create a graph. Pass `tenant` to read and write a private overlay (`tenant:<id>:<site>`); tenant data is never copied into the public map.

## Layout

```
packages/core/    signature.ts, risk.ts, route.ts, graph.ts (FalkorDB client), queries/*.cypher, tests/
packages/agent/   observe.ts, execute.ts, llm.ts, loop.ts, concurrent.ts, robots.ts, browser.ts, runner.ts (CLI), tasks/*.json, tests/
packages/mcp/     tools.ts, server.ts (stdio + HTTP), tests/
apps/testshop/    our own shop with the redesign switch
apps/web/         Next.js dashboard (DESIGN.md is its design plan)
scripts/          p2_demo.ts, p3_runs.ts, measure_reuse.py, measure_palette.mjs, pave_mind2web.ts, mcp_demo.ts
docs/             GRAPH_MODEL.md, QUERIES.md, SITES.md, AI_DISCLOSURE.md, receipts/
deploy.md         Vercel, Render, and FalkorDB Cloud deployment guide
DEMO.md CLAIMS.md Dockerfile render.yaml LICENSE
spikes/           Phase 0 scripts and their raw output (spikes/out/)
```
