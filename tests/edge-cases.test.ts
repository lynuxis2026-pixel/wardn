import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PolicyStore, defaultPolicyFor } from "../src/sandbox/store.js";
import { applyRewrite, restoreRewrite } from "../src/rewrite/index.js";
import { scanServer } from "../src/scanner/index.js";
import { loadTrustRegistry, _resetTrustRegistryCacheForTests } from "../src/scanner/trust-registry.js";
import type { McpServer } from "../src/types.js";

function silenceStderr<T>(fn: () => T): T {
  const w = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((..._a: unknown[]) => true) as typeof process.stderr.write;
  try {
    return fn();
  } finally {
    process.stderr.write = w;
  }
}

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

// ===== PolicyStore =====

test("PolicyStore.read returns empty when file is missing", () => {
  const f = path.join(os.tmpdir(), `wardn-store-${Date.now()}-${Math.floor(Math.random() * 1e6)}.json`);
  const store = new PolicyStore({ file: f });
  assert.deepEqual(store.read().servers, {});
});

test("PolicyStore.read recovers from invalid JSON", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-store-"));
  const f = path.join(dir, "policy.json");
  fs.writeFileSync(f, "{ not json");
  const store = new PolicyStore({ file: f });
  const out = silenceStderr(() => store.read());
  assert.deepEqual(out.servers, {});
  fs.rmSync(dir, { recursive: true, force: true });
});

test("PolicyStore.remove returns false when the policy doesn't exist", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-store-"));
  const f = path.join(dir, "policy.json");
  const store = new PolicyStore({ file: f });
  assert.equal(store.remove("nope"), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("PolicyStore.remove deletes an existing policy", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-store-"));
  const f = path.join(dir, "policy.json");
  const store = new PolicyStore({ file: f });
  store.upsert(defaultPolicyFor("x"));
  assert.equal(store.remove("x"), true);
  assert.equal(store.get("x"), undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ===== Rewrite edge cases =====

test("applyRewrite skips a file with no mcpServers map", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-rw-"));
  const fix = path.join(home, "fixtures");
  fs.mkdirSync(fix);
  fs.writeFileSync(path.join(fix, "weird.json"), JSON.stringify({ unrelated: true }));
  process.env.WARDN_HOME = home;
  try {
    const r = applyRewrite({ from: fix });
    assert.equal(r.applied.length, 0);
    assert.ok(r.skipped.some((s) => /no "mcpServers" map/.test(s.reason)));
  } finally {
    delete process.env.WARDN_HOME;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("applyRewrite skips a file whose JSON is invalid", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-rw-"));
  const fix = path.join(home, "fixtures");
  fs.mkdirSync(fix);
  fs.writeFileSync(path.join(fix, "broken.json"), "{ not json");
  process.env.WARDN_HOME = home;
  try {
    silenceStderr(() => {
      const r = applyRewrite({ from: fix });
      assert.equal(r.applied.length, 0);
      assert.ok(r.skipped.some((s) => /not valid JSON/.test(s.reason)));
    });
  } finally {
    delete process.env.WARDN_HOME;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("restoreRewrite reports a skipped entry when the backup file is missing", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-rw-"));
  const fix = path.join(home, "fixtures");
  fs.mkdirSync(fix);
  fs.writeFileSync(
    path.join(fix, "claude_desktop_config.json"),
    JSON.stringify({ mcpServers: { x: { command: "node", args: [] } } }),
  );
  process.env.WARDN_HOME = home;
  process.env.WARDN_TIMESTAMP = "edge-stamp";
  try {
    applyRewrite({ from: fix });
    // delete the backup behind restore's back
    const backupDir = path.join(home, "backups");
    for (const f of fs.readdirSync(backupDir)) fs.unlinkSync(path.join(backupDir, f));
    const r = restoreRewrite({ from: fix });
    assert.equal(r.restored.length, 0);
    assert.equal(r.skipped.length, 1);
  } finally {
    delete process.env.WARDN_HOME;
    delete process.env.WARDN_TIMESTAMP;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// ===== Scanner rules edge cases =====

test("scanner flags shell launchers as shell-exec", () => {
  const r = scanServer(mkServer({ command: "/bin/bash", args: ["-c", "echo hi"] }));
  assert.ok(r.signals.some((s) => s.id === "shell-exec"));
  assert.equal(r.level, "risky");
});

test("scanner flags pinned but unofficial packages without floating-version", () => {
  const r = scanServer(
    mkServer({
      command: "npx",
      args: ["-y", "some-third-party@1.2.3"],
    }),
  );
  assert.equal(r.signals.find((s) => s.id === "floating-version"), undefined);
  assert.ok(r.signals.some((s) => s.id === "unofficial-source"));
});

test("scanner remote-transport recovers from a malformed URL string", () => {
  const r = scanServer(
    mkServer({
      transport: "remote",
      url: "not a real url at all",
    }),
  );
  assert.ok(r.signals.some((s) => s.id === "remote"));
});

test("scanner emits known-bad for a registry-flagged package", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-reg-"));
  process.env.WARDN_HOME = home;
  fs.writeFileSync(
    path.join(home, "trust-registry.json"),
    JSON.stringify({
      version: 1,
      updatedAt: "2026-06-16",
      source: "test",
      packages: { "malware-mcp": { publisher: "evil", knownBad: true, notes: "spotted in the wild" } },
      publishers: { evil: { label: "Evil Co" } },
    }),
  );
  _resetTrustRegistryCacheForTests();
  try {
    const r = scanServer(mkServer({ command: "npx", args: ["-y", "malware-mcp@1.0.0"] }));
    assert.equal(r.level, "risky");
    assert.ok(r.signals.some((s) => s.id === "known-bad" && /spotted in the wild/.test(s.reason)));
  } finally {
    delete process.env.WARDN_HOME;
    _resetTrustRegistryCacheForTests();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

// ===== Trust registry corrupt-file fallback =====

test("loadTrustRegistry falls back to bundled when override is corrupt", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-reg-"));
  process.env.WARDN_HOME = home;
  fs.writeFileSync(path.join(home, "trust-registry.json"), "{ broken");
  _resetTrustRegistryCacheForTests();
  try {
    const reg = loadTrustRegistry();
    assert.ok(reg.packages["@modelcontextprotocol/server-filesystem"], "should still read the bundled fallback");
  } finally {
    delete process.env.WARDN_HOME;
    _resetTrustRegistryCacheForTests();
    fs.rmSync(home, { recursive: true, force: true });
  }
});
