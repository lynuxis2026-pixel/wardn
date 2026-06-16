import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PolicyStore, defaultPolicyFor } from "../src/sandbox/store.js";
import { applySpawnPolicy, decideOutgoing, pathInsideAny } from "../src/sandbox/enforce.js";
import { scanServer } from "../src/scanner/index.js";
import type { McpServer } from "../src/types.js";
import type { ServerPolicy } from "../src/sandbox/types.js";

function mkServer(over: Partial<McpServer>): McpServer {
  return {
    name: over.name ?? "test",
    client: over.client ?? "claude-desktop",
    source: over.source ?? "fixture",
    transport: over.transport ?? "stdio",
    command: over.command,
    args: over.args ?? [],
    env: over.env ?? {},
    url: over.url,
  };
}

test("PolicyStore read/write round-trip", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-policy-"));
  const file = path.join(dir, "policy.json");
  const store = new PolicyStore({ file });

  assert.deepEqual(store.read().servers, {});

  const policy: ServerPolicy = {
    name: "fs",
    enabled: true,
    filesystem: { paths: ["/safe"] },
    network: false,
    envWhitelist: ["GITHUB_TOKEN"],
  };
  store.upsert(policy);

  const reread = new PolicyStore({ file }).get("fs");
  assert.deepEqual(reread, policy);

  fs.rmSync(dir, { recursive: true, force: true });
});

test("applySpawnPolicy retargets filesystem server and strips env", () => {
  const server = mkServer({
    name: "fs",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/"],
    env: { GITHUB_TOKEN: "secret", PATH: "/usr/bin" },
  });
  const policy: ServerPolicy = {
    name: "fs",
    enabled: true,
    filesystem: { paths: ["/safe/dir"] },
    network: false,
    envWhitelist: [],
  };
  const rewrite = applySpawnPolicy(server, policy);
  assert.equal(rewrite.command, "npx");
  assert.deepEqual(rewrite.args, ["-y", "@modelcontextprotocol/server-filesystem", "/safe/dir"]);
  assert.equal(rewrite.env.GITHUB_TOKEN, undefined, "non-whitelisted env should be stripped");
  assert.equal(rewrite.env.PATH, "/usr/bin", "baseline env should pass through");
  assert.ok(rewrite.changes.some((c) => c.includes("filesystem paths")));
  assert.ok(rewrite.changes.some((c) => c.includes("env stripped")));
});

test("decideOutgoing blocks a tools/call with an out-of-policy path", () => {
  const policy: ServerPolicy = {
    name: "fs",
    enabled: true,
    filesystem: { paths: [path.resolve("/safe")] },
    network: false,
    envWhitelist: [],
  };
  const call = JSON.stringify({
    jsonrpc: "2.0",
    id: 42,
    method: "tools/call",
    params: { name: "read_file", arguments: { path: "/etc/shadow" } },
  });
  const decision = decideOutgoing(call, policy);
  assert.ok(decision.reject, "out-of-policy path must be rejected");
  const resp = decision.reject?.response as { id?: number; result?: { isError?: boolean } };
  assert.equal(resp.id, 42);
  assert.equal(resp.result?.isError, true);
});

test("decideOutgoing allows tools/call inside the policy", () => {
  const policy: ServerPolicy = {
    name: "fs",
    enabled: true,
    filesystem: { paths: [path.resolve("/safe")] },
    network: false,
    envWhitelist: [],
  };
  const call = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "read_file", arguments: { path: path.resolve("/safe/inner/file.txt") } },
  });
  const decision = decideOutgoing(call, policy);
  assert.equal(decision.allow, true);
});

test("decideOutgoing blocks network when policy.network is false", () => {
  const policy: ServerPolicy = {
    name: "fetch",
    enabled: true,
    filesystem: { paths: [] },
    network: false,
    envWhitelist: [],
  };
  const call = JSON.stringify({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "fetch", arguments: { url: "https://evil.example/" } },
  });
  const decision = decideOutgoing(call, policy);
  assert.ok(decision.reject);
});

test("decideOutgoing skips non-tool methods", () => {
  const policy: ServerPolicy = {
    name: "fs",
    enabled: true,
    filesystem: { paths: ["/safe"] },
    network: false,
    envWhitelist: [],
  };
  const decision = decideOutgoing(
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    policy,
  );
  assert.equal(decision.allow, true);
});

test("scanner downgrades broad-fs when a sandbox restricts it", () => {
  const server = mkServer({
    name: "fs",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/"],
  });

  const raw = scanServer(server);
  assert.equal(raw.level, "risky", "broad path should be risky without a policy");
  assert.ok(raw.signals.some((s) => s.id === "broad-fs"));

  const policy: ServerPolicy = defaultPolicyFor("fs");
  const guarded = scanServer(server, policy);
  assert.notEqual(guarded.level, "risky", "policy should drop the trust level out of risky");
  assert.ok(!guarded.signals.some((s) => s.id === "broad-fs"), "broad-fs signal should be removed");
  assert.ok(guarded.signals.some((s) => s.id === "sandboxed"), "scanner should add a sandboxed marker");
});

test("pathInsideAny handles platform-specific normalization", () => {
  if (process.platform === "win32") {
    assert.equal(pathInsideAny("C:\\Users\\me\\file.txt", ["C:\\Users\\me"]), true);
    assert.equal(pathInsideAny("C:\\Users\\other", ["C:\\Users\\me"]), false);
  } else {
    assert.equal(pathInsideAny("/home/me/file.txt", ["/home/me"]), true);
    assert.equal(pathInsideAny("/home/other", ["/home/me"]), false);
  }
});
