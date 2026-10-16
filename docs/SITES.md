# Sites

Every real site Desirepath touches, what its `robots.txt` says, and how the agent behaves there. Checked 2026-10-16 with the
agent's own parser (`packages/agent/robots.ts`, tested in `robots.test.ts`).

**Rules the agent follows on every real site** (`packages/agent/loop.ts`, `browser.ts`):
- an identified user agent: the browser's own string plus `Desirepath/0.1 (research agent; +https://github.com/juicewrld998/desirepath)`
- `robots.txt` is fetched before the first request; a main-frame navigation to a path it disallows is aborted
  (a `robots.txt` that answers 5xx stops the run; a 404 means no restrictions)
- at most one action per second (`minIntervalMs: 1000` in every real-site task)
- no logins, no form submissions, no payments, no captcha handling; typed values come from the task and are never stored in the graph

| Site | Used for | `robots.txt` | Notes |
|---|---|---|---|
| books.toscrape.com | tasks `books-*` | 404: no restrictions | a sandbox built for scraping practice |
| quotes.toscrape.com | tasks `quotes-*` | 404: no restrictions | same family |
| en.wikipedia.org | tasks `wikipedia-*` | 200. Disallows `/w/` and `Special:Search` for generic agents, and sets a 5 s crawl delay for some named bots | Our agent therefore **never uses Wikipedia search** (the form posts to `/w/index.php`, which is disallowed) and only follows article links, which are allowed. Reads of article pages only, at 1 per second |
| openlibrary.org | none yet | 200 on 2026-10-15 | **Not used.** The host times out from the author's machine (`ERR_CONNECTION_TIMED_OUT` on every load, 2026-10-15 and 2026-10-16), so no signature was measured and no task was run. Dropped first, per the plan's cut list |
| apps/testshop | tasks `testshop-*`, the redesign beat | ours | Not a real site. It exists because a real site cannot be redesigned on cue; this is stated in the README |
| Mind2Web (Hugging Face) | `scripts/measure_reuse.py`, `scripts/pave_mind2web.ts` | n/a | A dataset, not a crawl: human-recorded paths on 73 sites in 2023 snapshots. CC-BY-4.0, Deng et al. 2023. The agent does not browse those sites |

The agent never runs against any other real site.
