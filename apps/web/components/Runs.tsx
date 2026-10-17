"use client";
import { useMemo, useState } from "react";
import { useApi } from "../lib/useApi";
import type { RunRow } from "../lib/types";
import styles from "./Runs.module.css";

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** One lane per agent on a shared time axis, so runs that overlapped in time are visibly side by side. */
function Lanes({ runs }: { runs: RunRow[] }) {
  const agents = [...new Set(runs.map(r => r.agent))].sort();
  const t0 = Math.min(...runs.map(r => r.started)), t1 = Math.max(...runs.map(r => r.started + (r.ms || 0)));
  const span = Math.max(1, t1 - t0);
  if (agents.length < 2) return <p className={styles.hint}>Only one agent has written to this map, so there is no concurrency to show.</p>;
  return (
    <div className={styles.lanes} role="img" aria-label={`Timeline of ${runs.length} runs across ${agents.length} agents`}>
      {agents.map(a => (
        <div key={a} className={styles.lane}>
          <span className={styles.laneName}>{a}</span>
          <span className={styles.laneTrack}>
            {runs.filter(r => r.agent === a).map(r => (
              <i key={r.id} data-mode={r.mode} data-bad={r.outcome !== "success" || undefined} title={`${r.task} · ${r.mode} · ${(r.ms / 1000).toFixed(1)} s`}
                 style={{ left: `${((r.started - t0) / span) * 100}%`, width: `max(4px, ${((r.ms || 0) / span) * 100}%)` }} />
            ))}
          </span>
        </div>
      ))}
      <p className={styles.hint}>{when(t0)} to {when(t1)}</p>
    </div>
  );
}

export function Runs({ site }: { site: string }) {
  const res = useApi<{ runs: RunRow[] }>(`/api/runs?site=${encodeURIComponent(site)}`);
  const [mode, setMode] = useState<"all" | "cold" | "map">("all");
  const [bad, setBad] = useState(false);
  const shown = useMemo(() => (res.status === "ok" ? res.data.runs.filter(r => (mode === "all" || r.mode === mode) && (!bad || r.outcome !== "success")) : []), [res, mode, bad]);

  if (res.status === "loading") return <p className={styles.state} role="status">Loading runs…</p>;
  if (res.status === "error") return <p className={styles.state} role="alert">{res.message}</p>;
  if (!res.data.runs.length) return <div className={styles.state}><h2>No run has been recorded on this site</h2><p>Run <code>npm run agent</code> to write the first one.</p></div>;
  return (
    <div className={styles.wrap}>
      <section className={styles.card} aria-labelledby="lanes-h">
        <h2 id="lanes-h">Who wrote when</h2>
        <Lanes runs={res.data.runs} />
      </section>
      <section className={styles.card} aria-labelledby="log-h">
        <div className={styles.bar}>
          <h2 id="log-h">Run log <span className="num">({shown.length})</span></h2>
          <div className={styles.filters} role="group" aria-label="Filters">
            {(["all", "cold", "map"] as const).map(m => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "all" ? "All runs" : m === "cold" ? "Cold" : "Map"}</button>)}
            <button type="button" aria-pressed={bad} onClick={() => setBad(b => !b)}>Not successful</button>
          </div>
        </div>
        {shown.length === 0 ? <p className={styles.hint}>No run matches this filter.</p> : (
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead><tr><th>Task</th><th>Agent</th><th>Mode</th><th>Outcome</th><th className={styles.r}>Steps</th><th className={styles.r}>Model calls</th><th className={styles.r}>Tokens</th><th className={styles.r}>Seconds</th><th>Started</th></tr></thead>
              <tbody>{shown.map(r => (
                <tr key={r.id}>
                  <td data-label="Task" className={styles.task}>{r.task}</td><td data-label="Agent">{r.agent}</td>
                  <td data-label="Mode"><span className={styles.pill} data-mode={r.mode}>{r.mode}</span></td>
                  <td data-label="Outcome" className={r.outcome === "success" ? "" : styles.fail}>{r.outcome ?? "unfinished"}</td>
                  <td data-label="Steps" className={`${styles.r} num`}>{r.steps}</td><td data-label="Model calls" className={`${styles.r} num`}>{r.llm}</td><td data-label="Tokens" className={`${styles.r} num`}>{r.tokens.toLocaleString()}</td><td data-label="Seconds" className={`${styles.r} num`}>{(r.ms / 1000).toFixed(1)}</td>
                  <td data-label="Started" className="num">{when(r.started)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
