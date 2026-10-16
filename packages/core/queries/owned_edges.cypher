// Edges that a SUCCESSFUL run of exactly this task has walked successfully (task memory). Params: task
MATCH (st:Step {ok: 1})-[:OF_RUN]->(r:Run {task: $task, outcome: 'success'}), (st)-[:FROM]->(a:State)
RETURN DISTINCT a.sig AS from, st.action_key AS key
