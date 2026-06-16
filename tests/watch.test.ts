import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { watchOnce, diffSnapshots } from "../src/cli/watch.js";

function silence<T>(fn: () => T): T {
  const w = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((..._a: unknown[]) => true) as typeof process.stdout.write;
  try {
    return fn();
  } finally {
    process.stdout.write = w;
  }
}

function withFixtures(files: Record<string, string>, fn: (dir: string, home: string) => void): void {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-watch-home-"));
  const dir = path.join(home, "fixtures");
  fs.mkdirSync(dir);
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  process.env.WARDN_HOME = home;
  try {
    fn(dir, home);
  } finally {
    delete process.env.WARDN_HOME;
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test("first watch run records the baseline and reports zero changes", () => {
  withFixtures(
    {
      "claude_desktop_config.json": JSON.stringify({
        mcpServers: { fs: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/safe"] } },
      }),
    },
    (dir, home) => {
      const r = silence(() => watchOnce({ from: dir }));
      assert.equal(r.diff.added.length, 1, "first run treats existing servers as new (no prior snapshot)");
      assert.ok(fs.existsSync(path.join(home, "scan-snapshot.json")), "snapshot should be persisted");
    },
  );
});

test("a second run with the same config shows no diff", () => {
  withFixtures(
    {
      "claude_desktop_config.json": JSON.stringify({
        mcpServers: { fs: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/safe"] } },
      }),
    },
    (dir) => {
      silence(() => watchOnce({ from: dir }));
      const second = silence(() => watchOnce({ from: dir }));
      assert.deepEqual(second.diff.added, []);
      assert.deepEqual(second.diff.removed, []);
      assert.deepEqual(second.diff.changed, []);
    },
  );
});

test("watch flags a new risky server", () => {
  withFixtures(
    {
      "claude_desktop_config.json": JSON.stringify({
        mcpServers: { gh: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] } },
      }),
    },
    (dir) => {
      silence(() => watchOnce({ from: dir }));
      // append a broad-fs server and rescan
      fs.writeFileSync(
        path.join(dir, "claude_desktop_config.json"),
        JSON.stringify({
          mcpServers: {
            gh: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
            risky: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/"] },
          },
        }),
      );
      const r = silence(() => watchOnce({ from: dir }));
      assert.ok(r.diff.added.some((a) => a.key.endsWith("::risky")));
      assert.ok(r.diff.newRisky.some((k) => k.endsWith("::risky")));
    },
  );
});

test("diffSnapshots produces transitions when a server's level changes", () => {
  const a = {
    takenAt: "t1",
    servers: { "claude_desktop::fs": { level: "risky" as const, signalIds: ["broad-fs"], client: "claude_desktop" } },
  };
  const b = {
    takenAt: "t2",
    servers: { "claude_desktop::fs": { level: "trusted" as const, signalIds: ["sandboxed"], client: "claude_desktop" } },
  };
  const d = diffSnapshots(a, b);
  assert.equal(d.changed.length, 1);
  assert.equal(d.changed[0].from, "risky");
  assert.equal(d.changed[0].to, "trusted");
  assert.deepEqual(d.newRisky, []);
});
