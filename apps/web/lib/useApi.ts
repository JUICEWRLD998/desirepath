"use client";
import { useEffect, useState } from "react";

export type Api<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: T };

/** GET json. `url` null means "not ready". Re-runs when the url changes; a stale answer never overwrites a newer one. */
export function useApi<T>(url: string | null): Api<T> {
  const [state, set] = useState<Api<T>>({ status: "loading" });
  useEffect(() => {
    if (!url) return;
    let live = true;
    set({ status: "loading" });
    fetch(url).then(async r => {
      const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      if (!live) return;
      set(r.ok ? { status: "ok", data: j as T } : { status: "error", message: j.error ?? `HTTP ${r.status}` });
    }).catch(e => live && set({ status: "error", message: String(e?.message ?? e) }));
    return () => { live = false; };
  }, [url]);
  return state;
}
