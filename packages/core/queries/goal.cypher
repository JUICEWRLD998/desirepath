// Semantic memory: this screen satisfied this kind of task. Params: id, text, site, sig, now
MERGE (g:Goal {id: $id})
  ON CREATE SET g.text = $text, g.site = $site, g.created = $now
WITH g
MATCH (s:State {sig: $sig})
MERGE (s)-[r:REACHES]->(g)
  ON CREATE SET r.count = 0
SET r.count = r.count + 1, r.last_seen = $now
RETURN r.count
