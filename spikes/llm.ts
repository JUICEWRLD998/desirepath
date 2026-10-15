// P0: one structured-output call through OpenRouter. Records model id + usage to spikes/out/llm.json.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

const key = process.env.OPENROUTER_API_KEY, model = process.env.OPENROUTER_MODEL;
if (!key || !model) throw new Error("OPENROUTER_API_KEY / OPENROUTER_MODEL missing");
const openrouter = createOpenRouter({ apiKey: key });
const r = await generateObject({
  model: openrouter(model),
  schema: z.object({ kind: z.enum(["click", "type", "select", "navigate"]), role: z.string(), name: z.string(), nth: z.number().int(), value: z.string().optional() }),
  prompt: "Task: find the cheapest travel book. Candidates: 1 link 'Travel', 2 link 'Mystery', 3 textbox 'Search'. Propose ONE action.",
});
console.log(r.object, r.usage);
writeFileSync("spikes/out/llm.json", JSON.stringify({ model, object: r.object, usage: r.usage }, null, 2));
