import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchRobots, parseRobots } from "../robots.ts";

const txt = `
User-agent: BadBot
Disallow: /

# comment
User-agent: *
Disallow: /w/
Disallow: /wiki/Special:
Disallow: /*?action=edit
Allow: /w/load.php
Disallow: /private$
`;

test("longest rule wins, Allow wins ties, wildcards and $ work", () => {
  const r = parseRobots(txt);
  assert.equal(r.allows("https://x.org/wiki/Desire_path"), true);
  assert.equal(r.allows("https://x.org/w/index.php"), false);
  assert.equal(r.allows("https://x.org/w/load.php?a=1"), true);
  assert.equal(r.allows("https://x.org/wiki/Special:Search"), false);
  assert.equal(r.allows("https://x.org/wiki/Foo?action=edit"), false);
  assert.equal(r.allows("https://x.org/private"), false);
  assert.equal(r.allows("https://x.org/private/page"), true);
});

test("a group that names us beats *; a group that names someone else does not apply", () => {
  assert.equal(parseRobots(txt).allows("https://x.org/anything"), true);           // BadBot's Disallow: / is not ours
  assert.equal(parseRobots(txt, "BadBot/1.0").allows("https://x.org/anything"), false);
  assert.equal(parseRobots("User-agent: desirepath\nDisallow: /a\n\nUser-agent: *\nDisallow: /b").allows("https://x.org/b"), true);
});

test("planted control: an empty Disallow and no robots rules allow everything; a blanket Disallow blocks", () => {
  assert.equal(parseRobots("User-agent: *\nDisallow:").allows("https://x.org/a"), true);
  assert.equal(parseRobots("").allows("https://x.org/a"), true);
  assert.equal(parseRobots("User-agent: *\nDisallow: /").allows("https://x.org/a"), false);
});

test("fetchRobots: 404 allows all, 200 parses, 5xx throws", async () => {
  const reply = (status: number, body = "") => (async () => new Response(body, { status })) as unknown as typeof fetch;
  assert.equal((await fetchRobots("https://x.org", reply(404))).allows("https://x.org/a"), true);
  assert.equal((await fetchRobots("https://x.org", reply(200, "User-agent: *\nDisallow: /a"))).allows("https://x.org/a"), false);
  await assert.rejects(fetchRobots("https://x.org", reply(503)));
});
