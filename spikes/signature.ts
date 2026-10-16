// P0: signature stability (plan §6.1). Loads each URL 3x using the core signature implementation.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
mkdirSync("spikes/out", { recursive: true });
import { chromium, type Page } from "playwright";
import { landmarksFromSnapshot, signature, urlTemplate } from "../packages/core/signature.ts";

async function observe(page: Page) {
  const snap = await page.locator("body").ariaSnapshot();
  const lm = landmarksFromSnapshot(snap);
  const tpl = urlTemplate(page.url());
  return { sig: signature(page.url(), lm), tpl, landmarks: lm.length };
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
const only = process.env.ONLY?.split(",");
for (const [site, urls] of Object.entries(SITES)) {
  if (only && !only.includes(site)) continue;
  const res: Record<string, string[]> = {};
  for (const u of urls) {
    res[u] = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext(); const p = await ctx.newPage();
      try { await p.goto(u, { waitUntil: "domcontentloaded", timeout: Number(process.env.GOTO_TIMEOUT || 30000) }); const o = await observe(p); res[u].push(o.sig); }
      catch (e) { res[u].push("ERR " + (e as Error).message.slice(0, 80)); }
      await ctx.close(); await new Promise(r => setTimeout(r, 1000)); // <= 1 req/s
    }
  }
  const loaded = (values: string[]) => values.length === 3 && values.every(v => !v.startsWith("ERR"));
  const stable = Object.values(res).every(values => loaded(values) && new Set(values).size === 1);
  const books = site === "books";
  const productPagesMatch = !books || res[urls[2]]?.[0] === res[urls[3]]?.[0];
  const categoryDiffers = !books || res[urls[1]]?.[0] !== res[urls[2]]?.[0];
  out[site] = { stable, productPagesMatch, categoryDiffers, urls: res };
  console.log(site, JSON.stringify(out[site], null, 1));
}
const file = "spikes/out/signature.json";
const prev = only && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
writeFileSync(file, JSON.stringify({ ...prev, ...out }, null, 2));
await browser.close();
