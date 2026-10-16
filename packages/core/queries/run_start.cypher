// Episodic memory: one agent episode. Params: id, agent, tenant ('' for public), task, mode ('cold'|'map'), now
CREATE (r:Run {id: $id, agent: $agent, tenant: $tenant, task: $task, mode: $mode, started: $now,
               outcome: 'running', steps: 0, llm_calls: 0, tokens: 0, ms: 0})
RETURN r.id
