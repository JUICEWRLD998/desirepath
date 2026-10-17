"use client";
import { useEffect, useMemo, useState } from "react";
import { useApi } from "../lib/useApi";
import type { MapData, SiteRow } from "../lib/types";
import { Detail } from "./Detail";
import { MapView, type Lit, type Selection } from "./MapView";
import { Meter } from "./Meter";
import { PlanPanel } from "./PlanPanel";
import { Runs } from "./Runs";
import styles from "./Dashboard.module.css";

type Tab = "map" | "meter" | "runs";
const TABS: Array<{ id: Tab; label: string }> = [{ id: "map", label: "Map" }, { id: "meter", label: "Cold vs map" }, { id: "runs", label: "Runs" }];

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    let t: string | null = null;
    try { t = localStorage.getItem("dp-theme"); } catch { /* storage blocked: follow the system */ }
    const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(dark ? "dark" : "light");
  }, []);
  useEffect(() => { if (theme) document.documentElement.dataset.theme = theme; }, [theme]);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button className={styles.ghost} type="button" aria-label={`Switch to ${next} theme`} onClick={() => { setTheme(next); try { localStorage.setItem("dp-theme", next); } catch { /* ignore */ } }}>
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}

export function Dashboard() {
  const sites = useApi<{ sites: SiteRow[] }>("/api/sites");
  const [site, setSite] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("map");
  const [selection, setSelection] = useState<Selection>(null);
  const [lit, setLit] = useState<Lit | null>(null);

  useEffect(() => { if (sites.status === "ok" && !site && sites.data.sites.length) setSite(sites.data.sites[0].site); }, [sites, site]);
  const map = useApi<MapData>(site ? `/api/map?site=${encodeURIComponent(site)}` : null);
  const row = sites.status === "ok" ? sites.data.sites.find(s => s.site === site) : undefined;
  useEffect(() => { setSelection(null); setLit(null); }, [site]);

  const body = useMemo(() => {
    if (sites.status === "loading") return <p className={styles.state} role="status">Reading the graph…</p>;
    if (sites.status === "error") return <div className={styles.state} role="alert"><h2>The graph is not reachable</h2><p>{sites.message}</p><p>Check FALKORDB_* in <code>.env</code> and that the instance is running.</p></div>;
    if (!sites.data.sites.length) return <div className={styles.state}><h2>No site has been mapped yet</h2><p>Run <code>npm run p2</code> or <code>npm run p3</code> to walk a site and write its first trails.</p></div>;
    if (!site) return null;
    if (tab === "meter") return <Meter site={site} />;
    if (tab === "runs") return <Runs site={site} />;
    if (map.status === "loading") return <p className={styles.state} role="status">Loading the map of {site}…</p>;
    if (map.status === "error") return <div className={styles.state} role="alert"><h2>Could not load this map</h2><p>{map.message}</p></div>;
    if (!map.data.nodes.length) return <div className={styles.state}><h2>This map has no screens yet</h2><p>No agent has reported a step on {site}.</p></div>;
    return (
      <div className={styles.mapGrid}>
        <div className={styles.mapCol}><MapView data={map.data} selection={selection} onSelect={setSelection} lit={lit} /></div>
        <aside className={styles.side} aria-label="Plan and details">
          {selection && <Detail site={site} map={map.data} selection={selection} />}
          <PlanPanel site={site} map={map.data} onLit={setLit} />
          {!selection && <Detail site={site} map={map.data} selection={selection} />}
        </aside>
      </div>
    );
  }, [sites, site, tab, map, selection, lit]);

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M3 21 C 8 21, 8 6, 13 6 S 18 21, 23 21" fill="none" stroke="var(--worn)" strokeWidth="3.2" strokeLinecap="round" /><circle cx="13" cy="6" r="3" fill="var(--accent)" /></svg>
          <h1>desirepath</h1>
        </div>
        <label className={styles.siteSel}>
          <span className={styles.sr}>Site</span>
          <select value={site ?? ""} onChange={e => setSite(e.target.value)} disabled={sites.status !== "ok" || !sites.data.sites.length}>
            {sites.status === "ok" ? sites.data.sites.map(s => <option key={s.site} value={s.site}>{s.site}</option>) : <option>Loading…</option>}
          </select>
        </label>
        <nav className={styles.tabs} aria-label="Views">
          {TABS.map(t => <button key={t.id} type="button" className={styles.tab} aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </nav>
        <ThemeToggle />
      </header>
            <main className={styles.main}>
        {row && (
                <dl className={styles.counts} aria-label={`Totals for ${row.site}`}>
                  <div><dt>screens</dt><dd className="num">{row.states}</dd></div>
                  <div><dt>trails</dt><dd className="num">{row.edges}</dd></div>
                  <div><dt>goals</dt><dd className="num">{row.goals}</dd></div>
                  <div><dt>runs</dt><dd className="num">{row.runs}</dd></div>
                </dl>
              )}
        {body}
      </main>
    </div>
  );
}
