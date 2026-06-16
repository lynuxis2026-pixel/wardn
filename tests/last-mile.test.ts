import { test } from "node:test";
import assert from "node:assert/strict";
import { scanServer, summarize, scanAll } from "../src/scanner/index.js";
import type { McpServer } from "../src/types.js";
import type { ServerPolicy } from "../src/sandbox/types.js";

function mk(over: Partial<McpServer>): McpServer {
  return {
    name: over.name ?? "x",
    client: over.client ?? "claude",
    source: over.source ?? "fixture",
    transport: over.transport ?? "stdio",
    command: over.command,
    args: over.args ?? [],
    env: over.env ?? {},
    url: over.url,
  };
}

test("scanAll without policies handles servers without a matching policy", () => {
  const results = scanAll([mk({ name: "a", command: "npx", args: ["-y", "some-pkg@1.0.0"] })], undefined);
  assert.equal(results.length, 1);
  // policies undefined should not crash the optional-chain `policies?.[s.name]`.
});

test("scanAll with policies but no matching key still works", () => {
  const results = scanAll(
    [mk({ name: "missing-from-policies" })],
    { other: { name: "other", enabled: true, filesystem: { paths: [] }, network: false, envWhitelist: [] } },
  );
  assert.equal(results.length, 1);
});

test("scanServer with disabled policy leaves signals untouched", () => {
  const server = mk({ name: "fs", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/"] });
  const policy: ServerPolicy = {
    name: "fs",
    enabled: false,
    filesystem: { paths: ["/safe"] },
    network: false,
    envWhitelist: [],
  };
  const r = scanServer(server, policy);
  // Disabled policy → broad-fs signal stays
  assert.ok(r.signals.some((s) => s.id === "broad-fs"));
  assert.equal(r.level, "risky");
});

test("scanServer policy with a broad fs path keeps broad-fs even when sandboxed", () => {
  const server = mk({ name: "fs", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/"] });
  const policy: ServerPolicy = {
    name: "fs",
    enabled: true,
    filesystem: { paths: ["/"] }, // still broad
    network: true,
    envWhitelist: ["GITHUB_TOKEN"],
  };
  const r = scanServer(server, policy);
  // policyHasBroadFs is true → broad-fs is NOT filtered out
  assert.ok(r.signals.some((s) => s.id === "broad-fs"));
  assert.ok(r.signals.some((s) => s.id === "sandboxed"));
});

test("scanServer sandboxed signal reports empty path list when policy has no paths", () => {
  const server = mk({ name: "x", command: "node" });
  const policy: ServerPolicy = {
    name: "x",
    enabled: true,
    filesystem: { paths: [] },
    network: false,
    envWhitelist: [],
  };
  const r = scanServer(server, policy);
  const sandboxed = r.signals.find((s) => s.id === "sandboxed");
  assert.ok(sandboxed);
  assert.match(sandboxed.reason, /fs=\[none\]/);
});

test("summarize counts zero correctly", () => {
  const s = summarize([]);
  assert.equal(s.total, 0);
  assert.equal(s.risky, 0);
});

// ===== enforce.ts edge branches =====

import { applySpawnPolicy, decideOutgoing } from "../src/sandbox/enforce.js";

test("applySpawnPolicy reports no spawn changes when args already match the policy", () => {
  const policy: ServerPolicy = {
    name: "fs",
    enabled: true,
    filesystem: { paths: ["/safe"] },
    network: false,
    envWhitelist: [],
  };
  const server = mk({
    name: "fs",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/safe"], // exact match
    env: { PATH: "/usr/bin" },
  });
  const rewrite = applySpawnPolicy(server, policy);
  assert.equal(rewrite.changes.length, 0, "no changes expected when args already match");
});

test("decideOutgoing keeps id null when the request omits one", () => {
  const policy: ServerPolicy = {
    name: "fs",
    enabled: true,
    filesystem: { paths: ["/safe"] },
    network: false,
    envWhitelist: [],
  };
  // No id at all — `msg.id ?? null` exercises the right branch.
  const decision = decideOutgoing(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "read_file", arguments: { path: "/etc/shadow" } },
    }),
    policy,
  );
  const resp = decision.reject?.response as { id?: unknown };
  assert.equal(resp?.id, null);
});

test("decideOutgoing keeps id null when blocking a dangerous tool name without id", () => {
  const policy: ServerPolicy = {
    name: "x",
    enabled: true,
    filesystem: { paths: [] },
    network: false,
    envWhitelist: [],
  };
  const decision = decideOutgoing(
    JSON.stringify({ jsonrpc: "2.0", method: "tools/call", params: { name: "shell_exec", arguments: {} } }),
    policy,
  );
  const resp = decision.reject?.response as { id?: unknown };
  assert.equal(resp?.id, null);
});

test("decideOutgoing keeps id null when blocking a URL with no request id", () => {
  const policy: ServerPolicy = {
    name: "x",
    enabled: true,
    filesystem: { paths: [] },
    network: false,
    envWhitelist: [],
  };
  const decision = decideOutgoing(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: "fetch", arguments: { url: "https://evil.example/" } },
    }),
    policy,
  );
  const resp = decision.reject?.response as { id?: unknown };
  assert.equal(resp?.id, null);
});
