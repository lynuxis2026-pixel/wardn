import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import type { Logger, LogEntry } from "./logger.js";
import { discoverFromKnownClients, discoverFromDir } from "../discovery/index.js";
import { scanAll, summarize } from "../scanner/index.js";
import { PolicyStore, defaultPolicyFor } from "../sandbox/store.js";
import { isDockerAvailable } from "../sandbox/docker.js";
import type { ServerPolicy } from "../sandbox/types.js";

export interface DaemonOptions {
  port: number;
  host: string;
  logger: Logger;
  /** When set, scan reads fixtures from this dir instead of the real client configs. */
  scanFrom?: string;
  /** Override the static dashboard directory; defaults to <repo>/dashboard/dist. */
  dashboardDir?: string;
}

export interface DaemonHandle {
  host: string;
  port: number;
  app: FastifyInstance;
  close(): Promise<void>;
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;

function defaultDashboardDir(): string {
  // src/gateway/daemon.ts → repo root is two parents up from this file.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "dashboard", "dist");
}

function tailLogFile(file: string, onEntry: (entry: LogEntry) => void): () => void {
  let position = 0;
  try {
    position = fs.statSync(file).size;
  } catch {
    position = 0;
  }
  let leftover = "";
  let reading = false;

  const readNew = (newSize: number): void => {
    if (reading || newSize <= position) return;
    reading = true;
    const stream = fs.createReadStream(file, { start: position, end: newSize - 1, encoding: "utf8" });
    stream.on("data", (chunk: string | Buffer) => {
      leftover += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      let nl = leftover.indexOf("\n");
      while (nl !== -1) {
        const line = leftover.slice(0, nl).trim();
        leftover = leftover.slice(nl + 1);
        if (line) {
          try {
            onEntry(JSON.parse(line) as LogEntry);
          } catch {
            /* skip malformed lines */
          }
        }
        nl = leftover.indexOf("\n");
      }
    });
    stream.on("end", () => {
      position = newSize;
      reading = false;
    });
    stream.on("error", () => {
      reading = false;
    });
  };

  fs.watchFile(file, { interval: 250 }, (curr) => {
    if (curr.size < position) {
      position = 0;
      leftover = "";
    }
    readNew(curr.size);
  });

  return () => {
    fs.unwatchFile(file);
  };
}

interface SandboxBody {
  enabled?: boolean;
  paths?: string[];
  network?: boolean;
  envWhitelist?: string[];
}

export async function startDaemon(opts: DaemonOptions): Promise<DaemonHandle> {
  const app = Fastify({ logger: false });
  await app.register(fastifyCors, { origin: true });

  const dashboardDir = opts.dashboardDir ?? defaultDashboardDir();
  const dashboardExists = fs.existsSync(path.join(dashboardDir, "index.html"));

  // Static dashboard at /. Falls back to a friendly placeholder if the
  // dashboard hasn't been built yet (so `wardn gateway start` doesn't 404
  // before the user runs `npm run build:dashboard`).
  if (dashboardExists) {
    await app.register(fastifyStatic, { root: dashboardDir, prefix: "/" });
  } else {
    app.get("/", async (_req, reply) => {
      reply.type("text/html").send(`<!doctype html>
<html><head><meta charset="utf-8"><title>wardn</title>
<style>body{font-family:ui-monospace,monospace;background:#000510;color:#cfe8f5;padding:48px;max-width:680px;margin:0 auto}h1{color:#4db4dc;font-weight:600;letter-spacing:0.04em}code{background:#0a1a28;padding:2px 6px;border-radius:4px;color:#7fd0ee}a{color:#4db4dc}</style>
</head><body>
<h1>wardn gateway is running</h1>
<p>The dashboard isn't built yet. From the repo run:</p>
<p><code>npm run dashboard:build</code></p>
<p>Or hit the API directly:</p>
<ul>
  <li><a href="/api/status">/api/status</a></li>
  <li><a href="/api/scan">/api/scan</a></li>
  <li><a href="/api/events">/api/events</a> (SSE)</li>
</ul>
</body></html>`);
    });
  }

  app.get("/api/status", async () => ({
    status: "ok",
    pid: process.pid,
    uptimeSec: Math.round(process.uptime()),
    logFile: opts.logger.filePath(),
    docker: isDockerAvailable(),
    dashboard: dashboardExists ? "served" : "not-built",
  }));

  app.get("/api/scan", async () => {
    const servers = opts.scanFrom ? discoverFromDir(opts.scanFrom) : discoverFromKnownClients();
    const policies = new PolicyStore().read().servers;
    const results = scanAll(servers, policies);
    return { summary: summarize(results), results, policies };
  });

  app.post<{ Params: { name: string }; Body: SandboxBody }>("/api/sandbox/:name", async (req, reply) => {
    const store = new PolicyStore();
    const existing = store.get(req.params.name);
    const base: ServerPolicy = existing ?? defaultPolicyFor(req.params.name);
    const body = req.body ?? {};
    // Toggle semantics: if `enabled` is explicit in the body, use it. Otherwise
    // enable on first creation; toggle the existing flag on subsequent calls.
    const nextEnabled =
      typeof body.enabled === "boolean" ? body.enabled : existing ? !existing.enabled : true;
    const policy: ServerPolicy = {
      ...base,
      enabled: nextEnabled,
      filesystem: { paths: Array.isArray(body.paths) ? body.paths.map((p) => path.resolve(p)) : base.filesystem.paths },
      network: typeof body.network === "boolean" ? body.network : base.network,
      envWhitelist: Array.isArray(body.envWhitelist) ? body.envWhitelist : base.envWhitelist,
    };
    store.upsert(policy);
    reply.send({ ok: true, policy });
  });

  app.get("/api/events", (req, reply) => {
    reply.raw.writeHead(200, SSE_HEADERS);
    reply.raw.write(": connected\n\n");

    const send = (entry: LogEntry): void => {
      reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    opts.logger.on("entry", send);
    const stopTail = tailLogFile(opts.logger.filePath(), send);

    const cleanup = (): void => {
      opts.logger.off("entry", send);
      stopTail();
    };
    req.raw.on("close", cleanup);
    req.raw.on("end", cleanup);
  });

  await app.listen({ port: opts.port, host: opts.host });

  return {
    host: opts.host,
    port: opts.port,
    app,
    close: async () => {
      await app.close();
    },
  };
}
