# Desirepath

> Don't explore the same site twice. Walk the worn path. Report every step.

A shared map of every website's screens and actions, stored in FalkorDB and built by the agents that walk them.
Before each step an agent asks the graph for the best route to its goal; when the graph has a confident path the agent
follows it without calling the LLM, and when a site changes, the failed edge re-routes the next agent.
Full plan: [`implementation.md`](implementation.md). Decisions and measured results: [`DECISIONS.md`](DECISIONS.md).
Graph model: [`docs/GRAPH_MODEL.md`](docs/GRAPH_MODEL.md).

**Status:** Phases 0 to 4 are done and tested on FalkorDB Cloud (Open Library is the one unmeasured site: its host times out from the author's machine). Real-site maps for books.toscrape.com, quotes.toscrape.com and Wikipedia; an MCP server; three agents writing one graph at once; tenant overlays; the Mind2Web human-paved layer. Not built yet: the dashboard (Phase 5), the measured claims (Phase 6), deployment (Phase 7). Single user so far.

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
scripts/          p2_demo.ts, p3_runs.ts, measure_reuse.py, pave_mind2web.ts, mcp_demo.ts
docs/             GRAPH_MODEL.md, SITES.md, receipts/
spikes/           Phase 0 scripts and their raw output (spikes/out/)
```
