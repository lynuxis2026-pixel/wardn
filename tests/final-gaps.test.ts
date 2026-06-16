import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PolicyStore } from "../src/sandbox/store.js";
import { applyRewrite, restoreRewrite, rewriteStatus } from "../src/rewrite/index.js";
import { dockerizeSpawn, _setDockerAvailableForTests } from "../src/sandbox/docker.js";
import type { ServerPolicy } from "../src/sandbox/types.js";
import type { SpawnRewrite } from "../src/sandbox/enforce.js";

function silenceStderr<T>(fn: () => T): T {
  const w = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((..._a: unknown[]) => true) as typeof process.stderr.write;
  try {
    return fn();
  } finally {
    process.stderr.write = w;
  }
}

test("PolicyStore.filePath exposes the underlying path", () => {
  const f = path.join(os.tmpdir(), `wardn-store-fp-${Date.now()}.json`);
  const s = new PolicyStore({ file: f });
  assert.equal(s.filePath(), f);
});

test("applyRewrite returns empty when fromDir does not exist", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-rw-noex-"));
  process.env.WARDN_HOME = home;
  try {
    const r = applyRewrite({ from: path.join(home, "definitely-does-not-exist") });
    assert.equal(r.applied.length, 0);
    assert.equal(r.skipped.length, 0);
  } finally {
    delete process.env.WARDN_HOME;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("applyRewrite skips a file that disappears between listing and reading", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-rw-race-"));
  const fix = path.join(home, "fixtures");
  fs.mkdirSync(fix);
  // The file we record in the listing but then delete before listTargets
  // re-reads it. Easier: write a directory with the .json extension — readFileSync fails.
  fs.mkdirSync(path.join(fix, "looks-like.json"));
  process.env.WARDN_HOME = home;
  try {
    silenceStderr(() => {
      const r = applyRewrite({ from: fix });
      assert.equal(r.applied.length, 0);
      assert.ok(r.skipped.some((s) => /unreadable|not valid JSON/i.test(s.reason)));
    });
  } finally {
    delete process.env.WARDN_HOME;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("restoreRewrite skips entries that don't match --client / --from filters", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-rw-filter-"));
  const fix = path.join(home, "fixtures");
  fs.mkdirSync(fix);
  fs.writeFileSync(
    path.join(fix, "claude_desktop_config.json"),
    JSON.stringify({ mcpServers: { x: { command: "node", args: [] } } }),
  );
  process.env.WARDN_HOME = home;
  process.env.WARDN_TIMESTAMP = "filter-stamp";
  try {
    applyRewrite({ from: fix });
    // Now restore with a filter that DOESN'T match — the entry should be left in place.
    const r = restoreRewrite({ from: fix, client: "vscode" });
    assert.equal(r.restored.length, 0);
    // status still shows the entry as active
    assert.equal(rewriteStatus().entries.length, 1);
  } finally {
    delete process.env.WARDN_HOME;
    delete process.env.WARDN_TIMESTAMP;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("dockerizeSpawn passes env variables through with -e flags", () => {
  _setDockerAvailableForTests(true);
  try {
    const rewrite: SpawnRewrite = {
      command: "node",
      args: ["server.js"],
      env: { GITHUB_TOKEN: "ghp_test", DEBUG: "1" },
      changes: [],
    };
    const policy: ServerPolicy = {
      name: "x",
      enabled: true,
      filesystem: { paths: [] },
      network: true,
      envWhitelist: ["GITHUB_TOKEN"],
    };
    const out = dockerizeSpawn(rewrite, { policy });
    // Find -e occurrences and the following value
    const eAt = out.args.indexOf("-e");
    assert.notEqual(eAt, -1, "should include -e flags for env vars");
    assert.match(out.args.slice(eAt).join(","), /GITHUB_TOKEN=ghp_test/);
  } finally {
    _setDockerAvailableForTests(undefined);
  }
});
