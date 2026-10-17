# Deploy Desirepath

Desirepath deploys as two services backed by one FalkorDB Cloud instance:

| Service | Host | Purpose |
|---|---|---|
| Dashboard | Vercel | Read-only map, run history, and route planning |
| MCP server | Render | Streamable HTTP endpoint at `/mcp`; health check at `/health` |
| Graph database | FalkorDB Cloud | Persistent maps used by both services |

The browser agent and test shop run locally. The deployed dashboard and MCP
server do not launch a browser. Deploying does not run or populate a map: make
sure the FalkorDB instance contains the site maps you want to show before
testing the live dashboard.

## 1. Prepare the repository and database

1. Push the desired branch to GitHub. Do not commit `.env` or credentials.
2. Create or select a FalkorDB Cloud instance and keep its connection details
   available. The deployment uses the split connection variables:
   `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_USERNAME`,
   `FALKORDB_PASSWORD`, and `FALKORDB_TLS=true`.
3. Populate the maps you want the live app to display. For example, configure
   the local checkout's `.env` for the same FalkorDB instance and run the
   relevant exploration/demo commands from the README. Avoid running reset or
   destructive demo scripts against a database containing maps you want to
   preserve.
4. Optionally run the local checks before deploying:

   ```powershell
   npm ci
   npm run typecheck
   npm test
   npm run web:build
   ```

   Database integration tests require FalkorDB settings; without them, those
   tests are skipped. If `.env` contains FalkorDB settings, the integration
   tests attempt to connect and fail if the configured database is unreachable
   or rejects authentication. Do not treat skipped integration tests as proof
   that the cloud database is reachable.

   Configure either `FALKORDB_URL` or the split `FALKORDB_HOST`,
   `FALKORDB_PORT`, `FALKORDB_USERNAME`, and `FALKORDB_PASSWORD` values. When
   using the URL, leave `FALKORDB_HOST` empty: the client prefers the split
   host whenever it is set. When using split settings, leave `FALKORDB_URL`
   empty. Confirm the endpoint, credentials, and TLS setting against the
   current FalkorDB Cloud connection details.

   To run only local/unit tests without connecting to a configured database,
   clear both connection selectors in this PowerShell session first:

   ```powershell
   $env:FALKORDB_URL = ""
   $env:FALKORDB_HOST = ""
   npm test
   ```

   The database-dependent tests will be reported as skipped; this does not
   replace running them against a reachable test database.

   On Windows, stop any local MCP/agent process using this checkout before
   running `npm ci`. `npm ci` replaces `node_modules`; a running `tsx` process
   can keep esbuild's executable open and cause `EPERM` during cleanup.

## 2. Deploy the dashboard to Vercel

1. In Vercel, choose **Add New → Project** and import the GitHub repository.
2. Set **Root Directory** to `apps/web` (not `./`). If the folder is not shown
   in the picker, enter `apps/web` as the directory path; it exists in the
   repository but is not the repository root. Enable **Include source files
   outside of the Root Directory in the Build Step** so the Next.js app can
   import the shared `packages/` code. Use the Next.js framework preset.
3. Add these **Production** environment variables in Project Settings:

   | Name | Value |
   |---|---|
   | `FALKORDB_HOST` | Hostname from the FalkorDB connection details |
   | `FALKORDB_PORT` | Port from the FalkorDB connection details |
   | `FALKORDB_USERNAME` | FalkorDB username |
   | `FALKORDB_PASSWORD` | FalkorDB password |
   | `FALKORDB_TLS` | `false` for the currently tested FalkorDB host |

   These variables are server-side. The dashboard does not need
   `OPENROUTER_API_KEY`; browser runs and model calls remain local.
4. Deploy. Once the deployment is ready, open its URL in a private browser
   window and try selecting a populated site, opening a trail, and planning a
   task. If a route fails with `packages/core/queries not found`, check that
   source files outside the root directory are included and redeploy.
5. Save the production URL for the README and demo materials.

The API routes are read-only; they do not record runs or create site maps.

## 3. Deploy the MCP server to Render

The repository's `render.yaml` and root `Dockerfile` define a Render Blueprint
for the MCP service.

1. In Render, choose **New → Blueprint** and connect the GitHub repository.
   Confirm that Render detects `render.yaml` and creates the
   `desirepath-mcp` web service.
2. In the service's environment settings, provide the FalkorDB values:
   `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_USERNAME`, and
   `FALKORDB_PASSWORD`. The Blueprint sets `FALKORDB_TLS=true` and generates
   `MCP_WRITE_TOKEN` for you. Keep that token private.
3. Review `MCP_WRITABLE_SITES` in the Blueprint. It limits which site maps
   `report` may write to; add only sites you intend to permit. New maps are
   not allowed unless `MCP_ALLOW_NEW_SITES=1` is explicitly configured.
4. Wait for the first build and deployment to finish. Open
   `https://<your-service>.onrender.com/health`; a healthy service returns
   JSON with `"ok": true`. The MCP endpoint is
   `https://<your-service>.onrender.com/mcp`.
5. Configure an MCP client with that endpoint. For Claude Code:

   ```powershell
   claude mcp add --transport http desirepath https://<your-service>.onrender.com/mcp
   ```

   Read-only MCP tools (`observe`, `plan`, `explain`, and `map_stats`) do not
   require the write token. Calls to `report` must include the generated
   `MCP_WRITE_TOKEN` in the expected authorization header. Do not put the token
   in a checked-in MCP config, README, or public URL.

Render's free web services can sleep when idle, so the first request after a
quiet period may take a while. Check `/health` shortly before a live demo.

## 4. Verify the deployed system

1. Load the Vercel dashboard and confirm it can list sites and plan a task
   against the populated graph.
2. Check the Render `/health` endpoint.
3. Connect an MCP client to `/mcp` and call `map_stats` and `plan` for a
   populated site.
4. Only test `report` if you intend to write to the shared map, and only for a
   site allowed by `MCP_WRITABLE_SITES`.
5. Replace the deployment placeholders in the README with the real dashboard,
   MCP, and demo URLs. Do not publish credentials or the MCP write token.

## Troubleshooting

- **Dashboard reports that FalkorDB is unreachable:** check the five
  `FALKORDB_*` environment variables, the cloud instance's TLS requirement,
  and whether the database accepts connections from the deployed service.
- **`packages/core/queries not found` on Vercel:** verify the app root is
  `apps/web` and the option to include files outside that directory is enabled.
- **Render fails its health check:** inspect the Render build and service logs;
  verify the FalkorDB variables are set and that the service starts on Render's
  `PORT` (the Docker command uses it).
- **MCP `report` is unauthorized:** send the generated write token using the
  authorization format expected by the MCP server. Keep the token out of
  client-side code and logs.
- **MCP reads return no routes:** check that the site map exists in the same
  FalkorDB instance and uses the expected site key.
