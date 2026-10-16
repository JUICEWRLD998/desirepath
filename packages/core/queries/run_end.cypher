// Close a run. Params: id, now, outcome ('success'|'failure'), steps, llm, tokens, ms
MATCH (r:Run {id: $id})
SET r.ended = $now, r.outcome = $outcome, r.steps = $steps, r.llm_calls = $llm, r.tokens = $tokens, r.ms = $ms
RETURN r.id
