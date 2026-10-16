// The LLM is asked for ONE action, and only when the map has no confident route (plan §8). It picks a number from a
// list we built from the page, so it cannot invent a control that is not there.
import { generateText, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import type { Known } from "../core/graph.ts";
import type { Candidate, Observation } from "./observe.ts";
import type { Task } from "./task.ts";

export const MAX_CANDIDATES = 150;

export interface ProposeInput {
  task: Task;
  obs: Observation;
  /** Plain-language record of this run's earlier steps, newest last. */
  history: string[];
  /** What the map already knows from this screen. Only passed when exploring. */
  known: Known[];
  explore: boolean;
}
export interface Proposal { index: number; slot: string | null; tokens: number }
export type Proposer = (input: ProposeInput) => Promise<Proposal>;

export const describe = (c: Candidate) => `${c.role} "${c.name}"`;

export function buildPrompt({ task, obs, history, known, explore }: ProposeInput): string {
  const shown = obs.candidates.slice(0, MAX_CANDIDATES);
  const slots = Object.entries(task.slots).map(([k, v]) => `${k} = "${v}"`).join(", ") || "none";
  const lines = [
    "You control a web browser. Reach the goal by choosing ONE action for this turn.",
    `Goal: ${task.text}`,
    `Values you may type or select (name the slot): ${slots}`,
    "",
    `Page: ${obs.screen.title} (${obs.url})`,
    `Page text (start): ${obs.text.replace(/\s+/g, " ").slice(0, 600)}`,
    "",
    "Actions available on this page:",
    ...shown.map((c, i) => `${i + 1}. ${describe(c)}${c.nth > 0 ? ` (#${c.nth + 1} of that name)` : ""}${c.value ? ` (already contains "${c.value}")` : ""}`),
  ];
  if (history.length) lines.push("", "Your steps so far:", ...history.slice(-6).map(h => `- ${h}`));
  if (explore && known.length) {
    lines.push("", "The shared map already knows these actions from this screen (it has seen them work):",
      ...known.map(k => `- ${k.role} "${k.name}" (#${k.nth + 1})`),
      "Prefer an action that is NOT on that list, so the map learns a second route. Repeat a listed action only when nothing else can make progress.");
  }
  lines.push("", 'Answer with the number of the action ("index"). For a textbox or dropdown also give the NAME of the slot to fill it from ("slot", for example "product", not its value); for anything else slot is null. A field that already contains its value is done: click the control that submits it.');
  return lines.join("\n");
}

export function openRouterProposer(env: NodeJS.ProcessEnv = process.env): Proposer {
  const key = env.OPENROUTER_API_KEY, model = env.OPENROUTER_MODEL;
  if (!key || !model) throw new Error("OPENROUTER_API_KEY / OPENROUTER_MODEL missing (see .env.example)");
  const openrouter = createOpenRouter({ apiKey: key });
  return async input => {
    // The slot can only be one of the task's slot names, so the model cannot hand back a typed value in its place.
    const names = Object.keys(input.task.slots);
    const slot = names.length ? z.enum(names as [string, ...string[]]).nullable() : z.null();
    const r = await generateText({
      model: openrouter(model),
      output: Output.object({ schema: z.object({ index: z.number().int(), slot }) }),
      temperature: 0,
      prompt: buildPrompt(input),
    });
    const u = r.usage;
    return { index: r.output.index, slot: r.output.slot, tokens: u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0) };
  };
}
