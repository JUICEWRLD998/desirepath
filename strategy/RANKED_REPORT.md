# RANKED REPORT — Graph Hacks (WeMakeDevs × FalkorDB), 2026-10-15

A0: GO, no blocker. Open question Q1 (which LLM key) decides the agent's runtime, not the pick.

## 0. The blind cards (rank these cold before reading on)

**X**
```
USER       An ops engineer whose browser agents run 200 tasks a week on public portals and shops
MOMENT     "It clicks around the same site for 40 steps every time, like it's never been there."
MECHANISM  a shared map of each website's screens and actions, built from every agent run; the next
           agent plans its route on the map (weighted shortest path) instead of re-exploring
           NOT: a cache of single actions, a scraper, a RAG over page text
CUSTOMER   teams running browser/computer-use agents (QA, data ops, RPA replacement, agent platforms);
           today they pay in LLM tokens and minutes for every re-exploration
WOW (20s)  two agents, same task: the cold one wanders 24 steps; the second follows a glowing path in
           the graph and finishes in 7, then a button moves and the map re-routes it live
PROOF      the live map: open any edge and see the runs that walked it, their success rate and latency
WANT       W4 "procedural memory · shared state and handoffs between agents · separate memory per tenant"
```

**Y**
```
USER       Kemi, a night-shift ward nurse who needs Thursday off
MOMENT     "Nobody can swap with me directly. Three of us want each other's shifts in a circle."
MECHANISM  n-way shift-swap cycles found in a graph of who wants which shift, under rest-hour and
           skill constraints; the agent proposes the cycle and collects every approval
           NOT: a shift marketplace, a pairwise swap board
CUSTOMER   hospitals and retail chains, via scheduling software they already pay for
WOW (20s)  four people, no pairwise swap possible; the graph finds the 4-cycle and everyone gets the
           day they wanted
PROOF      the cycle query and the constraint checks, replayable on the roster
WANT       W5 "uses a graph to make decisions and take action"
```

**Final: clear winner X.** Pairwise X > Y 4-1 in both orders (gen prefers Y both times). Deliberation room: J1 X, J2 X, dev X, inv X, gen Y (4-1). No outside judge was READY, so the verdict is SEMI-BLIND; you can rerank. X serves W1-W5; Y serves W5.

---

## 1. Name, one-liner, tagline

- **Name: Desirepath.** A desire path is the trail people wear into grass by walking where they actually go. Agents wear paths into websites the same way. The name does not explain the product; the tagline does.
- **One-liner:** An ops engineer's browser agent finishes a task in 7 steps instead of 24, because the last agent that visited that site left a path in the graph.
- **Tagline:** *Don't explore the same site twice. Walk the worn path. Report every step.*
- **Why now:** browser and computer-use agents went mainstream in 2025-26, and their cost and slowness come from re-reasoning every click. **Why this event:** Track 02 lists "procedural memory", "shared state and handoffs between agents", "high-concurrency reads and writes" and "separate memory per user or tenant"; Desirepath needs all four, and Track 01's "graph queries and algorithms as agent tools" and "tool selection through MCP" on top.

## 2. Wow anatomy

- **Hook (the negation's number, VERIFIED 2026-10-15, `data/m2w_reuse.py`):** on Mind2Web (1,009 human-recorded tasks on 73 real websites, CC-BY-4.0), **24.5% of every step re-walks a step another task on the same site already took**, with only ~14 tasks per site. It grows with traffic: 4.9% after 1 earlier task, 13.8% after 4, **27.8% after 12**. Controls: cross-site 0.2%, planted duplicate 100%.
- **Negation:** the field believes web agents fail because each step's reasoning is weak, so they buy bigger models. A quarter of the steps (and rising with traffic) are re-discoveries. That is a memory problem, and memory compounds.
- **Insight (why the cell is empty):** memory products store what agents *know*; nobody stores *how to get there*. Of ~90 visible entries, none use the graph as the agent's plan. Devpost judge memory: 0 of 90 sampled "browser agent / web automation / workflow memory" projects share the mechanism.
- **Mechanism:** state graph per site (screen signature → action → screen), success-weighted, shared by all agents; `algo.SPpaths` picks the route; failures down-weight edges and `pathCount` gives the detour. **NOT** a single-action cache (Browserbase Stagehand), not hand-written workflows (Skyvern), not in-context workflow notes (Agent Workflow Memory, 2024).
- **Differentiator:** the inputs a rival model did not get: the measured reuse curve (I5), FalkorDB's weighted-path procedure and multigraph tenancy (I2), and a field sweep showing nobody is here (I1).
- **Wow moment (20s):** split screen, same task. Cold agent: 24 steps, ~70 s, tokens counting up. Desirepath agent: the path lights up in the map, 7 steps, ~9 s, near-zero tokens. Then on our own test shop a button moves ("redesign" toggle), the edge turns red, and the second-best path takes over.
- **Proof (one click):** click any edge on the live map → the runs that walked it, success rate, median latency, last seen.
- **Moats:** M2 real data finding (the Mind2Web curve, computed today); M4 live proof (deployed map, public MCP endpoint, real runs on real public sites); M6 taste (the desire-path world: worn paths, foot traffic, detours); M3 supports (weighted `SPpaths`, multigraph per tenant). Not M3 alone.
- **Deliberation-room sentence (G17):** "the one where the second agent did the task in 7 steps instead of 24 because the first agent's path lit up in the graph."
- **Strength test:** inevitable once seen 2 · surprise/desire/awe 2 · one person one moment 1 · hard to copy this weekend 2 · sponsor-native 2 = **9/10**. **Spike:** "the graph shapes what the agent does" is literal here: the path *is* the plan (10/10 on WANT-1).

The step counts (24 vs 7, 70 s vs 9 s) are the *target* for the demo, not yet measured. Phase 6 of `implementation.md` measures them; the video uses whatever is measured.

### 90-second demo script (Before / Action / After)

| t | Before | Action | After |
|---|---|---|---|
| 0:00-0:12 | An agent task on a real public site; the cold agent wanders (sped-up footage, step counter climbing) | voice: "Every agent explores every site from scratch." | step count and seconds |
| 0:12-0:30 | Same task, Desirepath on | the map panel lights the worn path | far fewer steps, near-zero tokens |
| 0:30-0:45 | The map zoomed out: edges, thickness = traffic | "1,009 human tasks paved these sites; 1 in 4 steps was already walked" | the reuse curve |
| 0:45-1:05 | Our test shop; toggle "redesign" | the next agent's edge fails → turns red | `pathCount` detour taken; map heals |
| 1:05-1:20 | Three agents in parallel, two tenants | each tenant's private map stays separate; public map shared | concurrency counter |
| 1:20-1:30 | Claude Code / any MCP client | `plan("books.toscrape.com", "find the cheapest travel book")` | path + stats returned |

## 3. How it works

- **Roles:** the LLM *proposes* an action only when the map has no confident path; the **planner** (Cypher + `algo.SPpaths`) owns the route; the **recorder** owns success rates, latencies and costs (deterministic, from run logs). The operator approves anything that submits a form (and the demo never submits on real sites).
- **Graph model:** one FalkorDB graph per site (`site:<domain>`), one per tenant overlay (`tenant:<id>:<domain>`). Nodes `State {sig, url_template, title, landmarks}`, `Goal {text}`; edges `ACT {kind, target, label, ok, fail, risk, ms, last_seen}`, `REACHES` (State → Goal). Detail in `implementation.md`.
- **Sponsor integration (load-bearing):** every agent step calls `plan()` (a Cypher query plus `algo.SPpaths` with `weightProp:'risk'`, `costProp:'ms'`, `pathCount:3`) and `report()` (an atomic edge update). Take FalkorDB out and every agent explores blind, which is the product's whole reason to exist (rule 3 passes by construction).

## 4. Build contract

The full plan with phases, queries and the cut list is in `../implementation.md`. Single workflow: *agent receives a task on a mapped site → plans on the graph → executes → reports each step → the map updates for every other agent.* Completion evidence: the split-screen run reproduced from a clean checkout, the live map URL, the MCP endpoint answering `plan`. NOT BUILDING: login flows, captcha handling, form submission on real sites, vision models.

**Top 5 risks:** (1) LLM access and rate limits → map-planned runs need almost no LLM calls; record exploration runs once. (2) State signatures unstable on dynamic pages → landmark hashing + URL templating, plus a signature-stability test per site. (3) Real sites change mid-event → own test shop for the scripted beats; real sites for the speed-up only. (4) Hosting a headless browser for the live URL → the live site shows the map, plans and recorded runs; execution runs locally or in one container; declared. (5) FalkorDB Cloud's 100 MB → the bootstrap is ~8k edges; measured in Phase 0.

## 5. The rival

- **Strongest plausible entry in our lane (T2):** a polished multi-agent shared-memory crew (crew-memory-graph, agentmesh class) with live concurrency and per-tenant isolation shown literally. It beats us on "conversation history" (we have none); we beat it on "graph shapes behaviour" and on a measured, real-data result.
- **Strongest in T1:** a live-data investigation agent (reachable, flowtrace class). It acts on records; we act on the world.
- **Real competitors outside the event:** Browserbase Stagehand (action caching per instruction), Skyvern (authored workflows), browser-use (agent framework; memory features UNVERIFIED), Agent Workflow Memory (research). Gap: no shared, cross-agent, path-planned map.

## 6. Scores (ASSUMED weights; none published)

| Criterion (weight) | Desirepath | Rota (Y) |
|---|---|---|
| Graph does real work (25) | 9 → 225 | 8 → 200 |
| Agent decides, acts, explains (25) | 9 → 225 | 7 → 175 |
| FalkorDB depth (20) | 8 → 160 | 6 → 120 |
| Real-world value / startup (15) | 8 → 120 | 5 → 75 |
| Demo clarity (15) | 8 → 120 | 8 → 120 |
| **Weighted** | **850 / 1000** | 690 / 1000 |
| Equal weights | 8.4 | 6.8 |

No rank flip. Winner-DNA fit: no past winners exist for this event; it matches what the rules page emphasises (rule 3, rule 10's "graph data model" and "Cypher queries").

## 7. Blind attack (SEMI-BLIND; one-liner, demo script, README top third, rubric only)

Entry it would rank above ours: *a T2 crew-memory entry with stronger UI polish, if ours ships rough.* The 10 questions:

1. **Novelty:** isn't this Stagehand's cache? — A cache replays one action for one instruction; the map plans multi-hop routes across *different* tasks (Mind2Web transitions are reused across tasks, not within one).
2. **Feasibility:** 3.5 days? — Planner and recorder first (deterministic, no LLM); 5 sites; own test shop for failure beats.
3. **Sites change:** won't the map rot? — Edges carry `last_seen`, success and failure counts; failures re-route live; a rotting edge is itself a signal (site changed).
4. **State identity:** how do you know two screens are the same? — Signature = URL template + hashed landmark set; stability tested per site and shown in the README.
5. **Why a graph DB:** why not Postgres? — Route-finding across thousands of states on every agent step is a weighted shortest-path query; FalkorDB runs it in-database, with one isolated graph per site and tenant.
6. **Privacy:** — Public sites only (rule 6); typed values are masked like Mind2Web; tenant graphs are isolated graphs, not filtered rows.
7. **Business model:** — Free public map; paid private maps for internal apps; metered `plan` calls for agent platforms.
8. **AI reliability:** — The LLM never owns a route or a statistic; it only proposes when no path exists, and its proposal becomes an edge only after it succeeds.
9. **Scale:** — Per-site graphs stay small; growth is horizontal (more graphs), which is the multigraph design FalkorDB advertises.
10. **Why this tech:** — Without the graph the second agent is as slow as the first; the meter shows it.

## 8. The decisive question

**Q1: which LLM key does he have?** Time cap: answer before Phase 2.
- Branch A (Gemini free key, or any key with tool calls): exploration runs live, a few per site, recorded; the demo's map-planned runs need almost no calls.
- Branch B (no key): local Ollama model for exploration on our test shop; Mind2Web paths pave the public sites; map-planned runs need zero LLM calls. The product still works, and that is part of the pitch.

Runner-up: **Rota** (Y). Switch trigger: Phase 0 shows `algo.SPpaths` cannot take a property weight on FalkorDB Cloud, or the state signature is unstable on 3 of 5 sites. **Last switch date: 2026-10-16 12:00 IST.**

## 9. The company

- **Customer and price:** teams running browser agents at volume (QA, data ops, RPA replacement, agent platforms). Free public maps; private maps of internal apps from $99/app/month; metered `plan` calls for platforms.
- **Why now:** computer-use agents are mainstream and per-step token cost and latency dominate their bills.
- **Wedge:** an open MCP server any agent can add in one line, plus public maps of popular sites. Each run makes the map better for everyone (the measured curve).
- **First 10 users and channel:** browser-use and Stagehand community Discords, FalkorDB and WeMakeDevs Discords, X. Inside the window this is OPEN (UNVERIFIED reach).
- **Competitor and edge:** Stagehand caches single actions; Desirepath plans routes across tasks and agents.
- **12 months:** public maps → private enterprise maps → "a site changed" monitoring (a failing edge is a regression alert).
- **Real vs mocked in the build:** real FalkorDB, real public sites, real agent runs, real Mind2Web paving. Declared: our own test shop for the redesign beat; no form submission on real sites.

## 9b. Prize-stack plan

Track 02 (primary) and Track 01 (secondary), named in the submission (rule 5). Blog post for the AirPods side prize (he writes it; `humanizer` pass). Track 03 not entered.

## 10. 60-second pitch (founder voice)

"Every browser agent today explores every website as if no agent had ever been there. We measured it on a thousand real human web tasks: a quarter of the steps were ones someone had already taken on that same site, and the share keeps rising with traffic. So we built Desirepath, a map of each website that agents draw together in FalkorDB. Every step an agent takes becomes an edge with a success rate. The next agent asks the graph for the best route and walks it. When a site changes, the edge fails, the graph finds a detour, and every other agent gets it too. It's an MCP server, so any agent can use it in one line."

## 11. Verdict

- **P(1st), Track 02:** P(eligible, compliant) 0.95 × P(core runs end to end by freeze) 0.6 × P(a judge gets it in 20 s) 0.8 × P(beats the strongest T2 rival on the heaviest criterion) 0.45 × P(survives unscripted input) 0.7 = **0.14**.
- **Track 01:** same but 0.25 for beating the strongest rival = **0.08**. **At least one track: ≈ 0.21.**
- **Weakest factor:** core runs end to end (live browser agent on real sites, plus the unknown LLM key).
- **What could still beat us:** a rougher-but-wider entry with better polish; a judge who sees "browser agent" and stops before the graph.
- **The one move that helps most:** build the planner and recorder first, prove the split-screen on our own test shop, and answer Q1 today.

The CATALOGUE is in `CATALOGUE.md`, round logs in `FORGE.md`, the build plan in `../implementation.md`. **Nothing is built until "GO Desirepath".**
