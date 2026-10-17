"use client";
import { useApi } from "../lib/useApi";
import { edgeId, type MapData, type WalkRow } from "../lib/types";
import type { Selection } from "./MapView";
import styles from "./Detail.module.css";

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function Detail({ site, map, selection }: { site: string; map: MapData; selection: Selection }) {
  const edge = selection?.kind === "edge" ? map.edges.find(e => edgeId(e.from, e.key) === selection.id) : undefined;
  const walks = useApi<{ runs: WalkRow[] }>(edge ? `/api/explain?site=${encodeURIComponent(site)}&from=${encodeURIComponent(edge.from)}&key=${encodeURIComponent(edge.key)}` : null);
  const node = selection?.kind === "node" ? map.nodes.find(n => n.sig === selection.sig) : undefined;
  const title = (sig: string) => map.nodes.find(n => n.sig === sig)?.title.split(" | ")[0] ?? "screen";

  if (!edge && !node) {
    return (
      <section className={styles.card} aria-label="Details">
        <h2>Details</h2>
        <p className={styles.hint}>Select a trail to see the runs that walked it, or a screen to see what leaves it.</p>
      </section>
    );
  }
  if (node) {
    const out = map.edges.filter(e => e.from === node.sig);
    const goals = map.goals.filter(g => g.sig === node.sig);
    return (
      <section className={styles.card} aria-label="Screen details">
        <h2>{node.title.split(" | ")[0] || "Screen"}</h2>
        <p className={`${styles.url} code`}>{node.url}</p>
        <dl className={styles.facts}>
          <div><dt>times left from</dt><dd className="num">{node.visits}</dd></div>
          <div><dt>trails out</dt><dd className="num">{out.length}</dd></div>
        </dl>
        {goals.length > 0 && <div><h3>Goals reached here</h3><ul className={styles.list}>{goals.map(g => <li key={g.id}>{g.text}<span className="num">{g.times}×</span></li>)}</ul></div>}
        {out.length > 0 && <div><h3>Leaving this screen</h3><ul className={styles.list}>{out.map(e => <li key={e.key}>{e.label}<span className="num">{e.ok}/{e.ok + e.fail}</span></li>)}</ul></div>}
      </section>
    );
  }
  const e = edge!;
  const total = e.ok + e.fail, rate = total ? e.ok / total : 0;
  return (
    <section className={styles.card} aria-label="Trail details">
      <h2>{e.name || e.label}</h2>
      <p className={styles.sub}>{title(e.from)} → {title(e.to)}</p>
      <dl className={styles.facts}>
        <div><dt>worked</dt><dd className="num">{e.ok}</dd></div>
        <div><dt>failed</dt><dd className={`num ${e.fail ? styles.bad : ""}`}>{e.fail}</dd></div>
        <div><dt>success rate</dt><dd className="num">{Math.round(rate * 100)}%</dd></div>
        <div><dt>average time</dt><dd className="num">{(e.ms / 1000).toFixed(1)} s</dd></div>
      </dl>
      <p className={styles.sub}>Cost used by the planner (risk): <b className="num">{e.risk.toFixed(3)}</b>. Last walked {when(e.last)}.</p>
      <h3>Runs that walked it</h3>
      {walks.status === "loading" && <p className={styles.hint} role="status">Loading runs…</p>}
      {walks.status === "error" && <p className={styles.bad} role="alert">{walks.message}</p>}
      {walks.status === "ok" && (walks.data.runs.length === 0
        ? <p className={styles.hint}>No stored run is linked to this trail.</p>
        : <ul className={styles.list}>{walks.data.runs.map(w => (
            <li key={w.run}><span><b>{w.agent} · {w.mode} run</b><small>{w.source === "llm" ? "The model chose this step" : "Followed from the map"} · {when(w.at)}</small><small>{w.task}</small></span><span className={`num ${w.ok ? "" : styles.bad}`}>{w.ok ? "ok" : "failed"} · {(w.ms / 1000).toFixed(1)} s</span></li>
          ))}</ul>)}
    </section>
  );
}
