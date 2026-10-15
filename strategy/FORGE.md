# FORGE — rounds, merges, kills, tournament (A5), 2026-10-15

Panel (judges are not published, so every seat is ASSUMED): **J1** FalkorDB product lead (agents + GraphRAG, wants showcase products), **J2** FalkorDB engine engineer (Cypher depth, algorithms, speed, multi-graph), **dev** sponsor devrel ("does it deliver a WANT; would I put it in our showcase?"), **inv** investor / first customer ("would I pay, fund, use it next month?"), **gen** tired generalist at demo 47 ("will I remember it tonight?"). Inline panel = SEMI-BLIND. No outside CLI was READY (codex 401 expired key; gemini not logged in).

ASSUMED rubric for triage (none published), from the rules and track texts: graph does real work 25 · agent decides, acts, explains 25 · FalkorDB depth 20 · real-world value (startup) 15 · demo clarity 15.

---

## Round 1 — generators: PERSON, WANT, CUSTOMER, DATA, DEMO, COLLIDE, INVERT, FUTURE, WISH

| # | Gen | Card (one line: user · mechanism · payer) | WANT | Fate |
|---|---|---|---|---|
| 1.1 | DATA | Compliance analyst · ownership chain from any UK company to a sanctioned person (Companies House PSC + OFSI) · fintechs | W5 | **KILL L0** SEEN-MECHANISM (4 in sample) + field Financial_Crime_Agent |
| 1.2 | WISH | Owner of a 6-van delivery firm · dispatcher on OSM roads with FalkorDB A*/k-shortest + customer memory · SMB fleets | W3 | **KILL L0** SEEN-MECHANISM (NightRoute, RelayPlan, Blcck) |
| 1.3 | PERSON | Kemi, 41, night-shift ward nurse · handover graph of patients, tasks, meds across shifts · hospitals | W4 | survives (synthetic data only) |
| 1.4 | CUSTOMER | Journal handling editor · reviewer finder that strikes conflicts by co-authorship path (OpenAlex) · publishers | W2, W5 | survives |
| 1.5 | DEMO | Tabletop game master · NPCs only know what reached them through a who-told-whom graph · GMs, studios | W4 | **KILL L0** SEEN-MECHANISM (Hearsay, Word Gets Around, Loomweaver) |
| 1.6 | COLLIDE | Small-firm lawyer · "still good law?" via negative-treatment propagation on CourtListener · law firms | W2 | **KILL G12**: treatment labels not in the open data; an LLM would own the verdict (G10) |
| 1.7 | WANT ex.2 | DevRel lead · when a fix ships, find every user who reported or hit it and close the loop · devtool companies | W4 | merged |
| 1.8 | DATA | Bedroom producer · who must clear a sample: recording → work → writers → label parents (MusicBrainz) · producers | W2 | **KILL L0** rights-clearance SEEN-MECHANISM (10+) |
| 1.9 | FUTURE | Enterprise · agents answer only along need-to-know paths · enterprises | W4 | merged |
| 1.10 | INVERT | Equity analyst · outside-in company brain from SEC filings: interlocks, subsidiaries, related parties · funds | W5 | survives |
| 1.11 | PERSON | Arjun, 20, CS student · prerequisite-path degree planner on public catalogs · universities | W4 | survives |
| 1.12 | DATA | Brand sourcing lead · which brands are exposed when a factory floods (Open Supply Hub + GDACS) · brands | W5 | merged |
| 1.13 | CUSTOMER | Legislative drafter · every provision touched by amending s.12 (legislation.gov.uk) · RegTech | W5 | merged |
| 1.14 | PERSON | Ravi, 34, accountant with 60 clients · fake-invoice rings in GST supplier chains · accountants | W5 | merged |
| 1.15 | WANT ex.3 | Maintainer · who has worked on this subsystem before · OSS companies | W5 | merged |
| 1.16 | WANT ex.4 | Library author · what breaks if this package release ships · OSS | W5 | merged + G3 (sponsor ships DepGraph) |

Merge log (same 20-second demo with only the noun or user swapped):
- `#1.7 -> field:ripple (re-notify everyone a changed fact reached) + field:threadline (FalkorDB org data)`
- `#1.9 -> field:custody/accesscut (permission and provenance paths)`
- `#1.12 -> field:blast-radius cell (failed node → affected dependents; factory instead of service)`
- `#1.13 -> field:blast-radius cell (amended section → affected sections)`
- `#1.14 -> field:fraud cell (rings in synthetic transactions)`
- `#1.15 -> field:vouch/threadline (who knows this system)`
- `#1.16 -> field:downstream (fexx301) and sponsor DepGraph`

Yield: generated 16 · merged 7 · unique 9 (56%). R3 kills: 1.1, 1.2, 1.5, 1.6, 1.8. Survivors: 1.3, 1.4, 1.10, 1.11 (only 4, so 6 pairs).

Tournament (both orders, one line per pair):
```
#1.4 v #1.3  | J1 A J2 A dev A inv A gen B | rev: J1 A J2 A dev A inv A gen A | #1.4 4.5-0.5 (gen flipped: tie) | real open data vs synthetic charts
#1.4 v #1.10 | J1 A J2 A dev A inv B gen A | rev: J1 A J2 A dev A inv B gen A | #1.4 4-1 | a conflict is a path question; interlocks are a lookup
#1.4 v #1.11 | J1 A J2 A dev A inv A gen A | rev: J1 A J2 A dev A inv A gen B | #1.4 4.5-0.5 | planner payer weak
#1.3 v #1.10 | J1 B J2 B dev A inv B gen A | rev: J1 B J2 B dev B inv B gen A | #1.10 3.5-1.5 | real data wins
#1.3 v #1.11 | J1 A J2 B dev A inv A gen A | rev: J1 A J2 B dev A inv A gen A | #1.3 4-1 | handover pain is sharper
#1.10 v #1.11 | J1 A J2 A dev A inv A gen B | rev: J1 A J2 A dev A inv A gen B | #1.10 4-1 |
```
Champion R1: **#1.4** (13.5). Then 1.10, 1.3, 1.11. Round note: survivors are thin; switch generator families.

---

## Round 2 — generators: FUTURE, COLLIDE, DATA, WANT (T2 list), plus mutants and a crossover of #1.4

| # | Gen | Card | WANT | Fate |
|---|---|---|---|---|
| 2.1 | mutant 1.4 (output) | Program chair · paper→reviewer assignment as MaxFlow with capacities, conflicts removed · conferences | W3, W5 | survives (lineage) |
| 2.2 | mutant 1.4 (user) | Science journalist · independent experts with no co-authorship or funding ties to the company · newsrooms | W2 | survives (lineage) |
| 2.3 | crossover 1.4 × T2 | Several editor agents share one reviewer-load graph so nobody gets a fourth invite this month · publishers | W4 | survives (lineage) |
| **2.4** | FUTURE | Teams running browser agents · **a shared map of each website's screens and actions, built from every agent run; the next agent plans its route on the map instead of re-exploring** · agent platforms, QA/RPA teams | W1-W5 | survives |
| 2.5 | COLLIDE (kidney exchange → shift rota) | Nurses and retail staff · n-way shift-swap cycles found in a wants graph · employers' scheduling | W5 | survives |
| 2.6 | DATA | Translational researcher · drug-repurposing candidates with mechanistic paths on Hetionet (CC0) · biotech | W2 | survives (YELLOW: Neo4j's flagship demo dataset) |
| 2.7 | WANT (procedural) | Coding agents · map of how each repo builds and tests (state = env, action = command), shared across agents · devtool teams | W4 | survives (sibling of 2.4) |
| 2.8 | WANT (per-user) | Student · per-student mastery graph tutor | W4 | **KILL L0** (Recall, MindMate, Omnitutor) |
| 2.9 | COLLIDE | Transplant coordinator · kidney paired-exchange cycles and chains · registries | W5 | survives (synthetic medical data) |
| 2.10 | WANT (handoff) | Call-centre agents hand off with graph state | W4 | merged `-> field:agent-office-relay` |
| 2.11 | DATA | Venue safety officer · evacuation capacity by MaxFlow on OSM | W3 | survives (weak payer) |
| 2.12 | mutant 1.4 (customer) | Grant agency · panel conflicts | W2 | merged `-> #1.4 lineage (same demo)` |

**Measurement during R2 (M2 probe for the #1.4 lineage, `data/coi_probe.mjs`):** for 12 random 2024 papers, the authors of OpenAlex `related_works` (a naive "similar paper" reviewer suggester) were direct co-author conflicts in **2 of 120 (1.7%)**. Positive control 12/12. The hook "similarity tools suggest conflicted reviewers" is **false**; the #1.4 lineage loses its negation (G5).

**Measurement during R2 (M2 probe for #2.4, `data/m2w_reuse.py`):** on Mind2Web (1,009 human-recorded tasks on 73 real websites), **24.5% of all steps re-walk a transition another task on the same site already walked**; 19.8% of tasks have half or more of their steps already walked. Growth with traffic: 4.9% after 1 earlier task on the site, 13.8% after 4, 20.2% after 8, **27.8% after 12**. Controls: cross-site 0.2%, planted duplicate 100%.

Yield: generated 12 · merged 2 · unique 10 (83%). R3 kills: 2.8. Top 6 after triage: 2.4, 2.5, 2.6, 2.7, 2.3, 1.4.

```
#2.4 v #2.5 | J1 A J2 A dev A inv A gen B | rev: J1 A J2 A dev A inv A gen B | #2.4 4-1 | the graph IS the agent's plan; every T2 bullet
#2.4 v #2.6 | J1 A J2 A dev A inv A gen A | rev: J1 A J2 A dev A inv A gen A | #2.4 5-0 | Hetionet is Neo4j's demo
#2.4 v #2.7 | J1 A J2 A dev A inv A gen A | rev: J1 A J2 B dev A inv A gen A | #2.4 4.5-0.5 (J2 flipped) | the web is the bigger market
#2.4 v #2.3 | J1 A J2 A dev A inv A gen A | rev: same | #2.4 5-0 |
#2.4 v #1.4 | J1 A J2 A dev A inv A gen A | rev: same | #2.4 5-0 | 1.4's hook measured false
#2.5 v #2.6 | J1 B J2 A dev A inv A gen A | rev: J1 B J2 A dev A inv B gen A | #2.5 3.5-1.5 | cycles are graph-native; delight
#2.5 v #2.7 | J1 A J2 B dev A inv A gen A | rev: J1 A J2 B dev B inv A gen A | #2.5 3.5-1.5 |
#2.5 v #2.3 | J1 A J2 A dev A inv A gen A | rev: J1 A J2 A dev A inv B gen A | #2.5 4.5-0.5 |
#2.5 v #1.4 | J1 A J2 A dev A inv A gen A | rev: same | #2.5 5-0 |
#2.6 v #2.7 | J1 A J2 B dev B inv A gen A | rev: J1 A J2 B dev B inv A gen A | #2.6 3-2 |
#2.6 v #2.3 | J1 A J2 A dev A inv A gen A | rev: J1 A J2 A dev A inv A gen B | #2.6 4.5-0.5 |
#2.6 v #1.4 | J1 A J2 A dev A inv A gen B | rev: same | #2.6 4-1 |
#2.7 v #2.3 | J1 A J2 A dev A inv A gen B | rev: same | #2.7 4-1 |
#2.7 v #1.4 | J1 A J2 A dev A inv B gen B | rev: same | #2.7 3-2 |
#2.3 v #1.4 | J1 A J2 A dev A inv A gen A | rev: J1 A J2 A dev A inv B gen A | #2.3 4.5-0.5 | load-sharing is real coordination
```
Champion R2: **#2.4** (23.5). Then 2.5 (16.5), 2.6 (14), 2.7 (10), 2.3 (8), 1.4 (2).

---

## Round 3 — mutants and crossovers of #2.4, fresh cards from PERSON, CUSTOMER, DATA, FUTURE, WISH

| # | Gen | Card | Fate |
|---|---|---|---|
| 3.1 | mutant 2.4 (user) | QA teams: a regression map; a broken edge is a broken release | lineage |
| 3.2 | mutant 2.4 (output) | The map as an **MCP server** any agent can call (`plan`, `report`, `explain`); private tenant maps for internal apps beside the public map | lineage |
| 3.3 | mutant 2.4 (assumption: "agents must explore first") | **Humans pave the first paths**: bootstrap each site's map from recorded human trajectories (Mind2Web) | lineage |
| 3.4 | mutant 2.4 (proof) | A live cost meter: second run's steps, tokens and seconds vs the first | lineage |
| 3.5 | crossover 2.4 × 2.7 | One procedural map spanning browser and terminal | lineage |
| 3.6 | crossover 2.4 × 2.3 | Concurrent agents report edge health like Waze traffic; a failing action re-routes everyone | lineage |
| 3.7 | PERSON | Ifeoma, 27, ops analyst running 200 public-portal lookups a week | merged `-> #2.4 (same demo, her portals)` |
| 3.8 | CUSTOMER | Agent platforms pay per map lookup | merged `-> #3.2` |
| 3.9 | DATA | Public-sector form portals map | merged `-> #2.4` |
| 3.10 | FUTURE | Agents negotiating with agents over a shared contract-state graph | merged `-> field:agent-office-relay` |
| 3.11 | WISH | Agent tool selection via FalkorDB text-to-cypher/QueryWeaver | **KILL G3** (sponsor ships it) |

Fresh (non-lineage) yield: 5 generated · 4 merged · 1 killed · **0 unique (0%)**; the fresh cues have converged on the champion's mechanism. Lineage: 3.2 + 3.3 + 3.4 + 3.6 each beat the bare 2.4 on the panel and are folded into it as **#2.4b**; 3.1 and 3.5 lose (narrower market; scope).

```
#2.4b v #3.1 | J1 A J2 A dev A inv A gen A | rev: same | #2.4b 5-0
#2.4b v #3.5 | J1 A J2 A dev A inv A gen A | rev: J1 A J2 B dev A inv A gen A | #2.4b 4.5-0.5
#2.4b v #2.5 | J1 A J2 A dev A inv A gen B | rev: J1 A J2 A dev A inv A gen B | #2.4b 4-1 | gen keeps preferring the warmer swap story
#2.4b v #2.6 | J1 A J2 A dev A inv A gen A | rev: same | #2.4b 5-0
#3.1 v #2.5  | J1 B J2 A dev B inv A gen B | rev: J1 B J2 A dev B inv B gen B | #2.5 3.5-1.5
#3.5 v #2.5  | J1 A J2 A dev B inv B gen B | rev: J1 B J2 A dev B inv B gen B | #2.5 3.5-1.5
#2.5 v #2.6  | J1 B J2 A dev A inv A gen A | rev: J1 B J2 A dev A inv B gen A | #2.5 3.5-1.5
(remaining lineage-vs-lineage pairs not needed: lineage cards are folded or dropped)
```

**Stop rule met:** the #2.4 lineage won R2 and R3 (the mutant #2.4b replaced it); the last round's fresh yield is 0% (< 40%); 3 rounds run. Noise guard did not fire.

**Final two (different mechanisms):** **#2.4b** (procedural path map for acting agents) and **#2.5** (n-way shift-swap cycles).
