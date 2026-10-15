// Verified on a local FalkorDB (module ver 41803). Up to three routes from the current screen to a goal screen.
MATCH (s:State {sig: $current}), (g:State {sig: $goal})
CALL algo.SPpaths({sourceNode: s, targetNode: g, relTypes: ['ACT'],
                   weightProp: 'risk', costProp: 'ms', maxCost: $maxMs, pathCount: 3})
YIELD path, pathWeight, pathCost
RETURN [r IN relationships(path) | {key: r.key, to: endNode(r).sig, kind: r.kind, role: r.role, name: r.name, nth: r.nth,
                                    ok: r.ok, fail: r.fail, ms: r.ms}] AS steps,
       size(relationships(path)) AS hops, pathWeight, pathCost
ORDER BY pathWeight ASC
