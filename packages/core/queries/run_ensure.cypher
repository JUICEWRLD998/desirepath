// A run opened by a client that only calls report() over MCP. Params: id, agent, tenant ('' for public), task, mode, now
MERGE (r:Run {id: $id})
  ON CREATE SET r.agent = $agent, r.tenant = $tenant, r.task = $task, r.mode = $mode, r.started = $now,
                r.outcome = 'running', r.steps = 0, r.llm_calls = 0, r.tokens = 0, r.ms = 0
RETURN r.id
