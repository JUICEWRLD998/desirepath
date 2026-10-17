// Palette measurements for apps/web/styles/tokens.css, computed from the OKLCH tokens themselves.
// Contrast = WCAG ratio (text on its background). Difference between role hues = CIE76 delta E in Lab (not the ratio).
// Chroma = OKLCH C. Controls: black on white must give 21:1, and identical colours must give delta E 0.
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../apps/web/styles/tokens.css", import.meta.url), "utf8");

function block(selectorStart) {
  const i = css.indexOf(selectorStart); const j = css.indexOf("}", i);
  return Object.fromEntries([...css.slice(i, j).matchAll(/--([a-z0-9-]+):\s*oklch\(([^)]+)\)/g)].map(m => {
    const [l, c, h, , a] = m[2].replace("/", " ").split(/\s+/).map(Number); return [m[1], { l, c, h, a: a ?? 1 }];
  }));
}
const light = block(":root {"), dark = block(":root[data-theme=\"dark\"]");

const toLinear = ({ l, c, h }) => {
  const a = c * Math.cos(h * Math.PI / 180), b = c * Math.sin(h * Math.PI / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3, M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3, S = (l - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S, -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S].map(v => Math.min(1, Math.max(0, v)));
};
const lum = o => { const [r, g, b] = toLinear(o); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const lab = o => {
  const [r, g, b] = toLinear(o);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const dE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
const mix = (fg, bg) => ({ ...fg, l: fg.l * fg.a + bg.l * (1 - fg.a) });

// controls: a blind instrument would pass these silently
const W = { l: 1, c: 0, h: 0, a: 1 }, K = { l: 0, c: 0, h: 0, a: 1 };
const ctl = { blackOnWhite: ratio(K, W), sameColour: dE(W, W) };
if (Math.abs(ctl.blackOnWhite - 21) > 0.05 || ctl.sameColour > 0.001) { console.error("CONTROL FAILED", ctl); process.exit(2); }

let failed = 0;
for (const [name, t] of [["light", light], ["dark", dark]]) {
  console.log(`\n== ${name} ==`);
  const pairs = [["ink", "ground"], ["ink", "surface"], ["ink-muted", "ground"], ["ink-muted", "surface"], ["ink-muted", "surface-2"], ["accent-ink", "accent"],
    ["accent", "surface"], ["accent", "ground"], ["worn", "surface"], ["clay", "ground"], ["clay", "surface"], ["cold", "surface"], ["cold", "ground"], ["ink", "accent-soft"]];
  for (const [f, b] of pairs) {
    const r = ratio(t[f], t[b]); const need = ["accent", "worn", "cold", "clay"].includes(f) ? 3 : 4.5; const ok = r >= need; if (!ok) failed++;
    console.log(`${ok ? "pass" : "FAIL"}  text ${f} on ${b}: ${r.toFixed(2)}:1 (need ${need})`);
  }
  const roles = ["accent", "worn", "clay", "cold"];
  for (let i = 0; i < roles.length; i++) for (let j = i + 1; j < roles.length; j++) {
    const d = dE(t[roles[i]], t[roles[j]]); const ok = d >= 20; if (!ok) failed++;
    console.log(`${ok ? "pass" : "FAIL"}  role hues ${roles[i]} vs ${roles[j]}: dE76 ${d.toFixed(1)} (need 20)`);
  }
  for (const s of ["ground", "surface", "surface-2"]) console.log(`      surface chroma ${s}: ${t[s].c} (target 0.008 to 0.03); accent chroma ${t.accent.c} = ${(t.accent.c / t[s].c).toFixed(1)}x`);
}
console.log(`\ncontrols ok: black/white ${ctl.blackOnWhite.toFixed(2)}:1, same colour dE ${ctl.sameColour.toFixed(3)}`);
console.log(failed ? `${failed} measurement(s) below threshold` : "all measured pairs meet their thresholds");
process.exit(failed ? 1 : 0);
