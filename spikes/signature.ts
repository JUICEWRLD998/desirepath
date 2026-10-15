// P0: signature stability (plan §6.1). Loads each URL 3x, compares sigs; checks template/category differences.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("spikes/out", { recursive: true });
import { chromium, type Page } from "playwright";

const ROLES = new Set(["button", "link", "textbox", "combobox", "checkbox", "tab", "heading"]);
export function urlTemplate(u: string): string {
  const x = new URL(u);
  const path = x.pathname.split("/").map(s => /^\d+$/.test(s) || /^[0-9a-f-]{32,36}$/i.test(s) || /^[0-9a-f]{12,}$/i.test(s) || /_\d+$/.test(s) ? ":id" : s).join("/");
  const q = [...x.searchParams.keys()].sort().map(k => `${k}=:v`).join("&");
  return `${x.protocol}//${x.host}${path}${q ? "?" + q : ""}`;
}
const norm = (s: string) => s.toLowerCase().replace(/\d/g, "#").replace(/\s+/g, " ").trim();

export async function observe(page: Page) {
  const snap = await page.locator("body").ariaSnapshot();
  const lm: string[] = [];
  for (const line of snap.split("\n")) {
    const m = line.match(/^\s*- (\w+)(?: "([^"]*)")?/);
    if (!m || !ROLES.has(m[1])) continue;
    lm.push(m[1] === "heading" ? "heading" : `${m[1]}:${norm(m[2] ?? "")}`);
    if (lm.length >= 40) break;
  }
  lm.sort();
  const tpl = urlTemplate(page.url());
  const sig = createHash("sha1").update(tpl + "|" + createHash("sha1").update(lm.join("\n")).digest("hex")).digest("hex").slice(0, 16);
  return { sig, tpl, landmarks: lm.length };
}

const SITES: Record<string, string[]> = {
  books: ["https://books.toscrape.com/", "https://books.toscrape.com/catalogue/category/books/travel_2/index.html",
    "https://books.toscrape.com/catalogue/its-only-the-himalayas_981/index.html", "https://books.toscrape.com/catalogue/full-moon-over-noahs-ark-an-odyssey-to-mount-ararat-and-beyond_811/index.html"],
  quotes: ["https://quotes.toscrape.com/", "https://quotes.toscrape.com/tag/love/", "https://quotes.toscrape.com/author/Albert-Einstein/"],
  openlibrary: ["https://openlibrary.org/", "https://openlibrary.org/works/OL45804W/editions"],
  wikipedia: ["https://en.wikipedia.org/wiki/Desire_path", "https://en.wikipedia.org/wiki/Graph_database"],
};
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
const out: Record<string, unknown> = {};
for (const [site, urls] of Object.entries(SITES)) {
  const res: Record<string, string[]> = {};
  for (const u of urls) {
    res[u] = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext(); const p = await ctx.newPage();
      try { await p.goto(u, { waitUntil: "domcontentloaded", timeout: 30000 }); const o = await observe(p); res[u].push(`${o.sig} (${o.landmarks} lm)`); }
      catch (e) { res[u].push("ERR " + (e as Error).message.slice(0, 80)); }
      await ctx.close(); await new Promise(r => setTimeout(r, 1000)); // <= 1 req/s
    }
  }
  out[site] = res; console.log(site, JSON.stringify(res, null, 1));
}
writeFileSync("spikes/out/signature.json", JSON.stringify(out, null, 2));
await browser.close();
