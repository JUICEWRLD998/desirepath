# FIELD — convergence map (A4), measured 2026-10-15

## A4b Field sweep (I1): this event's visible entrants

The field is unusually visible: teams name their repos for the event and push on day 1.

| Platform | Literal query | Date | Count | Blind spot |
|---|---|---|---|---|
| GitHub repo search | `falkordb created:>=2026-10-13` | 2026-10-15 | 84 | private repos; teams that have not pushed yet; final field likely 5x larger |
| GitHub repo search | `falkordb agent pushed:>=2026-10-14` | 2026-10-15 | 52 | same |
| GitHub repo search | `graph hacks falkordb` | 2026-10-15 | 52 | same |
| Positive control | `falkordb hackathon` returned 20, overlapping the above | 2026-10-15 | 20 | n/a |

Taxonomy of ~90 unique entries, grouped by MECHANISM (repo names are evidence, from descriptions/READMEs):

| Cell (mechanism) | Count | Examples |
|---|---|---|
| Company brain: cited Q&A over an org graph (often FalkorDB's or another OSS org's GitHub) | ~20 | tombstone, threadline (FalkorDB org data), cairn, ripple, vouch, lineage, node-and-nerve, atlas, cortex, RepoBrain, SetuBrain, falkor-nexus, ChronosGraph, understudy, who-said-what brain |
| "What breaks / who is affected if X changes" (blast radius, ripple, dependency impact) | ~12 | blast-radius ×2, rootcause-agent, GraphSRE, TraceFix, unspool, meridian, aegis-graph, gridpulse, downstream (fexx301), impactgraph, ripple |
| Agent memory infra: provenance, contradiction checks, poisoned-memory repair, handoffs | ~16 | honest-memory, custody, kintsugi, crew-memory-graph, agentmesh, recallgraph ×2, graphmem, ContinuumAI, Mnemo, second-brain, circe-graph, agent-office-relay, undograph, taint-receipts, nodus |
| Security: reachability, attack paths, SOC, access revocation, MCP toxic flows | ~9 | reachable, Argus-SOC, blastradius (supply chain), ThreatPath, accesscut, toxicflow, ghostgraph, Scout, patchpath-falkordb-agent |
| Codebase and OSS contribution | ~6 | codemind, impactgraph, repograph-ai, patchpath, downstream, refusal-agent |
| Fraud and financial crime (synthetic transactions) | ~5 | fraud-graph, flowtrace, Financial_Crime_Agent (shell-company networks), bashi |
| Health | 3 | dawaigraph, firstdomino, passthru |
| Research integrity | 2 | bedrock, shaky-ground |
| Singletons | ~10 | staircase (IEP), heatpath, gaming-multiverse (IGDB), embodiweave (robot policy), compgraph, lineagegate, GraphPilot, eve (frappe), bidbrain |

**What nobody in the visible field does:** make the graph the agent's *plan* for acting in the world (path planning over a state graph the agents themselves build). **Empty cell:** procedural memory, a map of how to get things done, shared across agents. Warrant: nobody thought of it in *this* field (it exists in research: Agent Workflow Memory 2024; and as single-action caching in Browserbase Stagehand). Data exists (Mind2Web, CC-BY-4.0). It is judge-aligned (WANT-4 names "procedural memory" and "shared state"). Feasible in the window at a bounded scope (5-8 public sites).

**Style observation:** the field reads like it was written with the same agents and skills we use: "evidence-gated", "shows its work", "deterministic guard", "receipts", "proves", "refuses". The verifier genre is saturated here. A non-verifier product stands out.

## A4d L0 judge memory (Devpost archive, `scripts/judge-memory.mjs`, controls passed every run)

| Domain (1-2 words) | Total | Band | Same-mechanism in the 30-project sample | Verdict |
|---|---:|---|---|---|
| beneficial ownership | 65 | SEEN | 4 (ubo-knowledge-graph, GraphGuard, KYC Onboarding, Aurea) | **SEEN-MECHANISM** |
| sanctions | 206 | WORN | — | context |
| shell company | 262 | WORN | 3 (TraceNetX, RD Ramrod, redflags) | **SEEN-MECHANISM** |
| supply chain risk | 1,038 | FATIGUED | 1-2 | passes L0, but merged into the field's blast-radius cell |
| delivery route | 1,728 | FATIGUED | 3 (NightRoute, RelayPlan, Blcck) | **SEEN-MECHANISM** |
| npc memory | 150 | WORN | 4+ (Hearsay "spread rumors", Word Gets Around, Loomweaver [winner], Living NPCs) | **SEEN-MECHANISM** |
| dungeon master | 206 | WORN | many AI DMs | context |
| sample clearance / music rights | 59 / 282 | SEEN / WORN | 10+ rights-clearance agents (Clearcut, Clearance Desk, ClearFrame, CueClear …) | **SEEN-MECHANISM** |
| peer review | 1,240 | FATIGUED | 0 reviewer-conflict finders | passes |
| case law | 1,290 | FATIGUED | 1 (CaseFile AI) | passes |
| issue triage | 768 | FATIGUED | 2-3 triage agents | borderline |
| course planner | 544 | FATIGUED | 2 | passes |
| browser agent | 9,726 | FATIGUED | **0** state-graph / path-memory agents | passes |
| web automation | 7,707 | FATIGUED | **0** | passes |
| workflow memory | 6,211 | FATIGUED | **0** | passes |

Blind spot: Devpost only; keyword not mechanism; the 30-project sample is relevance-ranked.

## A4a Cold samples (SEMI-COLD, inline; no outside model was READY: `rival-run.mjs --selftest` → codex 401, gemini no auth)

The real field above is stronger evidence than simulated samples, so they are short.

- **L1 naive** ("what should we build to win?"): company knowledge chatbot; fraud ring detector; incident root-cause agent; personal memory assistant; codebase Q&A; supply-chain risk; healthcare drug interactions; recommendation engine; research assistant; customer support with memory.
- **L2 "nobody else will build"**: memory that forgets/un-learns; contradiction-detecting memory; provenance-tracked shared memory; agent handoff ledger; game NPCs with graph memory; research retraction propagation; access-revocation planner; knowledge decay tracker.
- **L3 informed (docs + tracks)**: GraphRAG-SDK company brain with citations; MCP fraud investigator with PageRank/WCC; Graphiti temporal memory for multi-agent crews; blast-radius with betweenness; per-tenant memory using multigraphs.

Every L1-L3 entry above has at least one real counterpart in the visible field. The forge excluded all of them at birth.

## Lane colours

- RED: company brain Q&A, blast radius / impact traversal, memory infra layers, fraud rings, security reachability, codebase graphs (sponsor ships code-graph, DepGraph).
- YELLOW: health, research integrity, OSS support (threadline already uses FalkorDB's own org data).
- GREEN: procedural path memory for acting agents; matching/cycle problems (shift swaps, kidney exchange); routing is GREEN in this field but SEEN-MECHANISM in judge memory.
