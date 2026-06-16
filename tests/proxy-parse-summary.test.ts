import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSummary } from "../src/gateway/proxy.js";

test("parseSummary returns an empty object for blank/whitespace lines", () => {
  assert.deepEqual(parseSummary(""), {});
  assert.deepEqual(parseSummary("   \n  "), {});
});

test("parseSummary returns raw for a JSON primitive", () => {
  assert.deepEqual(parseSummary("42"), { raw: "42" });
  assert.deepEqual(parseSummary('"a string"'), { raw: '"a string"' });
  assert.deepEqual(parseSummary("null"), { raw: "null" });
});

test("parseSummary returns raw for malformed JSON", () => {
  assert.match((parseSummary("{ broken").raw ?? ""), /broken/);
});

test("parseSummary handles a request with a string id", () => {
  const s = parseSummary(JSON.stringify({ jsonrpc: "2.0", id: "req-1", method: "ping" }));
  assert.equal(s.id, "req-1");
  assert.equal(s.method, "ping");
});

test("parseSummary handles a notification (no id) with params", () => {
  const s = parseSummary(JSON.stringify({ jsonrpc: "2.0", method: "notify", params: { a: 1, b: 2 } }));
  assert.equal(s.id, undefined);
  assert.deepEqual(s.paramKeys, ["a", "b"]);
});

test("parseSummary marks an error-only response", () => {
  const s = parseSummary(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -1, message: "boom" } }));
  assert.equal(s.isResponse, true);
  assert.equal(s.isError, true);
});

test("parseSummary handles a null id (per JSON-RPC notification responses)", () => {
  const s = parseSummary(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -1 } }));
  assert.equal(s.id, null);
  assert.equal(s.isError, true);
});

test("parseSummary skips id when type is unusual (e.g. boolean)", () => {
  const s = parseSummary(JSON.stringify({ jsonrpc: "2.0", id: true, method: "x" }));
  assert.equal(s.id, undefined, "non-string/number/null id should be ignored");
});

test("parseSummary leaves paramKeys undefined when params is an array", () => {
  const s = parseSummary(JSON.stringify({ jsonrpc: "2.0", method: "x", params: [1, 2, 3] }));
  assert.equal(s.paramKeys, undefined);
});

test("parseSummary truncates very long raw lines", () => {
  const long = "{" + "x".repeat(500);
  const s = parseSummary(long);
  assert.ok(s.raw !== undefined && s.raw.length <= 200, "raw should be capped at 200 chars");
});
