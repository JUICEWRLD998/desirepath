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
| `Goal` | `id`, `text` | a task that was completed at least once |
| `Run`, `Step` | see `implementation.md` §5 | episodic memory; **written in Phase 2**, not yet by `graph.ts` |

## Relationships

`(:State)-[:ACT {key, kind, role, name, nth, label, ok, fail, ms, risk, last_seen}]->(:State)` is procedural memory.
`(:State)-[:REACHES {count}]->(:Goal)` is semantic memory.
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
`pSuccess = exp(-(pathWeight - 0.05*hops))`; the agent follows a route at `pSuccess >= 0.6`.

## Indexes

Exact: `State(sig)`, `Goal(id)`. Full-text: `Goal(text)`. Created by `ensureSchema()` (idempotent).
Free text goes through `ftQuery()` first: lowercased tokens, stop words dropped, joined with `|`, because the raw query is AND-ed and breaks on punctuation.
