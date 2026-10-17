"use client";
import { useEffect, useState } from "react";
import type { MapData, PlanOut, PlanRoute } from "../lib/types";
import { edgeId } from "../lib/types";
import type { Lit } from "./MapView";
import styles from "./PlanPanel.module.css";

const pct = (p: number) => `${Math.round(p * 100)}%`;
const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function PlanPanel({ site, map, onLit }: { site: string; map: MapData; onLit: (l: Lit | null) => void }) {
  const goals = [...new Map(map.goals.map(g => [g.text, g])).values()].sort((a, b) => b.times - a.times);
  const [task, setTask] = useState("");
  const [from, setFrom] = useState(map.nodes[0]?.sig ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState<PlanOut | null>(null);
  const [pick, setPick] = useState(0);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => { setTask(""); setOut(null); setErr(null); setPick(0); setFrom(map.nodes[0]?.sig ?? ""); }, [site]); // eslint-disable-line react-hooks/exhaustive-deps

  const light = (r: PlanRoute | undefined, key: number) => {
    if (!r) { onLit(null); return; }
    let at = from; const ids: string[] = [];
    for (const s of r.steps) { ids.push(edgeId(at, s.key)); at = s.to; }
    onLit({ edgeIds: ids, runKey: key });
  };

  async function run(text = task) {
    if (!text.trim() || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/plan?site=${encodeURIComponent(site)}&from=${encodeURIComponent(from)}&task=${encodeURIComponent(text)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setOut(j as PlanOut); setPick(0);
      const k = runKey + 1; setRunKey(k); light((j as PlanOut).routes[0], k);
    } catch (e) { setErr((e as Error).message); setOut(null); onLit(null); }
    finally { setBusy(false); }
  }

  const route = out?.routes[pick];
  const nameOf = (sig: string) => (map.nodes.find(n => n.sig === sig)?.title.split(" | ")[0]) || "screen";

  return (
    <section className={styles.card} aria-labelledby="plan-h">
      <h2 id="plan-h">Plan a task</h2>
      <p className={styles.lede}>The route comes from the graph. No model is called.</p>
      <form onSubmit={e => { e.preventDefault(); run(); }} className={styles.form}>
        <label className={styles.field}>
          <span>Task</span>
          <textarea rows={2} value={task} maxLength={300} placeholder="Describe what the agent should do" onChange={e => setTask(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }} />
        </label>
        <label className={styles.field}>
          <span>Start from</span>
          <select value={from} onChange={e => setFrom(e.target.value)}>{map.nodes.map(n => <option key={n.sig} value={n.sig}>{n.title.split(" | ")[0] || n.url}</option>)}</select>
        </label>
        <button className={styles.go} type="submit" disabled={busy || !task.trim()}>{busy ? "Planning…" : "Plan route"}</button>
      </form>
      {goals.length > 0 ? (
        <div className={styles.known}>
          <span>Goals this map has reached</span>
          <ul>{goals.slice(0, 6).map(g => <li key={g.id}><button type="button" onClick={() => { setTask(g.text); run(g.text); }}>{g.text}</button></li>)}</ul>
        </div>
      ) : <p className={styles.none}>No goal has been reached on this site yet, so there is nothing to plan toward.</p>}

      <div aria-live="polite">
        {err && <p className={styles.err} role="alert">{err}</p>}
        {out && !route && (
          <div className={styles.miss}>
            <strong>No route found.</strong>
            <p>{out.reason ? out.reason[0].toUpperCase() + out.reason.slice(1) + ". Pick one of the goals above, or describe a task this site has already been used for." : ""}</p>
            {out.nearest_goals?.length ? <ul>{out.nearest_goals.map(g => <li key={g.goal}>{g.goal} <span className="num">({g.times}×)</span></li>)}</ul> : null}
          </div>
        )}
        {route && (
          <div className={styles.result} key={`${runKey}-${pick}`}>
            <p className={styles.goal}>Goal matched: <b>{route.goal}</b></p>
            <ol className={styles.steps}>
              {route.steps.map((s, i) => (
                <li key={i} style={{ animationDelay: `${i * 340}ms` }}>
                  <span className={styles.n}>{i + 1}</span>
                  <span className={styles.what}><code className={styles.kind}>{s.kind}</code><b>{s.name}</b><small>to {nameOf(s.to)}</small></span>
                  <span className={`${styles.worked} num`}>{s.ok}/{s.ok + s.fail}</span>
                </li>
              ))}
            </ol>
            <dl className={styles.facts}>
              <div><dt>hops</dt><dd className="num">{route.hops}</dd></div>
              <div><dt>chance it works</dt><dd className="num">{pct(route.p_success)}</dd></div>
              <div><dt>estimated</dt><dd className="num">{secs(route.est_ms)}</dd></div>
              <div><dt>model calls</dt><dd className="num">0</dd></div>
            </dl>
            {out && out.routes.length > 1 && (
              <div className={styles.alts} role="group" aria-label="Alternative routes">
                {out.routes.map((r, i) => <button key={i} type="button" aria-pressed={i === pick} onClick={() => { setPick(i); const k = runKey + 1; setRunKey(k); light(r, k); }}>Route {i + 1} · {r.hops} hops · {pct(r.p_success)}</button>)}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
