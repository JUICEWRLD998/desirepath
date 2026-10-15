# Decisions

Phase 0 spike results. Raw output: `spikes/out/`. **Local** = a FalkorDB module (ver 41803) from the `falkordblite` 0.10.0 PyPI package, run in the build sandbox. **Cloud** = the FalkorDB Cloud free instance.

## Status

| Spike | Local | Cloud | Result |
|---|---|---|---|
| Connection round trip | pass (6.6 ms, meaningless for Cloud) | **not run** | `WRONGPASS` from Cloud on the author's machine: credentials in `FALKORDB_URL` rejected |
| `algo.SPpaths`, float `weightProp`, `costProp`+`maxCost`, `pathCount: 3` | pass | **not run** | three routes in weight order, see below |
| Cypher `log()` | pass | **not run** | `-log(0.5)` = 0.693147180559945; risk is computed in Cypher |
| Full-text index on `Goal` | pass | **not run** | `CALL db.idx.fulltext.createNodeIndex('Goal','text')`, `queryNodes('Goal','travel')` |
| `algo.pageRank`, `algo.WCC` syntax | pass | **not run** | `CALL algo.pageRank('S','ACT')`, `CALL algo.WCC({nodeLabels:['S'],relationshipTypes:['ACT']})` |
| Two graphs (`public:x`, `tenant:a:x`) in one request | pass | **not run** | colon names work and are isolated |
| Playwright accessibility snapshot | pass (headless Chromium, `ariaSnapshot()`) | n/a | roles and names returned; quoted entries need the parser fix below |
| OpenRouter structured output | n/a | **pass** | `google/gemini-2.5-flash`, valid `{kind, role, name, nth}`, 85 in / 24 out tokens, cost $0.0000855 (author's run) |
| Signature stability on the demo sites (§6.1) | unit-tested on fixtures | **partial (3 of 4 reachable)** | books, quotes, Wikipedia: 3 loads give one `sig`; two books product pages share a `sig`; category differs from product. Open Library: `ERR_CONNECTION_TIMED_OUT` on every load from the author's machine, so not measured. Test shop does not exist yet (Phase 2). Raw: `spikes/out/signature.json` |

**Phase 0 is therefore NOT complete.** Missing: a successful Cloud connection (still `WRONGPASS` on 2026-10-15), the 100 MB size check, and Open Library in the signature test (host unreachable from the author's machine).

## Results worth keeping

`SPpaths` on the toy graph (A to F; `risk` 1.5 / 0.1 / 0.6 per hop):
```
[ac,cd,df]  pathWeight 0.3  pathCost 300
[ae,ef]     pathWeight 1.2  pathCost 200
[ab,bf]     pathWeight 3    pathCost 200
```
Float weights are accepted; no need for the integer-scaling fallback.

## Decisions

1. **Risk is computed in Cypher, from the new counts.** Separate `SET` clauses do not see each other's writes on this FalkorDB, so the first `report.cypher` computed `risk` from the previous counts (one report stale: 0.7431 after one success, should be 0.4555). Fixed by computing `ok2`, `fail2`, `ms2` in `WITH` and deriving `risk` from them. Covered by `report.db.test.ts`; that test fails against the old query.
2. **Landmark parser handles Playwright's YAML quoting.** Entries with special characters are emitted as `- 'button "Say: hi"'`; the first parser silently dropped them. Escaped quotes are unescaped.
3. **Headings add one `heading` marker**, not one entry each, and do not use the 40-landmark cap. This is a reading of "plus heading roles" in plan §6.1; per-heading entries would make the signature vary with heading count.
4. **Id detection is narrower than the first version.** `slug_123` collapses only when lowercase (books.toscrape), so Wikipedia's `Windows_10` and `Boeing_747` stay distinct. 12+ hex segments need a digit. `page-N.html` collapses.
5. **Free-text goal lookup goes through `ftQuery()`** (OR-ed tokens). The raw full-text query is AND-ed and breaks on punctuation.
6. **LLM:** `google/gemini-2.5-flash` via OpenRouter. The AI SDK warns that `generateObject` is deprecated; switch to `generateText` with an output setting when the agent loop is written (Phase 2).

7. **Repeated item cards collapse.** Links inside `listitem > article` become `link:*` and each distinct card landmark is listed once. Without it two books.toscrape product pages got different signatures ("Products you recently viewed" cards carry other books' titles). Covered by `signature.test.ts`; confirmed on the live site.

## Known limitations (not fixed)

- `ms` averages failed attempts too, so timeouts inflate it. The plan does not say otherwise.
- `b.visits` is incremented only when a state is the source of a step, so a final-only state shows 0.
- `last_fail` (plan §5) is not written yet.
- `Run` / `Step` / `REACHES` writes, and therefore `explain.cypher`, are Phase 2.
- Names containing `:` make action keys ambiguous in theory; collisions are not expected on the demo sites.
