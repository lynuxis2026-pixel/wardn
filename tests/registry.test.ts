import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findServerByName } from "../src/gateway/registry.js";

function withFixtures(files: Record<string, string>, fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-reg-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), content);
    }
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("findServerByName resolves a server in a fixture directory", () => {
  withFixtures(
    {
      "claude_desktop_config.json": JSON.stringify({
        mcpServers: { fs: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/"] } },
      }),
    },
    (dir) => {
      const s = findServerByName("fs", { from: dir });
      assert.ok(s, "should find the server");
      assert.equal(s?.command, "npx");
      assert.equal(s?.transport, "stdio");
    },
  );
});

test("findServerByName returns undefined for an unknown name", () => {
  withFixtures(
    {
      "claude_desktop_config.json": JSON.stringify({
        mcpServers: { fs: { command: "npx", args: [] } },
      }),
    },
    (dir) => {
      assert.equal(findServerByName("not-there", { from: dir }), undefined);
    },
  );
});

test("findServerByName picks the first match when multiple clients share a name", () => {
  withFixtures(
    {
      "claude_desktop_config.json": JSON.stringify({
        mcpServers: { shared: { command: "npx", args: ["-y", "a"] } },
      }),
      "cursor_mcp.json": JSON.stringify({
        mcpServers: { shared: { command: "npx", args: ["-y", "b"] } },
      }),
    },
    (dir) => {
      const s = findServerByName("shared", { from: dir });
      assert.ok(s, "should find a match");
      assert.equal(s?.command, "npx");
    },
  );
});
