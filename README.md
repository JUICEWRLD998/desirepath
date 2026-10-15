# Desirepath

> Don't explore the same site twice. Walk the worn path. Report every step.

A shared map of every website's screens and actions, stored in FalkorDB and built by the agents that walk them.
Full plan: [`implementation.md`](implementation.md). Status: **Phase 0 (spikes)**.

## Setup

```bash
git clone https://github.com/juicewrld998/desirepath.git
cd desirepath
git checkout claude/loving-einstein-wdrolv
npm install
cp .env.example .env        # then fill in the keys, see below
```

### Keys (go in `.env`, never committed)

| Variable | Where to get it |
|---|---|
| `FALKORDB_URL` | Create a free instance at <https://app.falkordb.cloud>, copy its connection string. Docs: <https://docs.falkordb.com/cloud> |
| `OPENROUTER_API_KEY` | <https://openrouter.ai/keys> (credit: <https://openrouter.ai/credits>) |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash` (all models: <https://openrouter.ai/models>) |

## Phase 0 spikes

```bash
npm run p0:net      # which hosts are reachable
npm run p0:falkor   # FalkorDB: SPpaths, log(), full-text, PageRank, WCC, two graphs
npm run p0:llm      # one structured-output call through OpenRouter
npm run p0:sites    # signature stability on the demo sites
```

Raw output is written to `spikes/out/` and copied into `DECISIONS.md`.
