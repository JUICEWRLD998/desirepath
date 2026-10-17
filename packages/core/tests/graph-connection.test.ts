import { test } from "node:test";
import assert from "node:assert/strict";
import { connectionOptions, graphName } from "../graph.ts";

test("connection options accept a URL when split-host settings are empty", () => {
  assert.deepEqual(connectionOptions({ FALKORDB_URL: "falkor://db.example:6379" }), {
    url: "falkor://db.example:6379",
  });
  assert.deepEqual(connectionOptions({ FALKORDB_URL: "falkor://db.example:6379", FALKORDB_HOST: "" }), {
    url: "falkor://db.example:6379",
  });
});

test("connection options accept split-host settings when the URL is empty", () => {
  assert.deepEqual(
    connectionOptions({
      FALKORDB_HOST: "db.example",
      FALKORDB_PORT: "6380",
      FALKORDB_USERNAME: "default",
      FALKORDB_PASSWORD: "secret",
      FALKORDB_TLS: "true",
      FALKORDB_URL: "",
    }),
    {
      username: "default",
      password: "secret",
      socket: { host: "db.example", port: 6380, tls: true },
    },
  );
});

test("connection options reject conflicting or missing endpoint settings", () => {
  assert.throws(() => connectionOptions({
    FALKORDB_URL: "falkor://db.example:6379",
    FALKORDB_HOST: "db.example",
  }), /Set either FALKORDB_URL or FALKORDB_HOST, not both/);
  assert.throws(() => connectionOptions({}), /Set FALKORDB_URL or FALKORDB_HOST/);
});

test("graph names reject characters that could escape the namespace", () => {
  assert.throws(() => graphName("a b"));
  assert.throws(() => graphName("x", "a:b"));
  assert.throws(() => graphName("x", "t/../y"));
});
