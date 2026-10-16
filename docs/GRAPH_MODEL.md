# Graph model

Source of truth for the map. Code: `packages/core/graph.ts`; queries: `packages/core/queries/*.cypher`.

## One graph per namespace

| Graph name | Written by | Meaning |
|---|---|---|
| `public:<site>` | every agent | shared map of one site |
| `tenant:<tenant>:<site>` | that tenant's agents | private overlay; never copied into `public:*` |

`graphName()` rejects anything outside `[A-Za-z0-9._-]`, so a site or tenant name cannot spell its way into another namespace.
Tenants are separate FalkorDB graphs, not filtered rows (test: *tenant graphs never leak into public*).

## Nodes

| Label | Properties | Meaning |
|---|---|---|
| `State` | `sig`, `url_template`, `title`, `landmarks`, `first_seen`, `visits` | a screen |
| `Goal` | `id`, `text`, `site`, `created` | a task that was completed at least once (semantic memory) |
| `Run` | `id`, `agent`, `tenant` (`""` for public), `task`, `mode` (`cold`/`map`), `started`, `ended`, `outcome` (`running`/`success`/`failure`), `steps`, `llm_calls`, `tokens`, `ms` | one agent episode (episodic memory). Written by `startRun` / `endRun`; `ended` and the totals are set when the run ends, even if it crashed |
| `Step` | `run`, `i`, `action_key`, `ok`, `ms`, `source` (`map`/`llm`), `observed` | one executed action of a run |

Timestamps are epoch milliseconds.

## Relationships

`(:State)-[:ACT {key, kind, role, name, nth, label, slot, pre, ok, fail, ms, risk, last_seen}]->(:State)` is procedural memory.
`slot` is the *name* of the task slot a typed value comes from (`""` if none). `pre` is a JSON list of fills made on the source screen before the click, `[{"kind":"type","role":"textbox","name":"Search products","nth":0,"slot":"query"}]`, so a route through a search box replays its text from the task at run time. **Typed values are never stored.**
`(:State)-[:REACHES {count, last_seen}]->(:Goal)` is semantic memory.
`(:Step)-[:OF_RUN]->(:Run)`, `(:Step)-[:FROM]->(:State)`, `(:Step)-[:TO]->(:State)` are episodic memory. `TO` is the edge's *target*: for a failed map step that is the screen the edge promised, so `explain.cypher` finds the failure; the screen actually reached is the step's `observed` property. A fill, or an LLM action that did nothing, creates a Step but no ACT edge.
`key` is `kind:role:name:nth` with digits and case in the name normalised (`actionKey`), so "Travel 12" and "Travel 13" are one action.
`MERGE (a)-[e:ACT {key}]->(b)` makes an edge unique per (from, key, to).

## State signature

`sig = sha1(urlTemplate + "|" + sha1(sortedLandmarks))[0:16]`, no LLM (`packages/core/signature.ts`).
- `urlTemplate`: id-like path segments become `:id` (digits, UUIDs, 12+ hex with a digit, lowercase `slug_123`, `page-N.html`, Open Library ids); query keys sorted, values `:v`. Wikipedia titles such as `Windows_10` are kept.
- Landmarks: the first 40 interactive elements (button, link, textbox, combobox, checkbox, tab) as `role:normalised name`, plus one `heading` marker if the page has any heading.
  Playwright's YAML-quoted entries and escaped quotes are parsed.

## Risk and planning

`risk = -ln((ok+1)/(ok+fail+2)) + 0.05` is computed **inside `report.cypher`** from the *new* counts (verified; see `DECISIONS.md`).
`plan.cypher` calls `algo.SPpaths` on `risk` (cost `ms`, `pathCount: 3`) and returns each route's steps with the expected next `sig` and the hop count.
`pSuccess = exp(-(pathWeight - 0.05*hops))`.
The agent follows the first route (lowest risk first) whose **per-hop** success `pSuccess^(1/hops)` is at least 0.6 and that contains no edge which already failed *in this run* (`chooseRoute`, `packages/core/route.ts`). Per-hop, because a 3-hop route walked once scores 0.30 as a whole; one clean walk of every edge is 0.667 per hop. If no route qualifies the agent asks the LLM for one action.

## Queries (`packages/core/queries/`)

| File | Used by | Does |
|---|---|---|
| `report.cypher` | `report()` | upsert both states and the edge; new counts, running-mean `ms`, `risk` |
| `plan.cypher` | `plan()` | up to 3 routes by `algo.SPpaths`, each step with its expected next `sig` |
| `goals.cypher` | `goalCandidates()` | full-text match of a task to known goals, then the screens that reached them |
| `outgoing.cypher` | `outgoing()` | what the map already knows from one screen (hints for exploring) |
| `run_start.cypher`, `run_end.cypher` | `startRun()`, `endRun()` | open and close a `Run` |
| `step.cypher` | `recordStep()` | a `Step` linked to its run and its two states |
| `goal.cypher` | `recordReach()` | create the `Goal` once, count each time a screen satisfies it |
| `explain.cypher` | dashboard (Phase 5) | the runs that walked one edge; tested in `episodic.db.test.ts` |
| `stats.cypher` | `stats()` | per-mode run averages |

## Indexes

Exact: `State(sig)`, `Goal(id)`. Full-text: `Goal(text)`. Created by `ensureSchema()` (idempotent).
Free text goes through `ftQuery()` first: lowercased tokens, stop words dropped, joined with `|`, because the raw query is AND-ed and breaks on punctuation.
