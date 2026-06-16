import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyRewrite, restoreRewrite, rewriteStatus } from "../src/rewrite/index.js";

function setupFixtures(): { fixtureDir: string; wardnHome: string; original: Record<string, unknown> } {
  const wardnHome = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-rewrite-home-"));
  const fixtureDir = path.join(wardnHome, "fixtures");
  fs.mkdirSync(fixtureDir);

  const original = {
    mcpServers: {
      filesystem: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/"] },
      github: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: { GITHUB_TOKEN: "ghp_example" },
      },
      "remote-thing": { url: "https://example.com/sse" },
    },
    otherTopLevelKey: { do: "not touch" },
  };
  fs.writeFileSync(path.join(fixtureDir, "claude_desktop_config.json"), JSON.stringify(original, null, 2));

  return { fixtureDir, wardnHome, original };
}

test("rewrite apply mutates stdio servers, preserves the rest, and creates a backup", () => {
  const { fixtureDir, wardnHome, original } = setupFixtures();
  process.env.WARDN_HOME = wardnHome;
  process.env.WARDN_TIMESTAMP = "test-stamp";

  const result = applyRewrite({ from: fixtureDir, invokeTemplate: "wardn gateway run {name}" });
  assert.equal(result.applied.length, 1, "should apply to the one fixture file");
  const a = result.applied[0];
  assert.deepEqual(a.servers.sort(), ["filesystem", "github"], "stdio servers should be rewritten, remote skipped");

  // backup created
  assert.ok(fs.existsSync(a.backup), "backup file should exist");
  const backupContent = JSON.parse(fs.readFileSync(a.backup, "utf8"));
  assert.deepEqual(backupContent, original, "backup must match original byte for byte (semantically)");

  // mutated config
  const mutated = JSON.parse(fs.readFileSync(a.file, "utf8"));
  assert.deepEqual(mutated.mcpServers.filesystem, { command: "wardn", args: ["gateway", "run", "filesystem"] });
  assert.deepEqual(mutated.mcpServers.github, { command: "wardn", args: ["gateway", "run", "github"] });
  assert.deepEqual(
    mutated.mcpServers["remote-thing"],
    { url: "https://example.com/sse" },
    "remote servers should NOT be touched",
  );
  assert.deepEqual(mutated.otherTopLevelKey, { do: "not touch" }, "unrelated keys must be preserved");

  // status now lists the rewrite
  const status = rewriteStatus();
  assert.equal(status.entries.length, 1);
  assert.equal(status.entries[0].servers.length, 2);

  fs.rmSync(wardnHome, { recursive: true, force: true });
  delete process.env.WARDN_HOME;
  delete process.env.WARDN_TIMESTAMP;
});

test("rewrite restore puts the file back exactly as it was", () => {
  const { fixtureDir, wardnHome } = setupFixtures();
  process.env.WARDN_HOME = wardnHome;
  process.env.WARDN_TIMESTAMP = "restore-stamp";

  const configFile = path.join(fixtureDir, "claude_desktop_config.json");
  const originalRaw = fs.readFileSync(configFile, "utf8");

  applyRewrite({ from: fixtureDir, invokeTemplate: "wardn gateway run {name}" });
  assert.notEqual(fs.readFileSync(configFile, "utf8"), originalRaw, "apply should have changed the file");

  const result = restoreRewrite({ from: fixtureDir });
  assert.equal(result.restored.length, 1);
  assert.equal(fs.readFileSync(configFile, "utf8"), originalRaw, "restored file should be byte-identical to the original");

  // status should be empty again
  assert.equal(rewriteStatus().entries.length, 0);

  fs.rmSync(wardnHome, { recursive: true, force: true });
  delete process.env.WARDN_HOME;
  delete process.env.WARDN_TIMESTAMP;
});

test("rewrite apply --dry-run touches no files but reports what would change", () => {
  const { fixtureDir, wardnHome } = setupFixtures();
  process.env.WARDN_HOME = wardnHome;
  process.env.WARDN_TIMESTAMP = "dry-stamp";

  const configFile = path.join(fixtureDir, "claude_desktop_config.json");
  const before = fs.readFileSync(configFile, "utf8");

  const result = applyRewrite({ from: fixtureDir, dryRun: true });

  assert.equal(result.applied.length, 1);
  assert.equal(result.applied[0].dryRun, true);
  assert.deepEqual(result.applied[0].servers.sort(), ["filesystem", "github"]);

  // file must be byte-identical
  assert.equal(fs.readFileSync(configFile, "utf8"), before);
  // no backup written
  assert.equal(fs.existsSync(result.applied[0].backup), false, "dry run should not create a backup");
  // rewrite index unchanged
  const index = path.join(wardnHome, "rewrites.json");
  assert.equal(fs.existsSync(index), false, "dry run should not write rewrites.json");

  fs.rmSync(wardnHome, { recursive: true, force: true });
  delete process.env.WARDN_HOME;
  delete process.env.WARDN_TIMESTAMP;
});

test("rewrite apply skips a file that's already been rewritten", () => {
  const { fixtureDir, wardnHome } = setupFixtures();
  process.env.WARDN_HOME = wardnHome;
  process.env.WARDN_TIMESTAMP = "skip-stamp";

  applyRewrite({ from: fixtureDir });
  const second = applyRewrite({ from: fixtureDir });

  assert.equal(second.applied.length, 0);
  assert.equal(second.skipped.length, 1);
  assert.match(second.skipped[0].reason, /already rewritten/);

  fs.rmSync(wardnHome, { recursive: true, force: true });
  delete process.env.WARDN_HOME;
  delete process.env.WARDN_TIMESTAMP;
});
