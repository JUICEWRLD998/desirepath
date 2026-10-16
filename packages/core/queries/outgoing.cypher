// What the map already knows how to do from one screen (hints for the explorer). Params: sig
MATCH (a:State {sig: $sig})-[e:ACT]->(b:State)
RETURN e.key AS key, e.role AS role, e.name AS name, e.nth AS nth, e.ok AS ok, e.fail AS fail, b.sig AS to
ORDER BY e.ok DESC LIMIT 20
