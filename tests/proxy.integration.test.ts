import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { Logger, type LogEntry } from "../src/gateway/logger.js";
import { startProxy } from "../src/gateway/proxy.js";

/** Resolve the locally installed filesystem MCP server's entry script. */
function filesystemServerEntry(): string {
  const url = new URL(
    "../node_modules/@modelcontextprotocol/server-filesystem/dist/index.js",
    import.meta.url,
  );
  const p = url.pathname.startsWith("/") && process.platform === "win32"
    ? url.pathname.slice(1)
    : url.pathname;
  return decodeURIComponent(p);
}

interface PendingResponse {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * Consume a stream of newline-delimited JSON-RPC messages, resolving the
 * matching promise as soon as the response for a given id arrives.
 */
function jsonRpcReader(stream: NodeJS.ReadableStream): {
  awaitResponse: (id: number, timeoutMs?: number) => Promise<unknown>;
  close: () => void;
} {
  const pending = new Map<number, PendingResponse>();
  let buffer = "";

  const onData = (chunk: Buffer | string): void => {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    let nl = buffer.indexOf("\n");
    while (nl !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) {
        try {
          const msg = JSON.parse(line) as { id?: number };
          if (typeof msg.id === "number") {
            const p = pending.get(msg.id);
            if (p) {
              pending.delete(msg.id);
              p.resolve(msg);
            }
          }
        } catch {
          /* ignore non-JSON output */
        }
      }
      nl = buffer.indexOf("\n");
    }
  };

  stream.on("data", onData);

  return {
    awaitResponse(id, timeoutMs = 15_000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timeout waiting for JSON-RPC response id=${id}`));
        }, timeoutMs);
        pending.set(id, {
          resolve: (v) => {
            clearTimeout(timer);
            resolve(v);
          },
          reject: (err) => {
            clearTimeout(timer);
            reject(err);
          },
        });
      });
    },
    close() {
      stream.off("data", onData);
      for (const p of pending.values()) p.reject(new Error("stream closed"));
      pending.clear();
    },
  };
}

function readLogEntries(file: string): LogEntry[] {
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as LogEntry);
}

test("gateway proxies tools/list and logs both directions", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-proxy-"));
  const sandboxDir = path.join(tmpDir, "sandbox");
  fs.mkdirSync(sandboxDir);
  fs.writeFileSync(path.join(sandboxDir, "hello.txt"), "hi");

  const logFile = path.join(tmpDir, "gateway.log");
  const logger = new Logger(logFile);

  const clientToProxy = new PassThrough();
  const proxyToClient = new PassThrough();

  const handle = startProxy({
    serverName: "fs-test",
    command: process.execPath,
    args: [filesystemServerEntry(), sandboxDir],
    logger,
    input: clientToProxy,
    output: proxyToClient,
  });

  const reader = jsonRpcReader(proxyToClient);

  t.after(async () => {
    reader.close();
    if (!handle.child.killed) handle.child.kill();
    await handle.exit.catch(() => 0);
    await logger.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const initReq = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "wardn-test", version: "0.0.0" },
    },
  };
  clientToProxy.write(JSON.stringify(initReq) + "\n");
  const initResp = (await reader.awaitResponse(1)) as { result?: { serverInfo?: unknown } };
  assert.ok(initResp.result, "initialize must return a result");
  assert.ok(initResp.result.serverInfo, "initialize result should carry serverInfo");

  clientToProxy.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  const listReq = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };
  clientToProxy.write(JSON.stringify(listReq) + "\n");
  const listResp = (await reader.awaitResponse(2)) as {
    result?: { tools?: Array<{ name?: string }> };
  };
  assert.ok(listResp.result, "tools/list must return a result");
  assert.ok(Array.isArray(listResp.result.tools), "tools/list result must contain a tools array");
  assert.ok(listResp.result.tools.length > 0, "filesystem server should expose at least one tool");
  const toolNames = listResp.result.tools.map((tool) => tool.name);
  assert.ok(
    toolNames.some((name) => typeof name === "string" && name.includes("read")),
    `expected a read-style tool, got ${toolNames.join(", ")}`,
  );

  // Wait for the logger's async write stream to flush the last entry.
  await new Promise((r) => setTimeout(r, 100));

  const entries = readLogEntries(logFile);
  const outboundMethods = entries.filter((e) => e.direction === "out").map((e) => e.method);
  const inboundForListId = entries.find((e) => e.direction === "in" && e.id === 2);

  assert.ok(outboundMethods.includes("initialize"), "log should contain outgoing initialize");
  assert.ok(outboundMethods.includes("tools/list"), "log should contain outgoing tools/list");
  assert.ok(inboundForListId, "log should contain the matching tools/list response");
  assert.equal(inboundForListId.isResponse, true);
  assert.ok(
    typeof inboundForListId.durationMs === "number" && inboundForListId.durationMs >= 0,
    "tools/list response should carry a duration",
  );
});
