# CATALOGUE — every card and its fate (Graph Hacks, 2026-10-15)

Round logs and every pairwise line are in `FORGE.md`. Gates: L0 = judge memory SEEN-MECHANISM (Devpost sample);
merged = same 20-second demo as an existing field entry or earlier card.

| # | Card | Status | Reason |
|---|---|---|---|
| 1.1 | UK ownership chain → sanctioned person | killed L0 | ubo-knowledge-graph, GraphGuard, KYC Onboarding, Aurea in sample; Financial_Crime_Agent in field |
| 1.2 | Delivery dispatcher on OSM with FalkorDB A*/k-shortest | killed L0 | NightRoute, RelayPlan, Blcck |
| 1.3 | Night-shift handover graph | lost R1 | synthetic data only; G14 real-data fails |
| 1.4 | Reviewer finder striking co-author conflicts (OpenAlex) | lost R2 | hook measured false: 2/120 (1.7%) naive suggestions were conflicts |
| 1.5 | NPCs that only know what reached them | killed L0 | Hearsay, Word Gets Around, Loomweaver |
| 1.6 | Case-law citator | killed G12/G10 | no open treatment labels; an LLM would own "good law" |
| 1.7 | Close the loop with every user who hit a fixed bug | merged | field: ripple (re-notify), threadline (FalkorDB org data) |
| 1.8 | Music sample clearance chain | killed L0 | 10+ rights-clearance agents |
| 1.9 | Need-to-know company memory | merged | field: custody, accesscut |
| 1.10 | Outside-in company brain from SEC filings | lost R1/R2 | interlocks are lookups, not paths; weak wow |
| 1.11 | Prerequisite degree planner | lost R1 | weak payer |
| 1.12 | Factory flood → exposed brands | merged | field blast-radius cell |
| 1.13 | Statute amendment impact | merged | field blast-radius cell |
| 1.14 | GST fake-invoice rings | merged | field fraud cell |
| 1.15 | Who has worked on this subsystem | merged | field: vouch, threadline |
| 1.16 | What breaks if this package ships | merged + G3 | field downstream; sponsor DepGraph |
| 2.1 | Conference assignment via MaxFlow | lost R2 | #1.4 lineage; hook false |
| 2.2 | Independent expert finder for journalists | lost R2 | #1.4 lineage; weak payer |
| 2.3 | Editor agents sharing reviewer load | lost R2 | #1.4 lineage; response data private |
| **2.4 → 2.4b** | **Desirepath: shared map of website screens and actions; agents plan routes on it** | **PICK** | won R2 and R3; see below |
| **2.5** | **Rota: n-way shift-swap cycles** | **runner-up** | best non-lineage card; fails G14 real data and G16 moats without a real pilot |
| 2.6 | Drug repurposing paths on Hetionet | lost R2/R3 | Neo4j's flagship demo dataset; regular |
| 2.7 | Map of how repos build and test, for coding agents | lost R2 | sibling of 2.4, smaller market |
| 2.8 | Per-student mastery tutor | killed L0 | Recall, MindMate, Omnitutor |
| 2.9 | Kidney paired exchange | lost R2 | synthetic medical data |
| 2.10 | Call-centre agent handoffs | merged | field agent-office-relay |
| 2.11 | Evacuation capacity via MaxFlow | lost R2 | weak payer |
| 2.12 | Grant panel conflicts | merged | #1.4 lineage |
| 3.1 | QA regression map | folded/lost R3 | narrower than 2.4b |
| 3.2 | Map as MCP server + private tenant maps | folded into 2.4b | beat parent |
| 3.3 | Humans pave first paths (Mind2Web bootstrap) | folded into 2.4b | beat parent |
| 3.4 | Live cost meter as proof | folded into 2.4b | beat parent |
| 3.5 | One map for browser and terminal | lost R3 | scope |
| 3.6 | Concurrent edge-health reports, re-route for all | folded into 2.4b | beat parent |
| 3.7-3.10 | portal analyst / per-lookup pricing / form portals / agent negotiation | merged | same mechanism as 2.4 or field relay |
| 3.11 | Tool selection via text-to-cypher | killed G3 | sponsor ships it |

## Finalist 1 — Desirepath (#2.4b), the pick

- **Problem:** browser agents re-explore every site; a quarter of their steps re-walk paths others already took (Mind2Web, measured).
- **User:** an ops/QA engineer running browser agents at volume.
- **Solution:** a shared, success-weighted map of each site's screens and actions in FalkorDB; agents plan with `algo.SPpaths` and report every step; failures re-route everyone.
- **Mechanism:** procedural memory as a state graph; path = plan. NOT a single-action cache.
- **Technologies:** FalkorDB (Cloud), Cypher, `algo.SPpaths`, full-text index, PageRank/WCC, multigraph per site and tenant; Playwright; any tool-calling LLM; MCP server; Next.js dashboard.
- **Differentiation:** measured reuse curve (M2), live map + MCP endpoint (M4), desire-path identity (M6), weighted paths and tenancy (M3).
- **Demo concept:** split screen cold vs warm agent; redesign toggle on our test shop triggers live re-route; MCP `plan` from any client.
- **MVP scope:** see `../implementation.md` Phases 0-8.
- **Main risks:** LLM access (Q1); signature stability; hosting a browser for the live URL.

## Finalist 2 — Rota (#2.5), runner-up

- **Problem:** shift swaps fail when no two people want each other's shifts.
- **User:** ward nurses, retail staff. **Solution:** find n-way swap cycles in a wants graph under rest-hour and skill constraints; collect approvals.
- **Mechanism:** cycle search (variable-length Cypher returning to start). **Technologies:** FalkorDB, Cypher, a scheduling UI.
- **Differentiation:** most apps support pairwise swaps only. **Demo:** a 4-cycle nobody could see.
- **Main risks:** no public roster data (G14 real data fails without a pilot); only M6 moat. Switch only if Desirepath's Phase 0 fails (last date 2026-10-16 12:00 IST).
