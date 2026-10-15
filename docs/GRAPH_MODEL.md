# Graph model

Desirepath stores each site's map in its own FalkorDB graph. `packages/core/graph.ts`
maps a public site to `public:<site>` and a tenant's private overlay to
`tenant:<tenant>:<site>`. A tenant plan reads its private graph first and then
the public graph; public-only plans never select tenant graphs.

## Nodes

| Label | Properties | Purpose |
|---|---|---|
| `State` | `sig`, `url_template`, `title`, `landmarks`, `first_seen`, `visits` | A screen identified by its deterministic signature. |
| `Goal` | `id`, `text`, `site`, `created` | A task goal that has been achieved. |
| `Run` | `id`, `agent`, `tenant`, `task`, `mode`, `started`, `ended`, `outcome`, `steps`, `llm_calls`, `tokens`, `ms` | One agent episode. |
| `Step` | `i`, `action_key`, `ok`, `ms`, `source` | One action in a run. |

## Relationships

| Type | From → To | Properties | Purpose |
|---|---|---|---|
| `ACT` | `State` → `State` | `key`, `kind`, `role`, `name`, `nth`, `label`, `ok`, `fail`, `risk`, `ms`, `last_seen`, `last_fail` | A recorded transition and its reliability. |
| `REACHES` | `State` → `Goal` | `count`, `last_seen` | Associates a successful screen with a goal. |
| `OF_RUN` | `Step` → `Run` | — | Associates a step with its run. |
| `FROM` / `TO` | `Step` → `State` | — | Records the step's starting and resulting screens. |

`State.sig` and `Goal.id` are exact-match keys. `Goal.text` is intended for
full-text goal lookup. The query definitions are in `packages/core/queries/`.

## Signature and route cost

The state signature is the first 16 hex characters of SHA-1 over the URL
template and a SHA-1 of sorted accessibility landmarks. Numeric, UUID, and
long-hash path components collapse to `:id`; query values are omitted; landmark
names are lowercased, digit-normalized, and whitespace-collapsed. Headings
contribute their role only.

For an edge with `ok` successful and `fail` failed traversals:

```text
p_success = (ok + 1) / (ok + fail + 2)
risk = -ln(p_success) + 0.05
```

`plan.cypher` asks `algo.SPpaths` for up to three routes by summed risk and
latency. `routeSuccess` in `packages/core/risk.ts` removes the per-hop penalty
from the returned weight to recover the estimated success probability.

## Verification boundary

The signature and risk helpers, query files, and graph-scope selection have
unit coverage. FalkorDB procedure support and live query behavior remain
Phase 0 integration checks; a green unit suite does not certify a configured
FalkorDB instance.
