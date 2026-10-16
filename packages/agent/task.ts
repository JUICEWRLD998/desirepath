// A task is a goal on one site plus slot values. "Done" is a deterministic predicate, never an LLM's opinion (plan §6.5).
import { urlTemplate } from "../core/signature.ts";

export interface Task {
  id: string;
  /** Graph namespace: the map is public:<site>. */
  site: string;
  baseUrl: string;
  start: string;
  text: string;
  slots: Record<string, string>;
  /** Minimum gap between the agent's actions on this site (real sites: 1000, plan §3). */
  minIntervalMs?: number;
  goal: {
    /** Path of the URL template the final screen must have, e.g. "/checkout", "/product/:id" or "/wiki/{title}". */
    path: string;
    /** Strings that must all appear on the final page (case-insensitive). `{slot}` is replaced by the slot value. */
    textIncludes?: string[];
    /** The raw URL must contain this (`{slot}` allowed). Needed where the template cannot tell pages apart, e.g. "/page/3/". */
    urlIncludes?: string;
  };
}

export const fill = (s: string, slots: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => slots[k] ?? `{${k}}`);

export function goalMet(task: Task, obs: { url: string; text: string }): boolean {
  let got = new URL(urlTemplate(obs.url)).pathname;
  try { got = decodeURIComponent(got); } catch { /* keep the raw path */ }
  const want = fill(task.goal.path, task.slots);
  // a trailing * matches any path below that prefix, e.g. "/author/*"
  if (want.endsWith("*") ? !got.startsWith(want.slice(0, -1)) : got !== want) return false;
  if (task.goal.urlIncludes && !obs.url.includes(fill(task.goal.urlIncludes, task.slots))) return false;
  const text = obs.text.toLowerCase();
  return (task.goal.textIncludes ?? []).every(t => text.includes(fill(t, task.slots).toLowerCase()));
}
