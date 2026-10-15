import { test } from "node:test";
import assert from "node:assert/strict";
import { actionKey, landmarksFromSnapshot, signature, urlTemplate } from "../signature.ts";

const productA = `- heading "It's Only the Himalayas" [level=1]\n- link "Home":\n  - /url: /\n- button "Add to basket"\n- link "Travel 1"`;
const productB = `- heading "Full Moon over Noah's Ark" [level=1]\n- link "Home":\n  - /url: /\n- button "Add to basket"\n- link "Travel 1"`;
const category = `- heading "Travel" [level=1]\n- link "Home":\n  - /url: /\n- link "next":\n- link "Mystery"`;

test("ids in paths collapse to :id", () => {
  assert.equal(urlTemplate("https://books.toscrape.com/catalogue/its-only-the-himalayas_981/index.html"),
    "https://books.toscrape.com/catalogue/:id/index.html");
  assert.equal(urlTemplate("https://x.com/a/123/b"), "https://x.com/a/:id/b");
  assert.equal(urlTemplate("https://openlibrary.org/works/OL45804W/editions"), "https://openlibrary.org/works/:id/editions");
});

test("query keys are sorted and values replaced", () => {
  assert.equal(urlTemplate("https://x.com/s?q=cat&a=1"), "https://x.com/s?a=:v&q=:v");
});

test("stable: same input, same signature", () => {
  const lm = landmarksFromSnapshot(productA);
  assert.equal(signature("https://x.com/p_1/index.html", lm), signature("https://x.com/p_1/index.html", lm));
});

test("two pages of the same template share a signature", () => {
  assert.equal(
    signature("https://x.com/catalogue/a_981/index.html", landmarksFromSnapshot(productA)),
    signature("https://x.com/catalogue/b_811/index.html", landmarksFromSnapshot(productB)));
});

test("category and product differ", () => {
  assert.notEqual(
    signature("https://x.com/catalogue/a_981/index.html", landmarksFromSnapshot(productA)),
    signature("https://x.com/catalogue/category/travel_2/index.html", landmarksFromSnapshot(category)));
});

test("landmark order does not matter; headings contribute role only", () => {
  assert.deepEqual(landmarksFromSnapshot(productA).filter(l => l === "heading"), ["heading"]);
  assert.equal(signature("https://x.com/", ["link:a", "button:b"]), signature("https://x.com/", ["button:b", "link:a"]));
});

test("action key ignores typed values and digits in names", () => {
  assert.equal(actionKey("click", "link", "Travel 12", 0), "click:link:travel ##:0");
});

const card = (name: string) => `  - listitem:\n    - article:\n      - link "${name}":\n        - /url: /x\n      - button "Add to basket"`;

test("repeated item cards collapse to one generic landmark", () => {
  const a = `- heading "A" [level=1]\n- link "Home":\n- list:\n${card("Libertarianism for Beginners")}\n${card("Mesaerion")}`;
  const b = `- heading "B" [level=1]\n- link "Home":\n- list:\n${card("Scott Pilgrim")}`;
  assert.deepEqual(landmarksFromSnapshot(a), ["heading", "link:home", "link:*", "button:add to basket"]);
  assert.equal(signature("https://x.com/p_1/", landmarksFromSnapshot(a)), signature("https://x.com/p_2/", landmarksFromSnapshot(b)));
});
