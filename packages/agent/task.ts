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
  goal: {
    /** Path of the URL template the final screen must have, e.g. "/checkout" or "/product/:id". */
    path: string;
    /** Strings that must all appear on the final page (case-insensitive). `{slot}` is replaced by the slot value. */
    textIncludes?: string[];
  };
}

export const fill = (s: string, slots: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => slots[k] ?? `{${k}}`);

export function goalMet(task: Task, obs: { url: string; text: string }): boolean {
  if (new URL(urlTemplate(obs.url)).pathname !== task.goal.path) return false;
  const text = obs.text.toLowerCase();
  return (task.goal.textIncludes ?? []).every(t => text.includes(fill(t, task.slots).toLowerCase()));
}
