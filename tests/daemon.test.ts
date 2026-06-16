import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
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

  const tokenRes = await ctx.daemon.app.inject({ method: "GET", url: "/api/token" });
  const token = (tokenRes.json() as { token: string }).token;

  const safe = path.join(ctx.home, "safe");
  fs.mkdirSync(safe);
  const post = await ctx.daemon.app.inject({
    method: "POST",
    url: "/api/sandbox/filesystem",
    payload: { enabled: true, paths: [safe], network: false },
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
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

  const tokenRes = await ctx.daemon.app.inject({ method: "GET", url: "/api/token" });
  const token = (tokenRes.json() as { token: string }).token;
  const headers = { authorization: `Bearer ${token}` };

  // First call: no body → creates default-locked enabled policy
  const first = await ctx.daemon.app.inject({
    method: "POST",
    url: "/api/sandbox/github",
    payload: {},
    headers,
  });
  assert.equal((first.json() as SandboxBody).policy.enabled, true);
  // Second call: no body → toggles to disabled
  const second = await ctx.daemon.app.inject({
    method: "POST",
    url: "/api/sandbox/github",
    payload: {},
    headers,
  });
  assert.equal((second.json() as SandboxBody).policy.enabled, false);
});

test("POST /api/sandbox/:name without token is rejected with 401", async (t) => {
  const ctx = await startTestDaemon();
  t.after(() => ctx.cleanup());

  const res = await ctx.daemon.app.inject({ method: "POST", url: "/api/sandbox/x", payload: {} });
  assert.equal(res.statusCode, 401);
  const body = res.json() as { error: string };
  assert.match(body.error, /missing or invalid Authorization/i);
});

test("POST /api/sandbox/:name with a wrong token is rejected with 401", async (t) => {
  const ctx = await startTestDaemon();
  t.after(() => ctx.cleanup());

  const res = await ctx.daemon.app.inject({
    method: "POST",
    url: "/api/sandbox/x",
    payload: {},
    headers: { authorization: "Bearer not-the-real-token" },
  });
  assert.equal(res.statusCode, 401);
});

test("GET /api/token returns the token over loopback", async (t) => {
  const ctx = await startTestDaemon();
  t.after(() => ctx.cleanup());

  const res = await ctx.daemon.app.inject({
    method: "GET",
    url: "/api/token",
    remoteAddress: "127.0.0.1",
  });
  assert.equal(res.statusCode, 200);
  const body = res.json() as { token: string };
  assert.ok(body.token);
  assert.ok(body.token.length >= 32);
});

test("GET /api/token refuses non-loopback ips", async (t) => {
  const ctx = await startTestDaemon();
  t.after(() => ctx.cleanup());

  const res = await ctx.daemon.app.inject({
    method: "GET",
    url: "/api/token",
    remoteAddress: "10.0.0.5",
  });
  assert.equal(res.statusCode, 403);
});

test("GET / serves the dashboard placeholder when dashboard/dist is missing", async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-daemon-"));
  process.env.WARDN_HOME = home;
  const logger = new Logger(path.join(home, "gateway.log"));
  const dash = path.join(home, "nope"); // doesn't exist on disk
  const daemon = await startDaemon({ host: "127.0.0.1", port: 0, logger, dashboardDir: dash });
  t.after(async () => {
    await daemon.close();
    await logger.close();
    fs.rmSync(home, { recursive: true, force: true });
    delete process.env.WARDN_HOME;
  });

  const res = await daemon.app.inject({ method: "GET", url: "/" });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"] as string, /text\/html/);
  assert.match(res.body, /wardn gateway is running/);
  assert.match(res.body, /dashboard:build/);
});

test("GET / serves the built dashboard when dashboard/dist exists", async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-daemon-"));
  const dash = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-dash-built-"));
  fs.writeFileSync(path.join(dash, "index.html"), "<!doctype html><h1>built</h1>");
  process.env.WARDN_HOME = home;
  const logger = new Logger(path.join(home, "gateway.log"));
  const daemon = await startDaemon({ host: "127.0.0.1", port: 0, logger, dashboardDir: dash });
  t.after(async () => {
    await daemon.close();
    await logger.close();
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(dash, { recursive: true, force: true });
    delete process.env.WARDN_HOME;
  });

  const res = await daemon.app.inject({ method: "GET", url: "/" });
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /built/);
});

test("/api/status reflects dashboard=served when built", async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-daemon-"));
  const dash = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-dash-built-"));
  fs.writeFileSync(path.join(dash, "index.html"), "<!doctype html>");
  process.env.WARDN_HOME = home;
  const logger = new Logger(path.join(home, "gateway.log"));
  const daemon = await startDaemon({ host: "127.0.0.1", port: 0, logger, dashboardDir: dash });
  t.after(async () => {
    await daemon.close();
    await logger.close();
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(dash, { recursive: true, force: true });
    delete process.env.WARDN_HOME;
  });

  const r = await daemon.app.inject({ method: "GET", url: "/api/status" });
  const body = r.json() as { dashboard: string };
  assert.equal(body.dashboard, "served");
});

test("GET /api/events returns SSE headers", async (t) => {
  // We listen on a real port so we can read just the SSE headers + the first
  // bytes, then disconnect cleanly. Inject() can't stream an open SSE
  // response — it buffers the whole body, which never ends.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-sse-"));
  process.env.WARDN_HOME = home;
  const logger = new Logger(path.join(home, "gateway.log"));
  const daemon = await startDaemon({ host: "127.0.0.1", port: 0, logger });
  const port = (daemon.app.server.address() as { port: number }).port;
  t.after(async () => {
    await daemon.close();
    await logger.close();
    fs.rmSync(home, { recursive: true, force: true });
    delete process.env.WARDN_HOME;
  });

  const headersOk = await new Promise<{ status: number; ct: string; cc: string }>((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path: "/api/events", method: "GET" },
      (res) => {
        resolve({
          status: res.statusCode ?? 0,
          ct: String(res.headers["content-type"] ?? ""),
          cc: String(res.headers["cache-control"] ?? ""),
        });
        res.destroy();
      },
    );
    req.on("error", reject);
    req.end();
  });

  assert.equal(headersOk.status, 200);
  assert.match(headersOk.ct, /text\/event-stream/);
  assert.match(headersOk.cc, /no-cache/);
});
