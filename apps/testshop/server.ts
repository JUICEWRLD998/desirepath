// Our own test shop (plan §10): ~6 server-rendered pages and a "redesign" switch. No dependencies, no JS in the pages.
// Layout A is the original shop. Layout B is the redesign: the card "Quick add" buttons stop working (the redesign wants
// shoppers to pick options on the product page), every other control and every URL stays the same.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

export type Layout = "a" | "b";
export interface Product { id: number; name: string; price: number; category: number; blurb: string }
export const CATEGORIES = [{ id: 1, name: "Kitchen" }, { id: 2, name: "Gadgets" }];
export const PRODUCTS: Product[] = [
  { id: 1, name: "Trail Mug", price: 12, category: 1, blurb: "Enamel mug that survives a night in a rucksack." },
  { id: 2, name: "Camp Stove", price: 39, category: 1, blurb: "Folds flat, boils a litre in four minutes." },
  { id: 3, name: "Water Bottle", price: 18, category: 1, blurb: "One litre, steel, keeps drinks cold for a day." },
  { id: 4, name: "Pocket Torch", price: 15, category: 2, blurb: "Three modes, runs on one AA battery." },
  { id: 5, name: "Field Radio", price: 54, category: 2, blurb: "Hand-crank radio with a weather band." },
];

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (n: number) => `$${n.toFixed(2)}`;

function page(title: string, body: string, layout: Layout): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} | Trailside</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:46rem;margin:0 auto;padding:1rem}header{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;border-bottom:1px solid #ccc;padding-bottom:.75rem}
header form{margin-left:auto;display:flex;gap:.5rem}ul{list-style:none;padding:0;display:grid;gap:.75rem}article{border:1px solid #ccc;border-radius:.5rem;padding:.75rem}
button,input{font:inherit;padding:.4rem .7rem}button[disabled]{opacity:.5}.note{background:#eef;padding:.5rem .75rem;border-radius:.5rem}</style></head>
<body><header><a href="/">Trailside</a><a href="/cart">Cart</a>
<form action="/search" method="get"><input type="text" name="q" aria-label="Search products" placeholder="Search products"><button type="submit">Search</button></form></header>
<main>${layout === "b" ? `<p class="note">New look: choose your options on the product page, then add to your basket.</p>` : ""}${body}</main></body></html>`;
}

function cards(items: Product[], layout: Layout): string {
  if (!items.length) return "<p>No products found.</p>";
  const quick = layout === "a"
    ? `<button type="submit">Quick add</button>`
    : `<button type="submit" disabled title="Choose your options on the product page">Quick add</button>`;
  return `<ul>${items.map(p => `<li><article><h3><a href="/product/${p.id}">${esc(p.name)}</a></h3><p>${money(p.price)}</p>
<form action="/cart/add" method="post"><input type="hidden" name="id" value="${p.id}">${quick}</form></article></li>`).join("")}</ul>`;
}

function cartIds(req: IncomingMessage): number[] {
  const raw = /(?:^|;\s*)cart=([0-9,]*)/.exec(req.headers.cookie ?? "")?.[1] ?? "";
  return raw.split(",").filter(Boolean).map(Number).filter(id => PRODUCTS.some(p => p.id === id));
}
const lines = (ids: number[]) => ids.map(id => PRODUCTS.find(p => p.id === id)!);

function route(req: IncomingMessage, url: URL, layout: Layout): { status: number; html: string } {
  const path = url.pathname;
  let m: RegExpExecArray | null;
  if (path === "/") {
    return { status: 200, html: page("Home", `<h1>Gear for the long way round</h1><p>Pick a shelf:</p>
<nav><a href="/category/1">Kitchen</a> · <a href="/category/2">Gadgets</a></nav>`, layout) };
  }
  if ((m = /^\/category\/(\d+)$/.exec(path))) {
    const c = CATEGORIES.find(c => c.id === Number(m![1]));
    if (!c) return { status: 404, html: page("Not found", "<h1>No such shelf</h1>", layout) };
    return { status: 200, html: page(c.name, `<h1>${esc(c.name)}</h1>${cards(PRODUCTS.filter(p => p.category === c.id), layout)}`, layout) };
  }
  if ((m = /^\/product\/(\d+)$/.exec(path))) {
    const p = PRODUCTS.find(p => p.id === Number(m![1]));
    if (!p) return { status: 404, html: page("Not found", "<h1>No such product</h1>", layout) };
    return { status: 200, html: page(p.name, `<h1>${esc(p.name)}</h1><p>${esc(p.blurb)}</p><p>${money(p.price)}</p>
<form action="/cart/add" method="post"><input type="hidden" name="id" value="${p.id}"><button type="submit">Add to basket</button></form>`, layout) };
  }
  if (path === "/search") {
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const hits = q ? PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || p.blurb.toLowerCase().includes(q)) : [];
    return { status: 200, html: page("Search", `<h1>Search results</h1>${cards(hits, layout)}`, layout) };
  }
  if (path === "/cart") {
    const items = lines(cartIds(req));
    const body = items.length
      ? `<h1>Your cart</h1><ul>${items.map(p => `<li>${esc(p.name)} (${money(p.price)})</li>`).join("")}</ul>
<p>Total: ${money(items.reduce((s, p) => s + p.price, 0))}</p><a href="/checkout">Checkout</a>`
      : `<h1>Your cart</h1><p>Your cart is empty.</p>`;
    return { status: 200, html: page("Cart", body, layout) };
  }
  if (path === "/checkout") {
    const items = lines(cartIds(req));
    const body = items.length
      ? `<h1>Checkout</h1><p>Order summary</p><ul>${items.map(p => `<li>${esc(p.name)} (${money(p.price)})</li>`).join("")}</ul>
<p>Total: ${money(items.reduce((s, p) => s + p.price, 0))}</p><p>This is a test shop. No payment is taken.</p>`
      : `<h1>Checkout</h1><p>Nothing to check out. Your cart is empty.</p>`;
    return { status: 200, html: page("Checkout", body, layout) };
  }
  return { status: 404, html: page("Not found", "<h1>Page not found</h1>", layout) };
}

export interface Shop { url: string; layout: () => Layout; setLayout: (l: Layout) => void; close: () => Promise<void> }

export function startShop(opts: { port?: number; layout?: Layout } = {}): Promise<Shop> {
  let layout: Layout = opts.layout ?? "a";
  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://shop.local");
    // The redesign switch. Local test shop only; it is not part of the shop's pages.
    if (url.pathname === "/_layout") {
      const set = url.searchParams.get("set");
      if (set === "a" || set === "b") layout = set;
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ layout }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/cart/add") {
      let body = ""; for await (const chunk of req) body += chunk;
      const id = Number(new URLSearchParams(body).get("id"));
      const ids = cartIds(req);
      if (PRODUCTS.some(p => p.id === id)) ids.push(id);
      res.writeHead(303, { location: "/cart", "set-cookie": `cart=${ids.join(",")}; Path=/; SameSite=Lax` }).end();
      return;
    }
    const r = route(req, url, layout);
    res.writeHead(r.status, { "content-type": "text/html; charset=utf-8" }).end(r.html);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port ?? 0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port;
      resolve({ url: `http://127.0.0.1:${port}`, layout: () => layout, setLayout: l => { layout = l; },
        close: () => new Promise(r => { server.closeAllConnections(); server.close(() => r()); }) });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 4100);
  const shop = await startShop({ port, layout: process.env.LAYOUT === "b" ? "b" : "a" });
  console.log(`testshop on ${shop.url}  (flip the redesign: ${shop.url}/_layout?set=b)`);
}
