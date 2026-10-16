// Verified on a local FalkorDB (module ver 41803). Separate SET clauses do not see each other's writes there,
// so the new counts are computed in WITH and risk is derived from them.
// Upsert one walked step. Params: from, fromUrl, fromTitle, fromLandmarks, to, toUrl, toTitle, toLandmarks,
// key, kind, role, name, nth, label, slot (task slot a typed value comes from, '' if none), pre (JSON fills made before this click, '' if none), ok (0|1), fail (0|1), ms, now
MERGE (a:State {sig: $from})
  ON CREATE SET a.url_template = $fromUrl, a.title = $fromTitle, a.landmarks = $fromLandmarks, a.first_seen = $now, a.visits = 0
SET a.visits = a.visits + 1
MERGE (b:State {sig: $to})
  ON CREATE SET b.url_template = $toUrl, b.title = $toTitle, b.landmarks = $toLandmarks, b.first_seen = $now, b.visits = 0
MERGE (a)-[e:ACT {key: $key}]->(b)
  ON CREATE SET e.kind = $kind, e.role = $role, e.name = $name, e.nth = $nth, e.label = $label, e.slot = $slot, e.pre = $pre,
                e.ok = 0, e.fail = 0, e.ms = 0.0
WITH a, b, e, e.ok + $ok AS ok2, e.fail + $fail AS fail2,
     (e.ms * (e.ok + e.fail) + $ms) / (e.ok + e.fail + 1) AS ms2
SET e.ok = ok2, e.fail = fail2, e.ms = ms2, e.last_seen = $now,
    e.risk = -log((ok2 + 1.0) / (ok2 + fail2 + 2.0)) + 0.05
RETURN e.ok, e.fail, e.ms, e.risk
