// UNVERIFIED until P0 runs it: full-text procedure syntax. Which screens satisfied tasks like this one.
CALL db.idx.fulltext.queryNodes('Goal', $text) YIELD node, score
MATCH (st:State)-[r:REACHES]->(node)
RETURN st.sig AS goalSig, node.text AS goalText, score, r.count AS times
ORDER BY score DESC, times DESC LIMIT 5
