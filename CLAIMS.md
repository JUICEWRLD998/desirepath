# Claims

Every number in the README and the demo video is in this file, next to the command that reproduces it. Single user, single model (`google/gemini-2.5-flash`), one machine, FalkorDB Cloud free tier. Nothing here is a benchmark against other systems.

## Measured on real sites (`npm run p6`, receipt `docs/receipts/p6-runs.json`, summary `docs/receipts/p6-summary.json`)

Per task: 3 cold runs (the model explores and the graph records), then 3 map runs. Sites: books.toscrape.com, quotes.toscrape.com, en.wikipedia.org (robots.txt obeyed, one action per second, identified user agent). Open Library is not measured: its host times out from my machine.

| | Runs | Succeeded | Model calls (total) | Tokens (total) | Steps (median) | Seconds (median) |
|---|---|---|---|---|---|---|
| cold | 24 | 24 | 39 | 59,321 | 1.5 | 8.6 |
| map | 24 | 24 | 0 | 0 | 1.5 | 7.3 |

Per task, median (range) over 3 runs:

| Task | Steps cold | Steps map | Model calls cold | Model calls map | Seconds cold | Seconds map | Succeeded cold and map |
|---|---|---|---|---|---|---|---|
| books-page2 | 2 (2 to 2) | 2 (2 to 2) | 2 | 0 | 9.8 (9.1 to 11.1) | 9 (9 to 9.8) | 3/3 and 3/3 |
| books-open-book | 2 (2 to 2) | 2 (2 to 2) | 2 | 0 | 9.8 (9.2 to 10.5) | 8.9 (8.8 to 9) | 3/3 and 3/3 |
| books-default-page3 | 3 (3 to 3) | 3 (3 to 3) | 3 | 0 | 13.4 (12.8 to 13.9) | 11.9 (11.1 to 12.4) | 3/3 and 3/3 |
| quotes-tag-author | 1 (1 to 1) | 1 (1 to 1) | 1 | 0 | 7.2 (7.1 to 7.5) | 6.9 (6.6 to 7.2) | 3/3 and 3/3 |
| quotes-tag-page2 | 1 (1 to 1) | 1 (1 to 1) | 1 | 0 | 6.1 (5.6 to 6.7) | 6 (5.8 to 6) | 3/3 and 3/3 |
| quotes-page3 | 2 (2 to 2) | 2 (2 to 2) | 2 | 0 | 10.1 (8.5 to 11.5) | 7.3 (7.3 to 8.1) | 3/3 and 3/3 |
| wikipedia-desire-path-erosion | 1 (1 to 1) | 1 (1 to 1) | 1 | 0 | 6.4 (6.2 to 6.7) | 5.9 (5.8 to 6.1) | 3/3 and 3/3 |
| wikipedia-desire-path-yosemite | 1 (1 to 1) | 1 (1 to 1) | 1 | 0 | 7.3 (6.8 to 8.7) | 7.4 (7.3 to 8.2) | 3/3 and 3/3 |

What this supports: a map run needs no model call and no tokens, and it succeeds as often as a cold run (48 of 48 runs succeeded). Map runs were about 1 second quicker in the median (the cold run pays for the model call), but that gap is small next to the one-action-per-second delay and page loads, so do not sell it as a speedup. Steps were equal on every task: the cold run already finds a short path on these small sites, so do not claim fewer steps.

## Other claims

| Claim | Value | Command | Receipt |
|---|---|---|---|
| Share of Mind2Web steps already walked by another task on the same site | 24.5% of 7,775 steps; 4.9 / 8.5 / 13.8 / 20.2 / 27.8% after 1 / 2 / 4 / 8 / 12 earlier tasks; control across sites 0.2%; planted duplicate 100% | `python scripts/measure_reuse.py` (needs duckdb) | prints its own controls, exits 1 if one fails |
| Test shop, cold run | 4 steps, 4 model calls | `npm run p2` | `docs/receipts/p2-latest.json` |
| Test shop, map run | 3 steps, 0 model calls | `npm run p2` | same |
| Test shop after the redesign | 1 failed step, detour taken, 0 model calls; the planner stopped choosing the broken edge after 2 failures | `npm run p2` | same |
| Concurrent writers lose no update | 3 agents: 9 steps, 3 runs, every edge ok = 9; 3 MCP clients reporting one edge 8 times each: exactly +24 | `npm test` (`concurrent.db.test.ts`, `mcp.db.test.ts`) | test output |
| Mind2Web paving | 73 sites, 7,157 states, 7,084 edges, 137 s on Cloud | `npm run pave` | DECISIONS 26 |
| Tests | 70 of 70 pass on FalkorDB Cloud | `npm test` | DECISIONS |
| Dashboard | ui-score 92/100, axe 0 violations in 16 states, 8 widths, both themes | see DECISIONS "Phase 5 verification" | `docs/receipts/p5/` |

## What this is not

Not a benchmark of agent accuracy. Not tested with more than one real user (me). The site redesign is our own test shop, because a real site cannot be redesigned on cue. Mind2Web paths are human-recorded history from 2023 snapshots; no agent runs on those sites. No logins, form submissions or captchas on real sites.
