// The runs that walked one edge (the dashboard's "proof" click).
MATCH (a:State {sig: $from})-[e:ACT {key: $key}]->(b:State)
MATCH (st:Step)-[:FROM]->(a), (st)-[:TO]->(b), (st)-[:OF_RUN]->(r:Run)
WHERE st.action_key = $key
RETURN r.id, r.agent, r.mode, st.ok, st.ms, r.started ORDER BY r.started DESC LIMIT 20
