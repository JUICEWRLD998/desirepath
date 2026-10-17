"use client";
import { animate, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { layout, trails, type Trail } from "../lib/layout";
import type { MapData } from "../lib/types";
import styles from "./MapView.module.css";

export type Selection = { kind: "edge"; id: string } | { kind: "node"; sig: string } | null;
export interface Lit { edgeIds: string[]; runKey: number }

const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const pathOf = (u: string) => { try { return new URL(u).pathname || "/"; } catch { return u.replace(/^https?:\/\/[^/]+/, "") || "/"; } };

/** Deterministic contour lines: closed curves around a few fixed centres. No randomness, so every render is identical. */
function Contours({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const rings = useMemo(() => {
    const centres = [[0.18, 0.3, 1], [0.72, 0.68, 1.15], [0.9, 0.18, 0.7]];
    const out: string[] = [];
    centres.forEach(([cx, cy, s], ci) => {
      for (let k = 1; k <= 9; k++) {
        const r = k * 46 * s, pts: string[] = [];
        for (let a = 0; a <= 64; a++) {
          const t = (a / 64) * Math.PI * 2;
          const wob = 1 + 0.16 * Math.sin(3 * t + ci + k * 0.35) + 0.09 * Math.sin(5 * t + ci * 2 - k * 0.2);
          pts.push(`${(x + cx * w + Math.cos(t) * r * wob * 1.25).toFixed(1)} ${(y + cy * h + Math.sin(t) * r * wob).toFixed(1)}`);
        }
        out.push("M " + pts.join(" L ") + " Z");
      }
    });
    return out;
  }, [x, y, w, h]);
  return <g className={styles.contours} aria-hidden="true">{rings.map((d, i) => <path key={i} d={d} />)}</g>;
}

export function MapView({ data, selection, onSelect, lit }: { data: MapData; selection: Selection; onSelect: (s: Selection) => void; lit: Lit | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(900);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setCw(Math.round(e.contentRect.width)));
    ro.observe(el); setCw(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => layout(data.nodes, data.edges, cw), [data, cw]);
  const tr = useMemo(() => trails(geo, data.edges), [geo, data.edges]);
  // Fit the whole map to its container (up to 130%); below 72% scale it scrolls instead of shrinking the text to nothing.
  const scale = Math.min(1.3, Math.max(0.72, cw / geo.width));
  // The viewBox grows to the canvas size and keeps the graph centred, so the contour paper fills the whole card.
  const svgW = Math.round(Math.max(cw, geo.width * scale)), svgH = Math.round(Math.max(geo.height * scale, cw >= 1000 ? 520 : 0));
  const vb = { w: svgW / scale, h: svgH / scale, x: geo.width / 2 - svgW / scale / 2, y: geo.height / 2 - svgH / scale / 2 };
  const maxTraffic = Math.max(1, ...data.edges.map(e => e.ok + e.fail));
  const goalCount = useMemo(() => { const m = new Map<string, number>(); for (const g of data.goals) m.set(g.sig, (m.get(g.sig) ?? 0) + g.times); return m; }, [data.goals]);

  // Signature moment: the planned route draws hop by hop, a walker rides it, each stake pulses when reached.
  const litRefs = useRef(new Map<string, SVGPathElement>());
  const walker = useRef<SVGCircleElement>(null);
  const [reached, setReached] = useState<Set<string>>(new Set());
  const [pulse, setPulse] = useState<string | null>(null);
  useEffect(() => {
    const els = litRefs.current;
    els.forEach(p => { p.style.strokeDashoffset = String(p.getTotalLength()); p.style.opacity = "0"; });
    walker.current?.setAttribute("opacity", "0");
    setReached(new Set()); setPulse(null);
    if (!lit || !lit.edgeIds.length) return;
    const trailById = new Map(tr.map(t => [t.id, t]));
    let stop = false; const ctrls: Array<{ stop: () => void }> = [];
    const done = new Set<string>();
    const finish = (t: Trail) => { done.add(t.e.to); setReached(new Set(done)); setPulse(t.e.to); };
    (async () => {
      const first = trailById.get(lit.edgeIds[0]); if (first) { done.add(first.e.from); setReached(new Set(done)); }
      for (const id of lit.edgeIds) {
        const t = trailById.get(id), p = els.get(id); if (!t || !p || stop) continue;
        const L = p.getTotalLength(); p.style.opacity = "1";
        if (reduce) { p.style.strokeDashoffset = "0"; finish(t); continue; }
        walker.current?.setAttribute("opacity", "1");
        await new Promise<void>(res => {
          const c = animate(0, 1, { duration: 0.34, ease: [0.23, 1, 0.32, 1], onUpdate: v => {
            p.style.strokeDashoffset = String(L * (1 - v));
            const pt = p.getPointAtLength(L * v); walker.current?.setAttribute("cx", String(pt.x)); walker.current?.setAttribute("cy", String(pt.y));
          }, onComplete: () => res() });
          ctrls.push(c);
        });
        finish(t);
      }
      walker.current?.setAttribute("opacity", "0");
    })();
    return () => { stop = true; ctrls.forEach(c => c.stop()); };
  }, [lit?.runKey, tr, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const litSet = new Set(lit?.edgeIds ?? []);
  const sel = (s: Selection) => (e: React.SyntheticEvent) => { e.stopPropagation(); onSelect(s); };
  const key = (s: Selection) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(s); } };

  return (
    <div ref={box} className={styles.wrap} onClick={() => onSelect(null)}>
      <svg className={styles.svg} width={svgW} height={svgH} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="group" aria-label="Map of screens and the trails between them">
        <Contours x={vb.x} y={vb.y} w={vb.w} h={vb.h} />
        {tr.map(t => {
          const traffic = t.e.ok + t.e.fail, failed = t.e.fail > 0 && t.e.fail >= t.e.ok;
          const w = 1.8 + 6 * Math.sqrt(traffic / maxTraffic);
          const selected = selection?.kind === "edge" && selection.id === t.id;
          const dim = lit && !litSet.has(t.id);
          return (
            <g key={t.id} className={styles.trail} data-selected={selected || undefined} data-dim={dim || undefined} role="button" tabIndex={0}
               aria-label={`${t.e.label}, worked ${t.e.ok} times, failed ${t.e.fail}`} onClick={sel({ kind: "edge", id: t.id })} onKeyDown={key({ kind: "edge", id: t.id })}>
              <path d={t.d} className={styles.hit} />
              <path d={t.d} className={failed ? styles.failed : t.e.fail > 0 ? styles.mixed : styles.worn} strokeWidth={w} opacity={0.35 + 0.65 * Math.min(1, traffic / 3)} />
              {selected && <path d={t.d} className={styles.ring} strokeWidth={w + 6} />}
            </g>
          );
        })}
        {tr.map(t => <path key={"l" + t.id} ref={el => { if (el) litRefs.current.set(t.id, el); else litRefs.current.delete(t.id); }} d={t.d} className={styles.lit}
          strokeDasharray="1000" strokeDashoffset="1000" style={{ opacity: 0 }} />)}
        {tr.map(t => {
          const label = short(t.e.name || t.e.label, 18), lw = label.length * 6.6 + 16;
          return (
            <g key={"b" + t.id} className={styles.badge} transform={`translate(${t.mid.x} ${t.mid.y})`} pointerEvents="none">
              <rect x={-lw / 2} y={-11} width={lw} height={22} rx={11} />
              <text textAnchor="middle" dy="0.34em">{label}</text>
            </g>
          );
        })}
        {geo.nodes.map(n => {
          const selected = selection?.kind === "node" && selection.sig === n.sig;
          const goals = goalCount.get(n.sig);
          return (
            <g key={n.sig} transform={`translate(${n.x} ${n.y})`} className={styles.node} data-selected={selected || undefined} data-reached={reached.has(n.sig) || undefined}
               data-pulse={pulse === n.sig || undefined} role="button" tabIndex={0} aria-label={`Screen ${n.title}, ${n.visits} visits`} onClick={sel({ kind: "node", sig: n.sig })} onKeyDown={key({ kind: "node", sig: n.sig })}>
              <title>{n.title} · {n.url}</title>
              <rect width={n.w} height={n.h} rx={10} />
              <text x={14} y={25} className={styles.nodeTitle}>{short(n.title.split(" | ")[0] || "Untitled screen", Math.floor((n.w - 28) / 7.2))}</text>
              <text x={14} y={46} className={styles.nodeUrl}>{short(pathOf(n.url), Math.floor((n.w - 28) / 7.4))}</text>
              {goals ? <g transform={`translate(${n.w - 14} -8)`} className={styles.flag}><path d="M0 0 V22" /><path d="M0 0 L16 6 L0 12 Z" /></g> : null}
            </g>
          );
        })}
        <circle ref={walker} r={7} className={styles.walker} opacity={0} />
      </svg>
      <ul className={styles.legend} aria-label="Legend">
        <li><i className={styles.kWorn} />worn trail, thicker with traffic</li>
        <li><i className={styles.kFailed} />failed trail</li>
        <li><i className={styles.kLit} />planned route</li>
        <li><i className={styles.kFlag} />goal reached here</li>
      </ul>
    </div>
  );
}
