// A scripted task names its goal by id: the screens that satisfied it, most often first. Params: id
MATCH (st:State)-[r:REACHES]->(g:Goal {id: $id})
RETURN st.sig AS goalSig, r.count AS times
ORDER BY times DESC LIMIT 1
