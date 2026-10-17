# Submission checklist (Phase 8)

Done by me (in the repo): README with setup, graph model, queries and algorithms; CLAIMS.md; DEMO.md with the voiceover; AI disclosure; MIT license; deploy files.

Left for you, in this order:

1. Check `CLAIMS.md` exists and its table is filled (it is written when `npm run p6` finishes). Read the "What this supports" paragraph once; the README repeats it.
2. Deploy (docs/DEPLOY.md), then replace the three `TODO-URL` lines at the top of `README.md` (dashboard, MCP endpoint, video).
3. Record the demo with DEMO.md. Upload it, put the link in the README.
4. Blog side prize: write it in your own words (what the map is, the 24.5% measurement, the honest result that map runs save the model but not time, the bundler bug in DECISIONS 29). Run it past `humanizer` if you like.
5. Pre-submit grep, from the repo root: `grep -rniE "mock|fake|dummy|lorem|picsum|randomuser|TODO-URL" --include=*.ts --include=*.tsx --include=*.md . --exclude-dir=node_modules --exclude-dir=strategy` and fix every hit that is not a deliberate word in prose.
6. `npm test` and `npm run typecheck` green, `git status` clean, `.env` not committed. Do not commit `strategy/`.
7. In the form name both tracks: **Track 02** and **Track 01**. Post once in the FalkorDB and WeMakeDevs Discords if you want to (you send it).
8. You press submit. Deadline: Oct 18, 11:59 PM IST.
