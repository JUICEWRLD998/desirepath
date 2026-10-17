export interface SiteRow { site: string; states: number; edges: number; runs: number; goals: number }
export interface NodeRow { sig: string; url: string; title: string; visits: number; first: number }
export interface EdgeRow { from: string; to: string; key: string; label: string; name: string; role: string; ok: number; fail: number; risk: number; ms: number; last: number }
export interface GoalRow { sig: string; id: string; text: string; times: number }
export interface MapData { nodes: NodeRow[]; edges: EdgeRow[]; goals: GoalRow[] }
export interface RunRow { id: string; agent: string; task: string; mode: "cold" | "map"; outcome: string | null; steps: number; llm: number; tokens: number; ms: number; started: number }
export interface StepRow { i: number; key: string; ok: number; ms: number; source: string; from: string; to: string }
export interface WalkRow { run: string; agent: string; mode: string; task: string; ok: number; ms: number; source: string; at: number }
export interface PlanStep { key: string; kind: string; role: string; name: string; to: string; ok: number; fail: number; ms: number }
export interface PlanRoute { source: string; goal: string; goal_sig: string; walked_for_this_goal: boolean; hops: number; p_success: number; est_ms: number; steps: PlanStep[] }
export interface PlanOut { source: string | null; routes: PlanRoute[]; reason?: string; nearest_goals?: Array<{ goal: string; times: number }> }
export const edgeId = (from: string, key: string) => `${from}|${key}`;
