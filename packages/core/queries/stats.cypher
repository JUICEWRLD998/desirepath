// Per-map numbers for the cold-vs-map meter.
MATCH (r:Run) RETURN r.mode AS mode, count(r) AS runs, avg(r.steps) AS steps, avg(r.ms) AS ms, avg(r.llm_calls) AS llm
