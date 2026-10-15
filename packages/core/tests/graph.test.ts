import { test } from "node:test";
import assert from "node:assert/strict";
import { falkorOptions, graphName, planGraphNames } from "../graph.ts";

test("public and tenant graphs are isolated and tenant planning falls back to public", () => {
  const publicGraph = graphName({ site: "books.toscrape.com" });
  const tenantGraph = graphName({ site: "books.toscrape.com", tenant: "acme" });

  assert.equal(publicGraph, "public:books.toscrape.com");
  assert.equal(tenantGraph, "tenant:acme:books.toscrape.com");
  assert.notEqual(publicGraph, tenantGraph);
  assert.deepEqual(planGraphNames({ site: "books.toscrape.com", tenant: "acme" }), [
    tenantGraph,
    publicGraph,
  ]);
  assert.deepEqual(planGraphNames({ site: "books.toscrape.com" }), [publicGraph]);
});

test("graph scope parts reject graph-name delimiters", () => {
  assert.throws(() => graphName({ site: "public:other" }), /site must start/);
  assert.throws(() => graphName({ site: "books", tenant: "acme:other" }), /tenant must start/);
});

test("FalkorDB connection options support URL and split credentials", () => {
  assert.deepEqual(falkorOptions({ FALKORDB_URL: "falkor://localhost:6379" }), {
    url: "falkor://localhost:6379",
  });
  assert.deepEqual(
    falkorOptions({
      FALKORDB_HOST: "localhost",
      FALKORDB_PORT: "6380",
      FALKORDB_USERNAME: "default",
      FALKORDB_PASSWORD: "secret",
      FALKORDB_TLS: "true",
    }),
    {
      username: "default",
      password: "secret",
      socket: { host: "localhost", port: 6380, tls: true },
    },
  );
});

test("FalkorDB connection options reject missing or malformed configuration", () => {
  assert.throws(() => falkorOptions({}), /Set FALKORDB_URL or FALKORDB_HOST/);
  assert.throws(() => falkorOptions({ FALKORDB_HOST: "localhost", FALKORDB_PORT: "bad" }), /FALKORDB_PORT/);
  assert.throws(() => falkorOptions({ FALKORDB_HOST: "localhost", FALKORDB_TLS: "yes" }), /FALKORDB_TLS/);
});
