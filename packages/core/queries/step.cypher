// Episodic memory: one step of a run, linked to the run and to the states it left and reached.
// `to` is the edge's target when the step walked an edge (the EXPECTED state for a failed map step), else the current state.
// Params: run, i, key, ok (0|1), ms, source ('map'|'llm'), observed, from, fromUrl, fromTitle, fromLandmarks,
// to, toUrl, toTitle, toLandmarks, now
MATCH (r:Run {id: $run})
MERGE (a:State {sig: $from})
  ON CREATE SET a.url_template = $fromUrl, a.title = $fromTitle, a.landmarks = $fromLandmarks, a.first_seen = $now, a.visits = 0
MERGE (b:State {sig: $to})
  ON CREATE SET b.url_template = $toUrl, b.title = $toTitle, b.landmarks = $toLandmarks, b.first_seen = $now, b.visits = 0
CREATE (st:Step {run: $run, i: $i, action_key: $key, ok: $ok, ms: $ms, source: $source, observed: $observed})
CREATE (st)-[:OF_RUN]->(r), (st)-[:FROM]->(a), (st)-[:TO]->(b)
RETURN st.i
