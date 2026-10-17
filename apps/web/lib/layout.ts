import type { EdgeRow, NodeRow } from "./types";

export interface Placed extends NodeRow { x: number; y: number; w: number; h: number; depth: number }
export interface Geometry { nodes: Placed[]; width: number; height: number; vertical: boolean }

export const NODE_W = 188, NODE_H = 62;

/** Layered layout: depth = hops from the entry screen (the earliest one). Left to right, or top to bottom on narrow containers. */
export function layout(nodes: NodeRow[], edges: EdgeRow[], containerW: number): Geometry {
  const vertical = containerW < 640;
  const root = nodes[0];
  const depth = new Map<string, number>();
  if (root) {
    depth.set(root.sig, 0);
    const q = [root.sig];
    while (q.length) {
      const s = q.shift()!;
      for (const e of edges) if (e.from === s && !depth.has(e.to)) { depth.set(e.to, depth.get(s)! + 1); q.push(e.to); }
    }
  }
  const max = Math.max(0, ...depth.values());
  for (const n of nodes) if (!depth.has(n.sig)) depth.set(n.sig, max + 1);
  const layers = new Map<number, NodeRow[]>();
  for (const n of nodes) { const d = depth.get(n.sig)!; (layers.get(d) ?? layers.set(d, []).get(d)!).push(n); }
  const nLayers = layers.size, widest = Math.max(1, ...[...layers.values()].map(l => l.length));
  const nw = vertical ? Math.min(NODE_W, Math.max(150, containerW - 64)) : NODE_W;
  const gapMain = vertical ? 120 : 150, gapCross = vertical ? 36 : 44, pad = 64;
  const placed: Placed[] = [];
  const crossSize = widest * (vertical ? nw : NODE_H) + (widest - 1) * gapCross;
  [...layers.keys()].sort((a, b) => a - b).forEach((d, li) => {
    const row = layers.get(d)!;
    row.forEach((n, i) => {
      const size = row.length * (vertical ? nw : NODE_H) + (row.length - 1) * gapCross;
      const off = (crossSize - size) / 2 + i * ((vertical ? nw : NODE_H) + gapCross);
      placed.push(vertical
        ? { ...n, depth: d, w: nw, h: NODE_H, x: pad + off, y: pad + li * (NODE_H + gapMain) }
        : { ...n, depth: d, w: nw, h: NODE_H, x: pad + li * (nw + gapMain), y: pad + off });
    });
  });
  const width = vertical ? Math.max(containerW, crossSize + pad * 2) : pad * 2 + nLayers * nw + (nLayers - 1) * gapMain;
  const height = vertical ? pad * 2 + nLayers * NODE_H + (nLayers - 1) * gapMain : Math.max(360, pad * 2 + crossSize);
  return { nodes: placed, width, height, vertical };
}

export interface Trail { id: string; e: EdgeRow; d: string; mid: { x: number; y: number }; self: boolean }

const clip = (n: Placed, tx: number, ty: number) => {
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2, dx = tx - cx, dy = ty - cy;
  const k = 1 / Math.max(Math.abs(dx) / (n.w / 2 + 3), Math.abs(dy) / (n.h / 2 + 3), 1e-6);
  return { x: cx + dx * k, y: cy + dy * k };
};

/** One quadratic curve per edge; edges between the same pair fan out so none hides another. */
export function trails(g: Geometry, edges: EdgeRow[]): Trail[] {
  const byId = new Map(g.nodes.map(n => [n.sig, n]));
  const pairKey = (e: EdgeRow) => (e.from < e.to ? `${e.from}${e.to}` : `${e.to}${e.from}`);
  const groups = new Map<string, EdgeRow[]>();
  for (const e of edges) (groups.get(pairKey(e)) ?? groups.set(pairKey(e), []).get(pairKey(e))!).push(e);
  const out: Trail[] = [];
  for (const e of edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) continue;
    const id = `${e.from}|${e.key}`;
    if (a === b) {
      const x = a.x + a.w - 26, y = a.y;
      out.push({ id, e, self: true, d: `M ${x} ${y} C ${x + 6} ${y - 52}, ${x + 62} ${y - 52}, ${x + 50} ${y + 10}`, mid: { x: x + 34, y: y - 40 } });
      continue;
    }
    const grp = groups.get(pairKey(e))!, i = grp.indexOf(e);
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const len = Math.hypot(bx - ax, by - ay) || 1, px = -(by - ay) / len, py = (bx - ax) / len;
    const sign = e.from < e.to ? 1 : -1;
    const off = (i - (grp.length - 1) / 2) * 34 * sign + (grp.length === 1 && edges.some(o => o.from === e.to && o.to === e.from) ? 26 * sign : 0);
    const cx = (ax + bx) / 2 + px * off * 2, cy = (ay + by) / 2 + py * off * 2;
    const p0 = clip(a, cx, cy), p1 = clip(b, cx, cy);
    // Labels of parallel trails sit at different points along their curves so the pills do not stack on each other.
    const t = 0.5 + (i - (grp.length - 1) / 2) * 0.2 * sign, u = 1 - t;
    out.push({ id, e, self: false, d: `M ${p0.x} ${p0.y} Q ${cx} ${cy} ${p1.x} ${p1.y}`, mid: { x: u * u * p0.x + 2 * u * t * cx + t * t * p1.x, y: u * u * p0.y + 2 * u * t * cy + t * t * p1.y } });
  }
  return out;
}
