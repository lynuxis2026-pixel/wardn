import { test } from "node:test";
import assert from "node:assert/strict";
import { decideOutgoing, pathInsideAny } from "../src/sandbox/enforce.js";
import { compareToken, extractBearer, requiresAuth, isLoopbackIp } from "../src/gateway/auth.js";
import type { ServerPolicy } from "../src/sandbox/types.js";

const basePolicy: ServerPolicy = {
  name: "x",
  enabled: true,
  filesystem: { paths: ["/safe"] },
  network: false,
  envWhitelist: [],
};

// ===== decideOutgoing branches =====

test("decideOutgoing passes through when policy is disabled", () => {
  const d = decideOutgoing(
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "read", arguments: { path: "/etc/shadow" } } }),
    { ...basePolicy, enabled: false },
  );
  assert.equal(d.allow, true);
});

test("decideOutgoing passes through on an empty line", () => {
  const d = decideOutgoing("   \n  ", basePolicy);
  assert.equal(d.allow, true);
});

test("decideOutgoing passes through on malformed JSON", () => {
  const d = decideOutgoing("{ not json at all", basePolicy);
  assert.equal(d.allow, true);
});

test("decideOutgoing passes through when params is missing", () => {
  const d = decideOutgoing(JSON.stringify({ jsonrpc: "2.0", method: "tools/call" }), basePolicy);
  assert.equal(d.allow, true);
});

test("decideOutgoing reads file:// URLs as paths", () => {
  const d = decideOutgoing(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "read_file", arguments: { path: "file:///etc/shadow" } },
    }),
    basePolicy,
  );
  assert.ok(d.reject, "file:// URLs must be inspected like regular paths");
});

test("decideOutgoing walks an array of paths", () => {
  const d = decideOutgoing(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "read_many", arguments: { paths: ["/safe/inside.txt", "/etc/shadow"] } },
    }),
    basePolicy,
  );
  assert.ok(d.reject);
});

test("decideOutgoing inspects nested objects for paths", () => {
  const d = decideOutgoing(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "complex", arguments: { spec: { source: "/etc/shadow" } } },
    }),
    basePolicy,
  );
  assert.ok(d.reject);
});

test("pathInsideAny returns false when the policy has no paths", () => {
  assert.equal(pathInsideAny("/etc/shadow", []), false);
});

// ===== auth branches =====

test("compareToken returns false on length mismatch", () => {
  assert.equal(compareToken("short", "much-longer-token"), false);
});

test("compareToken returns true on equal strings", () => {
  assert.equal(compareToken("same-token", "same-token"), true);
});

test("compareToken returns false on differing same-length strings", () => {
  assert.equal(compareToken("abcdefghij", "0123456789"), false);
});

test("extractBearer returns undefined for missing header", () => {
  assert.equal(extractBearer(undefined), undefined);
});

test("extractBearer returns undefined for non-bearer header", () => {
  assert.equal(extractBearer("Basic abc"), undefined);
});

test("extractBearer extracts the token", () => {
  assert.equal(extractBearer("Bearer mytoken"), "mytoken");
});

test("requiresAuth flags POST/PUT/PATCH/DELETE", () => {
  for (const m of ["POST", "PUT", "PATCH", "DELETE", "post", "put"]) {
    assert.equal(requiresAuth(m), true, `${m} should require auth`);
  }
});

test("requiresAuth passes GET/HEAD/OPTIONS", () => {
  for (const m of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(requiresAuth(m), false, `${m} should NOT require auth`);
  }
});

test("isLoopbackIp recognises ipv4, ipv6, and ipv4-mapped-ipv6 loopback", () => {
  for (const ip of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) {
    assert.equal(isLoopbackIp(ip), true, `${ip} should be loopback`);
  }
  assert.equal(isLoopbackIp("10.0.0.1"), false);
  assert.equal(isLoopbackIp(undefined), false);
});
