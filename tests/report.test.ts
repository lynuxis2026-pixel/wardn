import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildReport } from "../src/cli/report.js";

function withFixtureDir(files: Record<string, string>, fn: (dir: string, home: string) => void): void {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-report-"));
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

test("buildReport contains the expected sections and trust counts", () => {
  withFixtureDir(
    {
      "claude_desktop_config.json": JSON.stringify({
        mcpServers: {
          fs: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/"] },
          gh: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
        },
      }),
    },
    (dir) => {
      const md = buildReport({ from: dir, now: "2026-06-16T00:00:00.000Z" });
      assert.match(md, /# wardn trust report/);
      assert.match(md, /## Summary/);
      assert.match(md, /## Servers/);
      assert.match(md, /## Sandbox policies/);
      assert.match(md, /## Rewrites/);
      assert.match(md, /\| Servers \| 2 \|/);
      assert.match(md, /\| Risky \| 1 \|/);
      assert.match(md, /\*\*fs\*\*/);
      assert.match(md, /broad-fs/);
    },
  );
});

test("buildReport handles an empty fixture cleanly", () => {
  withFixtureDir({}, (dir) => {
    const md = buildReport({ from: dir, now: "2026-06-16T00:00:00.000Z" });
    assert.match(md, /No MCP servers discovered/);
    assert.match(md, /\| Servers \| 0 \|/);
  });
});
