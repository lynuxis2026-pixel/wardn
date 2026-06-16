import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startDaemon } from "../src/gateway/daemon.js";
import { Logger } from "../src/gateway/logger.js";

interface StartedDaemon {
  daemon: Awaited<ReturnType<typeof startDaemon>>;
  logger: Logger;
  home: string;
  fixturesDir: string;
  cleanup: () => Promise<void>;
}

async function startTestDaemon(): Promise<StartedDaemon> {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-daemon-"));
  process.env.WARDN_HOME = home;
  const fixturesDir = path.join(home, "fixtures");
  fs.mkdirSync(fixturesDir);
  fs.writeFileSync(
    path.join(fixturesDir, "claude_desktop_config.json"),
    JSON.stringify({
      mcpServers: {
        filesystem: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/"] },
        github: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github"],
          env: { GITHUB_TOKEN: "ghp_example" },
        },
      },
    }),
  );

  const logger = new Logger(path.join(home, "gateway.log"));
  // Use port 0 — Fastify picks any free port. We never hit it; we use inject().
  const daemon = await startDaemon({ host: "127.0.0.1", port: 0, logger, scanFrom: fixturesDir });
  return {
    daemon,
    logger,
    home,
    fixturesDir,
    cleanup: async () => {
      await daemon.close();
      await logger.close();
      fs.rmSync(home, { recursive: true, force: true });
      delete process.env.WARDN_HOME;
    },
  };
}

interface StatusBody {
  status: string;
  pid: number;
  uptimeSec: number;
  logFile: string;
  docker: boolean;
  dashboard: string;
}

interface ScanBody {
  summary: { total: number; risky: number; review: number; trusted: number };
  results: Array<{ server: { name: string }; level: string; signals: Array<{ id: string }> }>;
  policies: Record<string, unknown>;
}

interface SandboxBody {
  ok: boolean;
  policy: { enabled: boolean; filesystem: { paths: string[] }; network: boolean };
}

test("GET /api/status returns daemon health", async (t) => {
  const ctx = await startTestDaemon();
  t.after(() => ctx.cleanup());

  const res = await ctx.daemon.app.inject({ method: "GET", url: "/api/status" });
  assert.equal(res.statusCode, 200);
  const body = res.json() as StatusBody;
  assert.equal(body.status, "ok");
  assert.equal(typeof body.pid, "number");
  assert.ok(body.uptimeSec >= 0);
  assert.equal(typeof body.docker, "boolean");
});

test("GET /api/scan returns the fixture scan + summary", async (t) => {
  const ctx = await startTestDaemon();
  t.after(() => ctx.cleanup());

  const res = await ctx.daemon.app.inject({ method: "GET", url: "/api/scan" });
  assert.equal(res.statusCode, 200);
  const body = res.json() as ScanBody;
  assert.equal(body.summary.total, 2);
  assert.equal(body.summary.risky, 1, "filesystem with broad-fs should be risky");
  assert.ok(body.results.find((r) => r.server.name === "filesystem"));
  assert.ok(body.results.find((r) => r.server.name === "github"));
});

test("POST /api/sandbox/:name persists a policy", async (t) => {
  const ctx = await startTestDaemon();
  t.after(() => ctx.cleanup());

  const safe = path.join(ctx.home, "safe");
  fs.mkdirSync(safe);
  const post = await ctx.daemon.app.inject({
    method: "POST",
    url: "/api/sandbox/filesystem",
    payload: { enabled: true, paths: [safe], network: false },
    headers: { "content-type": "application/json" },
  });
  assert.equal(post.statusCode, 200);
  const body = post.json() as SandboxBody;
  assert.equal(body.ok, true);
  assert.equal(body.policy.enabled, true);
  assert.equal(body.policy.filesystem.paths[0], path.resolve(safe));

  // Re-scan should now flip filesystem out of risky.
  const after = await ctx.daemon.app.inject({ method: "GET", url: "/api/scan" });
  const afterBody = after.json() as ScanBody;
  assert.equal(afterBody.summary.risky, 0, "sandbox must drop filesystem out of risky");
  const fs1 = afterBody.results.find((r) => r.server.name === "filesystem");
  assert.ok(fs1?.signals.some((s) => s.id === "sandboxed"));
});

test("POST /api/sandbox/:name with no body toggles the existing policy", async (t) => {
  const ctx = await startTestDaemon();
  t.after(() => ctx.cleanup());

  // First call: no body → creates default-locked enabled policy
  const first = await ctx.daemon.app.inject({ method: "POST", url: "/api/sandbox/github", payload: {} });
  assert.equal((first.json() as SandboxBody).policy.enabled, true);
  // Second call: no body → toggles to disabled
  const second = await ctx.daemon.app.inject({ method: "POST", url: "/api/sandbox/github", payload: {} });
  assert.equal((second.json() as SandboxBody).policy.enabled, false);
});
