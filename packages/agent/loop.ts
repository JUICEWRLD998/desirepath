// The agent loop (plan §8): observe -> plan -> act -> report. The LLM is called only when the map has no confident route.
// Cold mode is the honest baseline: same loop, planner off, map still recorded.
import { randomUUID } from "node:crypto";
import type { Page } from "playwright";
import { endRun, goalCandidates, goalSigById, outgoing, plan, recordReach, recordStep, report, startRun,
  type Graph, type ReportParams, type Screen } from "../core/graph.ts";
import { chooseRoute, edgeId } from "../core/route.ts";
import { actionKey } from "../core/signature.ts";
import { execute, type Action, type ExecResult } from "./execute.ts";
import { MAX_CANDIDATES, describe, type Proposer } from "./llm.ts";
import { observe, type Kind, type Observation } from "./observe.ts";
import type { Robots } from "./robots.ts";
import { goalMet, type Task } from "./task.ts";

export interface RunOptions {
  graph: Graph;
  page: Page;
  task: Task;
  mode: "cold" | "map";
  propose: Proposer;
  agent?: string;
  tenant?: string;
  /** Cold runs only: tell the LLM which actions the map already knows so the run finds a different route. */
  explore?: boolean;
  maxSteps?: number;
  actionTimeout?: number;
  /** Never navigate to a path this robots.txt disallows (main-frame navigations are aborted). */
  robots?: Robots;
  /** Gap between actions; defaults to the task's `minIntervalMs`. */
  minIntervalMs?: number;
  now?: () => number;
  log?: (line: string) => void;
}

export interface StepLog { i: number; source: "map" | "llm"; action: string; ok: boolean; ms: number; from: string; observed: string; error?: string }
export interface RunResult {
  runId: string; outcome: "success" | "failure"; steps: StepLog[]; llmCalls: number; tokens: number; ms: number;
  mapSteps: number; failedMapSteps: number;
}

/** Observe, retrying once if a navigation was still in flight. */
async function observeSettled(page: Page): Promise<Observation> {
  try { return await observe(page); }
  catch { await page.waitForLoadState("load").catch(() => {}); return await observe(page); }
}

const MAX_LLM_ERRORS = 3;

/**
 * Filling a field changes no screen, so it cannot be an edge of its own. The fills made on a screen are stored on the
 * click that leaves it ("fill the search box from slot `query`, then click Search"), as slot names only, never values.
 */
type Fill = Action & { slot: string };

export async function runTask(o: RunOptions): Promise<RunResult> {
  const { graph: g, page, task } = o;
  const now = o.now ?? Date.now;
  const log = o.log ?? (() => {});
  const maxSteps = o.maxSteps ?? 40, timeout = o.actionTimeout ?? 4000;
  const runId = randomUUID().replaceAll("-", "").slice(0, 16);
  const t0 = now();
  await startRun(g, { id: runId, agent: o.agent ?? "agent-1", tenant: o.tenant, task: task.text, mode: o.mode, now: t0 });

  const logs: StepLog[] = [];
  const failed = new Set<string>();    // map edges that failed in THIS run; never retried within it
  const deadEnds = new Set<string>();  // LLM actions that did nothing on a screen in THIS run; not offered again there
  const history: string[] = [];
  const slotNames = Object.keys(task.slots);
  let fills: Fill[] = [];
  let llmCalls = 0, tokens = 0, llmErrors = 0, outcome: "success" | "failure" = "failure";

  // politeness: one action per interval, and no navigation robots.txt forbids
  const interval = o.minIntervalMs ?? task.minIntervalMs ?? 0;
  let lastAt = 0;
  const pace = async () => {
    const wait = lastAt + interval - now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastAt = now();
  };
  const robots = o.robots;
  const guard = robots ? async (route: import("playwright").Route) => {
    const req = route.request();
    if (req.isNavigationRequest() && req.frame() === page.mainFrame() && !robots.allows(req.url())) await route.abort("blockedbyclient");
    else await route.continue();
  } : undefined;
  try {
    if (guard) await page.route("**/*", guard);
    if (robots && !robots.allows(new URL(task.start, task.baseUrl).href)) throw new Error(`robots.txt disallows the start page ${task.start}`);
    await pace();
    await page.goto(new URL(task.start, task.baseUrl).href, { waitUntil: "load", timeout: 30_000 });
    // A scripted task names its goal by id (plan §6.5); free text is only the fallback.
    const goalSig = o.mode === "map" ? (await goalSigById(g, task.id)) ?? (await goalCandidates(g, task.text))[0]?.goalSig : undefined;
    let cur = await observeSettled(page);

    for (let i = 1; ; i++) {
      if (goalMet(task, cur)) { outcome = "success"; break; }
      if (i > maxSteps) break;

      let action: Action | undefined;
      let source: "map" | "llm" = "llm";
      let expectedTo = "";
      let key = "";
      let pre: Fill[] = [];
      if (goalSig) {
        const route = chooseRoute(await plan(g, cur.screen.sig, goalSig), cur.screen.sig, failed);
        if (route) {
          const s = route.steps[0];
          action = { kind: s.kind as Kind, role: s.role, name: s.name, nth: s.nth, slot: s.slot || undefined };
          pre = s.pre ? JSON.parse(s.pre) as Fill[] : [];
          source = "map"; expectedTo = s.to; key = s.key;
        }
      }
      if (!action && goalSig === cur.screen.sig) {
        // On the goal's screen but not done (page 3 shares a screen with page 2): repeat the most-walked loop edge from here.
        const again = (await outgoing(g, cur.screen.sig)).find(k => k.to === cur.screen.sig && k.ok > 0 && !failed.has(edgeId(cur.screen.sig, k.key)));
        if (again) { action = { kind: "click", role: again.role, name: again.name, nth: again.nth }; source = "map"; expectedTo = cur.screen.sig; key = again.key; }
      }
      if (!action) {
        const known = o.explore ? await outgoing(g, cur.screen.sig) : [];
        const offered: Observation = { ...cur, candidates: cur.candidates.filter(c => !deadEnds.has(`${cur.screen.sig}|${actionKey(c.kind, c.role, c.name, c.nth)}`)) };
        llmCalls++;
        let p;
        try { p = await o.propose({ task, obs: offered, history, known, explore: !!o.explore }); }
        catch (e) {
          if (++llmErrors >= MAX_LLM_ERRORS) throw new Error(`LLM failed ${MAX_LLM_ERRORS} times: ${(e as Error).message}`);
          history.push("The previous answer was not usable."); log(`${i}. LLM error: ${(e as Error).message.split("\n")[0]}`);
          continue;
        }
        llmErrors = 0; tokens += p.tokens;
        const c = p.index >= 1 && p.index <= Math.min(offered.candidates.length, MAX_CANDIDATES) ? offered.candidates[p.index - 1] : undefined;
        if (!c) { history.push(`Choice ${p.index} is not on the list.`); log(`${i}. LLM chose ${p.index}: not on the list`); continue; }
        if (c.kind !== "click" && (!p.slot || !slotNames.includes(p.slot))) {
          history.push(`${describe(c)} needs a slot name (one of: ${slotNames.join(", ") || "none"}).`);
          log(`${i}. LLM chose ${describe(c)} without a valid slot`); continue;
        }
        action = { kind: c.kind, role: c.role, name: c.name, nth: c.nth, slot: c.kind === "click" ? undefined : p.slot! };
        key = actionKey(action.kind, action.role, action.name, action.nth);
      }

      const label = `[${action.role}] ${action.name} -> ${action.kind}`;
      await pace();
      const ts = now();
      let res: ExecResult = { ok: true };
      for (const f of pre) { res = await execute(page, f, task.slots, timeout); if (!res.ok) break; }   // replay the stored fills
      if (res.ok) res = await execute(page, action, task.slots, timeout);
      const ms = now() - ts;
      let nxt = await observeSettled(page);

      const edge = (to: Screen, ok: boolean, prefill: Fill[]): ReportParams => ({
        from: cur.screen.sig, fromUrl: cur.screen.urlTemplate, fromTitle: cur.screen.title, fromLandmarks: cur.screen.landmarks,
        to: to.sig, toUrl: to.urlTemplate, toTitle: to.title, toLandmarks: to.landmarks,
        key, kind: action!.kind, role: action!.role, name: action!.name, nth: action!.nth, label, slot: action!.slot ?? "",
        pre: prefill.length ? JSON.stringify(prefill) : "", ok: ok ? 1 : 0, fail: ok ? 0 : 1, ms, now: now() });

      let ok: boolean;
      if (source === "map") {
        // The edge promised a screen. Anything else is a failure, even when the click itself worked.
        ok = res.ok && nxt.screen.sig === expectedTo;
        // On failure the edge keeps its expected target (that screen is already in the graph); only its counts change.
        const target: Screen = ok ? nxt.screen : { ...nxt.screen, sig: expectedTo };
        await report(g, edge(target, ok, pre));
        await recordStep(g, { run: runId, i, key, ok, ms, source, from: cur.screen, to: target, observed: nxt.screen.sig, now: now() });
        if (!ok) {
          failed.add(edgeId(cur.screen.sig, key));
          history.push(`The map's step ${label} did not lead where expected.`);
          if (res.ok && nxt.screen.sig !== cur.screen.sig) {   // landed somewhere unexpected: back out to the known screen
            await page.goBack({ waitUntil: "load", timeout }).catch(() => {});
            nxt = await observeSettled(page);
          }
        }
      } else if (action.kind === "click") {
        // An LLM click becomes an edge only if it worked: it must have moved the page.
        ok = res.ok && (nxt.screen.sig !== cur.screen.sig || nxt.url !== cur.url);   // same-template pages (page 2 to 3) change the URL, not the screen
        if (ok) await report(g, edge(nxt.screen, true, fills));
        else deadEnds.add(`${cur.screen.sig}|${key}`);
        await recordStep(g, { run: runId, i, key, ok, ms, source, from: cur.screen, to: ok ? nxt.screen : cur.screen, observed: nxt.screen.sig, now: now() });
        history.push(ok ? `${describe(action)} -> ${nxt.screen.title}` : `${describe(action)} did nothing${res.error ? ` (${res.error})` : ""}`);
      } else {
        // A fill is remembered for the click that leaves this screen; it is not an edge.
        ok = res.ok;
        if (ok) fills = [...fills.filter(f => !(f.role === action!.role && f.name === action!.name && f.nth === action!.nth)), action as Fill];
        else deadEnds.add(`${cur.screen.sig}|${key}`);
        await recordStep(g, { run: runId, i, key, ok, ms, source, from: cur.screen, to: cur.screen, observed: nxt.screen.sig, now: now() });
        history.push(ok ? `Filled ${describe(action)} from the "${action.slot}" slot. Now submit it.` : `${describe(action)} could not be filled${res.error ? ` (${res.error})` : ""}`);
      }
      logs.push({ i, source, action: label, ok, ms, from: cur.screen.title, observed: nxt.screen.title, error: res.error });
      log(`${i}. [${source}] ${label} ${ok ? "ok" : "FAILED"} (${ms} ms) ${cur.screen.title} -> ${nxt.screen.title}`);
      if (nxt.screen.sig !== cur.screen.sig || nxt.url !== cur.url || source === "map") fills = [];
      cur = nxt;
    }

    if (outcome === "success") await recordReach(g, { id: task.id, text: task.text, site: task.site, sig: cur.screen.sig, now: now() });
  } finally {
    if (guard) await page.unroute("**/*", guard).catch(() => {});
    await endRun(g, { id: runId, now: now(), outcome, steps: logs.length, llm: llmCalls, tokens, ms: now() - t0 });
  }
  return { runId, outcome, steps: logs, llmCalls, tokens, ms: now() - t0,
    mapSteps: logs.filter(s => s.source === "map").length, failedMapSteps: logs.filter(s => s.source === "map" && !s.ok).length };
}
