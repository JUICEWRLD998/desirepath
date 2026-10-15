# INTAKE — Graph Hacks: Context for AI Agents (WeMakeDevs × FalkorDB)

Written 2026-10-15 (hacking day 1). Facts that decay are marked (decays).

## A0 viability gate

| Check | Result | Status |
|---|---|---|
| Who pays runtime | FalkorDB: Cloud free tier (100 MB RAM, no card) or Docker locally. LLM: **his key, unknown** (no OpenAI key). Hosting: Vercel/Render/Fly free tiers | FalkorDB VERIFIED (docs.falkordb.com/cloud); LLM = OPEN QUESTION Q1 |
| Credentials valid | none issued yet; OpenAlex and GitHub public APIs answered live today | VERIFIED |
| Platform ceilings | FalkorDB Cloud free = 100 MB, single node. OpenAlex now meters: $0.0001/call, 1,000 calls/day without a key, 10,000/day with a free key | VERIFIED (live responses 2026-10-15) |
| Eligibility | "open to developers worldwide", free, solo or team ≤ 4, one team per person | VERIFIED (rules 1, FAQ) |
| Qualifying mechanics | main coding after Oct 15 00:01 IST (rule 8); FalkorDB primary DB and central (2, 3); public/synthetic/own data only, nothing login-protected or personal (6); AI assistants allowed but disclosed (11); must explain graph model, queries, architecture (12); fully AI-generated without understanding may be rejected (13) | VERIFIED (rules page) |
| Docker on this machine | `docker: command not found` | VERIFIED; plan uses FalkorDB Cloud or installs Docker Desktop |

**GO.** No blocker. One open question decides the agent's runtime (Q1).

## Event facts

- Dates: Oct 15 12:01 AM IST → **Oct 18 11:59 PM IST** (= Oct 18 18:29 UTC). Recorded as a fact; gates nothing. (decays)
- Prize: $20,000 total. One prize per track (iPhone 18 Pro / PS5 + GTA VI / M6 Mac Mini), every team member gets it. Side: AirPods 5 for best blog post; T-shirts for top 50. A project may enter **any or all tracks** and must name them (rule 5).
- Required in submission (rule 10): public repo; README with setup **and the graph data model**; **the Cypher queries or algorithms the product depends on**; demo video; live deployment (or full local setup); tracks entered. AI-assistant use disclosed (rule 11).
- Judging criteria and weights: **not published**. Judges: **not listed**. Winner announcement: not dated. (decays)
- Past edition: none. The same URL earlier described "Graph Hacks: Building Next-Gen RAG" (Sept 2026, $10k, tracks Investigation & Risk / Agentic AI / GraphRAG SDK) per search-index snippets; it was re-scoped into this event. No winners exist to study.

## Panel type (ASSUMED)

Sponsor devrel plus engineering: FalkorDB staff, likely with WeMakeDevs community reviewers. They score depth of FalkorDB use (rule 3: "if the product still works once FalkorDB is taken out, the graph is decoration"), explainability, and a working demo. Not a VC panel, but his standing G14 applies anyway.

## Prize-stack plan

One product, entered in **Track 02 (primary)** and **Track 01 (secondary)**, plus the blog side prize. Each track has its own winner; one project gets one chance per track. Track 03 skipped: the field is densest there (≈20 visible "company brain" repos on day 1) and the pick does not serve it honestly.

## The primitive being judged

FalkorDB as the agent's **context layer that shapes behaviour**: traversals on every agent step, graph algorithms as agent tools, one isolated graph per user/agent/tenant, memory that persists across sessions. Unique capabilities to show (overview page): "Traversals are fast enough to run on every step of an agent loop"; "one instance can hold thousands of isolated graphs"; algorithms (shortest path, PageRank, centrality, WCC, CDLP; docs also list A*, BFS, SSpaths, MSF, Betweenness, Harmonic, MaxFlow).

## THE WANT MAP

| # | WANT | Source (quoted) |
|---|---|---|
| WANT-1 | The graph is load-bearing, not decoration | Rules 3: "The graph has to do real work … if the product still works once FalkorDB is taken out, the graph is decoration rather than the thing the product runs on." Overview: "The graph has to shape what the agent does, not sit on the side." |
| WANT-2 | Agents that act, remember, and show their path | Overview: "Build an agent that acts on connected data, remembers what it learns, and can show how it got to each answer." "Show the path behind an answer." |
| WANT-3 | Show FalkorDB's own strengths | Overview: "Traversals are fast enough to run on every step of an agent loop, and one instance can hold thousands of isolated graphs, so each user, agent, or tenant gets its own." "Graph algorithms as agent tools … Traversals your agent can call instead of writing them itself." |
| WANT-4 | Track 02 in full | "Episodic, semantic, and procedural memory · Persistent conversation history · Shared state and handoffs between agents · High-concurrency reads and writes · Separate memory per user or tenant" — prize text: "the best agents that remember across sessions and share what they know." |
| WANT-5 | Track 01 in full | "Multi-hop reasoning · Graph queries and algorithms as agent tools · Tool selection through MCP · Actions based on what the graph shows · Explainable results" — prize text: "the best agent that uses a graph to make decisions and take action." |

**The gap between what they wrote and what they need:** FalkorDB sells "the graph database for AI agents". Their pitch needs a product where the *agent's own behaviour* runs on the graph at every step, at scale, across many tenants, so a graph DB is the obvious choice over a vector store. Most visible entries use the graph as a knowledge store an agent queries once per answer. Almost none make the graph the agent's *plan*.

## Sponsor surface and overlap audit (G3)

FalkorDB already ships (org repos, pushed 2026-09 to 10): `code-graph` (codebase graph, 348★), `RepoGraph` (git intelligence), `DepGraph` (package dependency impact), `QueryWeaver` (Text2SQL), `GraphRAG-SDK`, `FalkorDB-MCPServer`, `text-to-cypher`, `mem0-falkordb` and `graphiti` (conversational agent memory), `falkordblite` (embedded), `falkordb-pyg` (GNN backend), `flex` (JS UDFs), `game-pathfinding`, `CCH-demo`. **Dead on overlap:** codebase graphs, dependency impact, Text2SQL, chat-memory layers, game pathfinding.

## Access spikes (recorded)

- OpenAlex `/works/doi:…` → 200, full authorships (2026-10-15). Paging without a key: page-based works, cursor returned 401. VERIFIED.
- GitHub search API (unauthenticated) → 200 (2026-10-15). VERIFIED.
- Hugging Face Mind2Web parquet (CC-BY-4.0, ungated) → DuckDB column read of 1,009 tasks, 73 sites. VERIFIED.
- `algo.SPpaths` signature with `weightProp`, `costProp`, `maxCost`, `pathCount` (docs.falkordb.com/algorithms/sppath). VERIFIED from docs, **not yet run** on an instance (Phase 0 spike).

## Open questions (owner: him, date: before Phase 1)

- **Q1 (decisive):** which LLM can the agent use? Gemini (free AI Studio key), Anthropic, Groq, OpenRouter, local Ollama? The plan works with any model that does tool calls; cost and rate limits decide how many live runs the demo can afford.
- Q2: solo or team? (changes the parallel tracks in implementation.md)
- Q3: OK to install Docker Desktop, or use FalkorDB Cloud only?
