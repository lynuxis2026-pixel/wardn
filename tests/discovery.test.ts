import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverFromDir } from "../src/discovery/index.js";

function withFixtureDir<T>(files: Record<string, string>, fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-disc-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), content);
    }
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("discovery parses claude_desktop_config.json shape", () => {
  withFixtureDir(
    {
      "claude_desktop_config.json": JSON.stringify({
        mcpServers: {
          fs: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/safe"] },
        },
      }),
    },
    (dir) => {
      const servers = discoverFromDir(dir);
      assert.equal(servers.length, 1);
      assert.equal(servers[0].name, "fs");
      assert.equal(servers[0].transport, "stdio");
      assert.equal(servers[0].command, "npx");
      assert.deepEqual(servers[0].args, ["-y", "@modelcontextprotocol/server-filesystem", "/safe"]);
      assert.equal(servers[0].client, "claude_desktop");
    },
  );
});

test("discovery treats a `url` entry as remote transport", () => {
  withFixtureDir(
    {
      "cursor_mcp.json": JSON.stringify({
        mcpServers: {
          notion: { url: "https://mcp.example.com/sse" },
        },
      }),
    },
    (dir) => {
      const servers = discoverFromDir(dir);
      assert.equal(servers.length, 1);
      assert.equal(servers[0].transport, "remote");
      assert.equal(servers[0].url, "https://mcp.example.com/sse");
      assert.equal(servers[0].command, undefined);
    },
  );
});

test("discovery quietly skips files that are not valid JSON", () => {
  withFixtureDir(
    {
      "broken.json": "{ not json",
      "ok.json": JSON.stringify({ mcpServers: { hi: { command: "node" } } }),
    },
    (dir) => {
      // intercept stderr so the test output stays clean
      const errs: string[] = [];
      const origErr = process.stderr.write.bind(process.stderr);
      process.stderr.write = ((chunk: unknown) => {
        errs.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;
      try {
        const servers = discoverFromDir(dir);
        assert.equal(servers.length, 1);
        assert.equal(servers[0].name, "hi");
      } finally {
        process.stderr.write = origErr;
      }
      assert.ok(errs.some((e) => e.includes("could not parse")));
    },
  );
});

test("discovery falls back to `servers` key (VS Code shape)", () => {
  withFixtureDir(
    {
      "vscode.json": JSON.stringify({
        servers: {
          gh: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
        },
      }),
    },
    (dir) => {
      const servers = discoverFromDir(dir);
      assert.equal(servers.length, 1);
      assert.equal(servers[0].name, "gh");
    },
  );
});

test("discovery returns an empty list when the directory has no JSON", () => {
  withFixtureDir({ "not-json.txt": "ignore me" }, (dir) => {
    const servers = discoverFromDir(dir);
    assert.deepEqual(servers, []);
  });
});

test("discovery copes with a missing servers map", () => {
  withFixtureDir(
    {
      "weird.json": JSON.stringify({ unrelated: { keys: 1 } }),
    },
    (dir) => {
      const servers = discoverFromDir(dir);
      assert.deepEqual(servers, []);
    },
  );
});

test("discovery returns nothing for a non-existent directory", () => {
  const errs: string[] = [];
  const origErr = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((c: unknown) => {
    errs.push(String(c));
    return true;
  }) as typeof process.stderr.write;
  try {
    const servers = discoverFromDir(path.join(os.tmpdir(), "wardn-not-real-" + Date.now()));
    assert.deepEqual(servers, []);
  } finally {
    process.stderr.write = origErr;
  }
});
