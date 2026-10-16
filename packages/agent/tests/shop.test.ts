// Real Chromium against the real test shop (no database, no LLM). Needs `npx playwright install chromium`.
// This is the testshop leg of the Phase 0 signature stability test (plan §6.1).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright";
import { startShop, type Shop } from "../../../apps/testshop/server.ts";
import { observe, candidatesFromSnapshot } from "../observe.ts";
import { execute } from "../execute.ts";
import { goalMet, type Task } from "../task.ts";

let shop: Shop, browser: Browser;
before(async () => { shop = await startShop(); browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH }); });
after(async () => { await browser?.close(); await shop?.close(); });

const sigOf = async (path: string) => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  try { await page.goto(shop.url + path, { waitUntil: "load" }); return (await observe(page)).screen.sig; }
  finally { await ctx.close(); }
};
const open = async (path: string): Promise<{ page: Page; close: () => Promise<void> }> => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(shop.url + path, { waitUntil: "load" });
  return { page, close: () => ctx.close().then(() => undefined) };
};

test("every shop page has the same signature on three loads", async () => {
  for (const path of ["/", "/category/1", "/product/1", "/search?q=mug", "/cart", "/checkout"]) {
    const sigs = [await sigOf(path), await sigOf(path), await sigOf(path)];
    assert.equal(new Set(sigs).size, 1, `${path}: ${sigs}`);
  }
});

test("pages of one template share a signature; different templates differ", async () => {
  assert.equal(await sigOf("/category/1"), await sigOf("/category/2"));
  assert.equal(await sigOf("/product/1"), await sigOf("/product/4"));
  const all = new Set([await sigOf("/"), await sigOf("/category/1"), await sigOf("/product/1"), await sigOf("/cart"), await sigOf("/checkout")]);
  assert.equal(all.size, 5);
});

test("the redesign (layout B) changes no signature: it breaks an action, not a screen", async () => {
  const a = [await sigOf("/"), await sigOf("/category/1"), await sigOf("/product/1")];
  shop.setLayout("b");
  try { assert.deepEqual([await sigOf("/"), await sigOf("/category/1"), await sigOf("/product/1")], a); }
  finally { shop.setLayout("a"); }
});

test("candidates give the third 'Quick add' nth 2, and match what getByRole finds", async () => {
  const { page, close } = await open("/category/1");
  try {
    const obs = await observe(page);
    const quick = obs.candidates.filter(c => c.name === "Quick add");
    assert.deepEqual(quick.map(c => c.nth), [0, 1, 2]);
    assert.equal(await page.getByRole("button", { name: "Quick add", exact: true }).count(), 3);
    assert.ok(obs.candidates.some(c => c.role === "textbox" && c.name === "Search products" && c.kind === "type"));
  } finally { await close(); }
});

test("quick add puts the right product in the cart; checkout shows it; goalMet agrees only for the right product", async () => {
  const { page, close } = await open("/category/1");
  const task = (product: string): Task => ({ id: "t", site: "testshop", baseUrl: shop.url, start: "/", text: "x", slots: { product },
    goal: { path: "/checkout", textIncludes: ["{product}"] } });
  try {
    assert.equal((await execute(page, { kind: "click", role: "button", name: "Quick add", nth: 0 }, {})).ok, true);
    assert.match(page.url(), /\/cart$/);
    assert.equal((await execute(page, { kind: "click", role: "link", name: "Checkout", nth: 0 }, {})).ok, true);
    const obs = await observe(page);
    assert.equal(goalMet(task("Trail Mug"), obs), true);
    assert.equal(goalMet(task("Camp Stove"), obs), false);
  } finally { await close(); }
});

test("in layout B quick add fails (disabled) while the product page route still works", async () => {
  shop.setLayout("b");
  const { page, close } = await open("/category/1");
  try {
    const t = Date.now();
    const quick = await execute(page, { kind: "click", role: "button", name: "Quick add", nth: 0 }, {}, 800);
    assert.equal(quick.ok, false);
    assert.ok(Date.now() - t >= 700, "waited for the button to become enabled");
    assert.match(page.url(), /\/category\/1$/);
    assert.equal((await execute(page, { kind: "click", role: "link", name: "Trail Mug", nth: 0 }, {})).ok, true);
    assert.equal((await execute(page, { kind: "click", role: "button", name: "Add to basket", nth: 0 }, {})).ok, true);
    assert.match(page.url(), /\/cart$/);
  } finally { shop.setLayout("a"); await close(); }
});

test("typing needs a slot value, and a missing one fails without touching the page", async () => {
  const { page, close } = await open("/");
  try {
    assert.equal((await execute(page, { kind: "type", role: "textbox", name: "Search products", nth: 0, slot: "query" }, {})).ok, false);
    assert.equal((await execute(page, { kind: "type", role: "textbox", name: "Search products", nth: 0, slot: "query" }, { query: "mug" })).ok, true);
    assert.equal(await page.getByRole("textbox", { name: "Search products" }).inputValue(), "mug");
  } finally { await close(); }
});

test("candidatesFromSnapshot counts nth per role and name, unescapes quoted names, skips unnamed controls", () => {
  const snap = [
    '- link "A"', '- link "A"', '- button "A"', "- 'button \"Say: hi\"'", '- textbox', '- link "x \\"q\\" y"', "- heading \"H\"",
  ].join("\n");
  assert.deepEqual(candidatesFromSnapshot(snap).map(c => [c.role, c.name, c.nth]),
    [["link", "A", 0], ["link", "A", 1], ["button", "A", 0], ["button", "Say: hi", 0], ["link", 'x "q" y', 0]]);
});
