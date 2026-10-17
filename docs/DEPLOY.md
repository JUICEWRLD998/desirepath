# Deploying (Phase 7)

Three pieces, each on a free tier. These steps need your own accounts, so they are written out here and not run for you. Browser execution stays local and is declared as such in the README.

| Piece | Where | Needs |
|---|---|---|
| Database | FalkorDB Cloud (already running) | nothing new. Keep the instance active; free instances can pause |
| Dashboard `apps/web` | Vercel | the five `FALKORDB_*` values |
| MCP server `packages/mcp` | Render (free web service, Docker) | the same values plus `MCP_WRITE_TOKEN` |

## 1. Push the repo

Push the branch to GitHub (`juicewrld998/desirepath`). `.env` is ignored. Never commit the keys.

## 2. Dashboard on Vercel

1. vercel.com, **Add New, Project**, import the repo.
2. **Root Directory:** `apps/web`. Turn **on** "Include source files outside of the Root Directory in the Build Step" (the dashboard imports `packages/core` and `packages/mcp`). Framework: Next.js, detected.
3. **Environment variables** (Production): `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_USERNAME`, `FALKORDB_PASSWORD`, `FALKORDB_TLS=true`. Values are the ones in your `.env`. The dashboard never needs `OPENROUTER_API_KEY`.
4. Deploy. `apps/web/next.config.mjs` already ships `packages/core/queries/*.cypher` with the API routes. If `/api/plan` answers `packages/core/queries not found` on Vercel, that include list is the first place to look.
5. Check from a private window: open the URL, pick `books.toscrape.com`, plan "Open page 2 of the Mystery category".

The dashboard is read-only: no route writes to the graph.

## 3. MCP server on Render

1. render.com, **New, Blueprint**, pick the repo. It reads `render.yaml` (Docker, free plan, health check `/health`).
2. Fill the `sync: false` secrets: `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_USERNAME`, `FALKORDB_PASSWORD`. `MCP_WRITE_TOKEN` is generated for you; copy it from the service page.
3. After the deploy, `curl https://SERVICE.onrender.com/health` answers `{"ok":true,...}`. The MCP endpoint is `https://SERVICE.onrender.com/mcp`.
4. Anyone can call `observe`, `plan`, `explain` and `map_stats`. `report` (writes) needs `Authorization: Bearer MCP_WRITE_TOKEN` and only works for the sites in `MCP_WRITABLE_SITES`. Free Render services sleep when idle: the first call takes about a minute. Hit `/health` before the demo.
5. Claude Code: `claude mcp add --transport http desirepath https://SERVICE.onrender.com/mcp`.

The Dockerfile was written but not built on this machine (no Docker here). If the build fails, the likely causes are the `tsx` install line or the Node version. The server itself runs with `npm run mcp -- --http 8787`.

## 4. After deploying

- Replace the two `TODO-URL` lines in `README.md` with the live URLs, and use them in the submission form.
- Run the judge path on the deployed URL from a clean browser: open, Map, click a trail, Plan a task.
- If a key ever reached git, rotate it now.
