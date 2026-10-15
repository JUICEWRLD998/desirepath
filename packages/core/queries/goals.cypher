// Verified on a local FalkorDB (module ver 41803); $text must be built with ftQuery() in graph.ts. Which screens satisfied tasks like this one.
CALL db.idx.fulltext.queryNodes('Goal', $text) YIELD node, score
MATCH (st:State)-[r:REACHES]->(node)
RETURN st.sig AS goalSig, node.text AS goalText, score, r.count AS times
ORDER BY score DESC, times DESC LIMIT 5
