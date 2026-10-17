"use client";
import { useEffect, useMemo, useState } from "react";
import { useApi } from "../lib/useApi";
import type { RunRow, StepRow } from "../lib/types";
import styles from "./Meter.module.css";

const label = (key: string) => { const [kind, , name] = key.split(":"); return `${kind} ${name ?? ""}`.trim(); };
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function Steps({ site, run }: { site: string; run: RunRow }) {
  const s = useApi<{ steps: StepRow[] }>(`/api/steps?site=${encodeURIComponent(site)}&run=${encodeURIComponent(run.id)}`);
  if (s.status === "loading") return <p className={styles.hint} role="status">Loading steps…</p>;
  if (s.status === "error") return <p className={styles.bad} role="alert">{s.message}</p>;
  if (!s.data.steps.length) return <p className={styles.hint}>This run stored no steps.</p>;
  return (
    <ol className={styles.steps}>
      {s.data.steps.map(st => (
        <li key={st.i}>
          <span className={styles.idx}>{st.i}</span>
          <span>{label(st.key)}</span>
          <span className={styles.src} data-src={st.source}>{st.source === "llm" ? "model" : "map"}</span>
          <span className="num">{(st.ms / 1000).toFixed(1)} s</span>
        </li>
      ))}
    </ol>
  );
}

function Col({ title, tone, run, site, max }: { title: string; tone: "cold" | "map"; run: RunRow; site: string; max: { llm: number; tokens: number; ms: number; steps: number } }) {
  const bar = (v: number, m: number) => ({ transform: `scaleX(${m ? Math.max(v ? 0.03 : 0, v / m) : 0})` });
  return (
    <section className={styles.col} data-tone={tone} aria-label={title}>
      <h2>{title}</h2>
      <ul className={styles.rows}>
        {([["Model calls", run.llm, max.llm, String(run.llm)], ["Tokens", run.tokens, max.tokens, run.tokens.toLocaleString()], ["Steps", run.steps, max.steps, String(run.steps)], ["Seconds", run.ms, max.ms, (run.ms / 1000).toFixed(1)]] as const).map(([k, v, m, shown]) => (
          <li key={k} className={styles.row}>
            <span className={styles.k}>{k}</span><b className="num">{shown}</b>
            <span className={styles.track} aria-hidden="true"><i style={bar(v, m)} /></span>
          </li>
        ))}
      </ul>
      <h3>Steps taken</h3>
      <Steps site={site} run={run} />
    </section>
  );
}

export function Meter({ site }: { site: string }) {
  const runs = useApi<{ runs: RunRow[] }>(`/api/runs?site=${encodeURIComponent(site)}`);
  const [task, setTask] = useState("");
  const ok = useMemo(() => (runs.status === "ok" ? runs.data.runs.filter(r => r.outcome === "success") : []), [runs]);
  const tasks = useMemo(() => [...new Set(ok.filter(r => r.mode === "cold").map(r => r.task))].filter(t => ok.some(r => r.mode === "map" && r.task === t)), [ok]);
  useEffect(() => { setTask(t => (tasks.includes(t) ? t : tasks[0] ?? "")); }, [tasks]);

  if (runs.status === "loading") return <p className={styles.state} role="status">Loading runs…</p>;
  if (runs.status === "error") return <p className={styles.state} role="alert">{runs.message}</p>;
  const cold = ok.filter(r => r.mode === "cold"), map = ok.filter(r => r.mode === "map");
  if (!tasks.length) return <div className={styles.state}><h2>No task has both a cold and a map run here</h2><p>Run the same task twice with the agent (<code>npm run agent</code>): the first run explores, the second follows the map.</p></div>;

  const a = cold.find(r => r.task === task), b = map.find(r => r.task === task);
  const max = a && b ? { llm: Math.max(a.llm, b.llm), tokens: Math.max(a.tokens, b.tokens), ms: Math.max(a.ms, b.ms), steps: Math.max(a.steps, b.steps) } : { llm: 1, tokens: 1, ms: 1, steps: 1 };
  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <label className={styles.pick}><span>Task</span>
          <select value={task} onChange={e => setTask(e.target.value)}>{tasks.map(t => <option key={t} value={t}>{t}</option>)}</select>
        </label>
        <p className={styles.over}>All successful runs on this site: <b className="num">{cold.length}</b> cold averaged <b className="num">{avg(cold.map(r => r.llm)).toFixed(1)}</b> model calls and <b className="num">{Math.round(avg(cold.map(r => r.tokens))).toLocaleString()}</b> tokens; <b className="num">{map.length}</b> map runs averaged <b className="num">{avg(map.map(r => r.llm)).toFixed(1)}</b> model calls and <b className="num">{Math.round(avg(map.map(r => r.tokens))).toLocaleString()}</b> tokens.</p>
      </div>
      {a && b && (
        <div className={styles.cols}>
          <Col key={"c" + (a?.id ?? "")} title="Cold run: the model explores" tone="cold" run={a} site={site} max={max} />
          <Col key={"m" + (b?.id ?? "")} title="Map run: the graph decides" tone="map" run={b} site={site} max={max} />
        </div>
      )}
      <p className={styles.note}>Latest successful run of each kind for this task. Steps are often equal because the cold run already found a short path; what the map removes is the model. Seconds include a one-action-per-second politeness delay and page loads.</p>
    </div>
  );
}
