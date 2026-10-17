# AI disclosure

Event rule 11 asks for AI assistants to be disclosed.

- **Claude Code** (Anthropic) wrote most of the code in this repository, the tests, the dashboard and the documentation drafts, working from a plan I wrote and reviewed. Sessions ran on my machine; the commit history shows the order of the work.
- **At runtime** the agent calls `google/gemini-2.5-flash` through OpenRouter, only when the graph has no confident route. Map-mode runs call no model.
- **What I did myself:** chose the idea and the plan, set the rules the agent follows on real sites (robots.txt, one action per second, no logins), ran every measurement on my own machine and read the receipts, and decided what the README may claim. Numbers in the README come from `docs/receipts/` and are listed with their commands in `CLAIMS.md`.
- **What I reviewed:** the graph model, the Cypher queries, the planner and recorder, the MCP tools and their safety limits. I can explain each of them.
- No private or customer data is used. Public sites, our own test shop, and the Mind2Web dataset (CC-BY-4.0, Deng et al. 2023).

Mustapha Fadhlullah, independent security researcher
