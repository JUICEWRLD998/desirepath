# Dashboard design plan (Phase 5)

**Subject.** desirepath: the worn trails agents leave across real websites. Audience: a hackathon judge and an engineer deciding whether to trust a shared map. Jobs: (1) Map: see which routes are worn and which broke. (2) Plan: type a task, watch the cheapest route light up. (3) Meter: cold run against map run. (4) Runs: who wrote what, and whether concurrent writers collided.

**Vocabulary (from the subject, not from "tech").** Turf and trodden earth, survey stakes, contour lines, field-book ticks. Edges are trails: thicker with traffic, amber like bare soil; a failed trail is dashed clay. States are survey stakes on contour paper. No terminal, CRT, glow-everywhere.

**Collision with house taste (SIGNAL DECK).** Deep blue-black plus one mint accent sits in the near-black + acid-accent cluster. Resolved by tinting every surface toward green (hue 165, chroma 0.022) and giving the support hues real jobs: amber = traffic, clay = failure, cool blue = the LLM (cold) run. Mint stays the one call-to-action colour and the planned route. He can overrule this.

**Palette (OKLCH, dark / light).** ground .19 .022 165 / .975 .012 150; surface .235 .024 165 / .945 .016 150; ink .94 .014 130 / .22 .03 165; accent .83 .14 168 / .50 .12 168; worn .80 .11 75 / .58 .12 70; clay .72 .15 28 / .52 .17 28; cold .78 .09 235 / .48 .10 235. Measured numbers are in `VERIFY.md` after the build.

**Type.** Bricolage Grotesque for UI and headings; IBM Plex Mono only for signatures and action keys. Tabular numbers on every changing figure.

**Wireframe (desktop 1280).**
```
[desirepath]  [site v]                         [Map | Cold vs map | Runs]  [theme]
+------------------------------------------+  +-------------------------+
| contour paper, survey stakes, trails     |  | Plan a task             |
| click a trail -> explain                 |  | [ task text ]  [Plan]   |
|                                          |  | route steps tick in     |
+------------------------------------------+  | or: edge / state detail |
                                              +-------------------------+
```
Below 1024 the side panel drops under the map; the map re-lays vertically under 640.

**Hierarchy contract, first viewport.** Where am I: site name and counts. What matters most: the map with its worn trails. What can I do: Plan a task (primary), click a trail. What just happened: the route lights hop by hop and the panel reports hops, success estimate and `0 LLM calls`. What next: open Cold vs map to see what it saved.

**Signature moment.** Plan: the chosen route draws hop by hop (about 260 ms per hop, ease-out), a walker marker rides it, each stake pulses as it is reached, the panel rows tick in with it. Reduced motion: the route is lit at once, same end state.

**Imagery.** The map is the product's own output (ladder R1). Its ground is a deterministic contour field (R2, graded to tokens). Cold vs map and Runs are data-filled and skip a picture (no page screenshots are stored with runs). Empty states carry the contour motif.

**Not built here:** the human-paved Mind2Web layer toggle (needs a site-name mapping between Mind2Web sites and domains; the numbers are in `DECISIONS.md` item 26).
