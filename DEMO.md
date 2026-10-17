# Demo: how to record it, and what to say

Target length: 2:00. You record the screen and the voice yourself. Everything on screen is real: nothing is mocked, and the only number you say aloud that is not in this file comes from `CLAIMS.md`.

## Before you hit record (10 minutes)

1. `npm install`, then fill `.env` (FalkorDB Cloud and OpenRouter keys).
2. Start the dashboard: `npm run web:build` then `npm run web:start`, open <http://localhost:3100> (or the deployed URL once Phase 7 is done). Use the **dark** theme and a 1920x1080 window at 100% zoom.
3. Start the test shop in a second terminal: `npm run shop` (<http://127.0.0.1:4100>).
4. Make sure the maps exist. If `books.toscrape.com` shows 4 screens on the dashboard you are fine. If not: `npm run p6` (about an hour, polite pacing) or `npm run p3`.
5. Rehearse the terminal commands below once so no model call surprises you mid-take. Keep OpenRouter credit above 1 USD.
6. Close notifications. Put the terminal font at 20 px.

## Shot list

| Time | You do | You say (voiceover below) |
|---|---|---|
| 0:00 | Dashboard, **Map** view, `books.toscrape.com` selected. Slowly point at the amber trails and the flags. | Problem and idea |
| 0:20 | Terminal: `npm run agent -- --task books-page2 --mode cold` (it prints each step and its LLM call). Let two steps scroll by. Cut the wait. | Cold agent |
| 0:35 | Same command with `--mode map`. It prints 0 model calls. | Map run |
| 0:50 | Dashboard: type `Open page 2 of the Mystery category` in **Plan a task**, press **Plan route**. The route lights up hop by hop. Click one trail to show the runs behind it. | Plan box and proof |
| 1:10 | Dashboard **Cold vs map** tab. Let the two columns sit for three seconds. | The honest meter |
| 1:25 | Test shop beat. Run `npm run agent -- --task testshop-add-and-checkout --mode map`, then open `http://127.0.0.1:4100/_layout?set=b` and run it again. The first route fails on one click and the planner takes another. Switch back with `?set=a`. (`npm run p2` does the whole sequence but is long; its last output is in `docs/receipts/p2-latest.json`.) | The redesign |
| 1:45 | Terminal: `npm run mcp:demo`. Then ask Claude Code, after `claude mcp add desirepath -- npx tsx packages/mcp/server.ts`, for a route on books.toscrape.com. | MCP |
| 1:55 | Full-screen the README top (title, live link, repo). | Close |

If a command is slow on camera, record it once, then speed it up 4x and put "sped up" in the corner. Do not fake a step.

## Voiceover script (about 270 words, calm pace)

**0:00** Every browser agent explores every website as if it were the first one ever there. On Mind2Web, nearly a quarter of all steps, 24.5 percent, repeat a step another task already took on the same site. That work is thrown away every time.

**0:20** This is a cold run. The model looks at the page, picks an action, looks again. Every step is a model call, and every call costs tokens.

**0:35** Desirepath turns every run into a map in FalkorDB. Screens are nodes, actions are edges, and each edge remembers how many times it worked, how many times it failed, and how long it took. Same task, map on. The route comes from a shortest path query in the graph, and this run made zero model calls.

**0:50** Here is that planner on its own. I type a task in plain words, the graph finds the goal it has reached before, and returns the lowest-risk route. Click any trail and you see the runs that walked it, with the agent, the mode and the time. Nothing here is guessed.

**1:10** I will be straight about what the map saves. It saves the model: no calls, no tokens. It does not cut the step count, because on these small sites the cold run already finds a short path, and the time saved is only about a second, since the politeness delay dominates.

**1:25** And when a site changes, the map heals. This is our own test shop, because I cannot redesign a real site on cue. After the redesign one button stops working. The first route fails, the failure is written to the graph, and the planner takes the next route. The next agent never tries the broken edge again.

**1:45** The whole map is an MCP server with five tools: observe, plan, report, explain and map stats. Claude Code asks for a route and gets one. Agents can share a map, and a tenant gets a private overlay that is never copied into the public one.

**1:55** Desirepath. One map, every agent. The repo, the live demo and the numbers behind every claim are in the README.

## Things not to say

- Do not say "faster" or "fewer steps" for map runs on real sites. `CLAIMS.md`: steps are equal and the time gain is about a second.
- Do not say "users" in the plural. It is one user so far.
- Do not call the test shop a real site, and do not call the Mind2Web paths agent runs.
- Do not read out a number that is not in `CLAIMS.md`.

## If something breaks while recording

| Symptom | Fix |
|---|---|
| Dashboard says the graph is not reachable | Check the FalkorDB values in `.env`, or resume the free instance on the FalkorDB Cloud page |
| A real site run fails | Run `npm run agent` again; if the site is down, use the test shop for that beat |
| Plan box says no route | Pick one of the goal chips under the box; those are goals the map has reached |
| Chromium missing | `npx playwright install chromium` |
