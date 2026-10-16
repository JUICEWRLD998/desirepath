// Semantic memory: this screen satisfied this kind of task. The screen is created if the run never recorded it
// (a slow page can finish loading after the step was judged). Params: id, text, site, sig, url, title, landmarks, now
MERGE (g:Goal {id: $id})
  ON CREATE SET g.text = $text, g.site = $site, g.created = $now
WITH g
MERGE (s:State {sig: $sig})
  ON CREATE SET s.url_template = $url, s.title = $title, s.landmarks = $landmarks, s.first_seen = $now, s.visits = 0
MERGE (s)-[r:REACHES]->(g)
  ON CREATE SET r.count = 0
SET r.count = r.count + 1, r.last_seen = $now
RETURN r.count
