// UNVERIFIED until P0 runs it: log() availability and SET evaluation order on this FalkorDB version.
// Upsert one walked step. Params: from, fromUrl, fromTitle, fromLandmarks, to, toUrl, toTitle, toLandmarks,
// key, kind, role, name, nth, label, ok (0|1), fail (0|1), ms, now
MERGE (a:State {sig: $from})
  ON CREATE SET a.url_template = $fromUrl, a.title = $fromTitle, a.landmarks = $fromLandmarks, a.first_seen = $now, a.visits = 0
SET a.visits = a.visits + 1
MERGE (b:State {sig: $to})
  ON CREATE SET b.url_template = $toUrl, b.title = $toTitle, b.landmarks = $toLandmarks, b.first_seen = $now, b.visits = 0
MERGE (a)-[e:ACT {key: $key}]->(b)
  ON CREATE SET e.kind = $kind, e.role = $role, e.name = $name, e.nth = $nth, e.label = $label,
                e.ok = 0, e.fail = 0, e.ms = 0.0
SET e.ms = (e.ms * (e.ok + e.fail) + $ms) / (e.ok + e.fail + 1)
SET e.ok = e.ok + $ok, e.fail = e.fail + $fail, e.last_seen = $now
SET e.risk = -log((e.ok + 1.0) / (e.ok + e.fail + 2.0)) + 0.05
RETURN e.ok, e.fail, e.risk
