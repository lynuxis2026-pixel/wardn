import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { Logger } from "../src/gateway/logger.js";
import { startProxy, type ProxyEnforcer } from "../src/gateway/proxy.js";
import { decideOutgoing } from "../src/sandbox/enforce.js";
import type { ServerPolicy } from "../src/sandbox/types.js";

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

interface PendingResp {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

function jsonRpcReader(stream: NodeJS.ReadableStream): {
  awaitResponse(id: number, timeoutMs?: number): Promise<unknown>;
  close(): void;
} {
  const pending = new Map<number, PendingResp>();
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
          /* ignore non-JSON */
        }
      }
      nl = buffer.indexOf("\n");
    }
  };
  stream.on("data", onData);
  return {
    awaitResponse(id, timeoutMs = 15_000) {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timeout waiting for response id=${id}`));
        }, timeoutMs);
        pending.set(id, {
          resolve: (v) => {
            clearTimeout(t);
            resolve(v);
          },
          reject: (e) => {
            clearTimeout(t);
            reject(e);
          },
        });
      });
    },
    close() {
      stream.off("data", onData);
      for (const p of pending.values()) p.reject(new Error("closed"));
      pending.clear();
    },
  };
}

test("sandbox rejects out-of-policy tool-calls without reaching the server", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-sandbox-"));
  const sandboxDir = path.join(tmpDir, "allowed");
  fs.mkdirSync(sandboxDir);
  fs.writeFileSync(path.join(sandboxDir, "ok.txt"), "ok");

  const outside = path.join(tmpDir, "outside.txt");
  fs.writeFileSync(outside, "secret");

  const policy: ServerPolicy = {
    name: "fs-sandbox",
    enabled: true,
    filesystem: { paths: [sandboxDir] },
    network: false,
    envWhitelist: [],
  };

  const enforcer: ProxyEnforcer = {
    decide: (line) => {
      const d = decideOutgoing(line, policy);
      return d.reject ? { reject: d.reject } : { allow: true };
    },
  };

  const logger = new Logger(path.join(tmpDir, "gateway.log"));
  const clientToProxy = new PassThrough();
  const proxyToClient = new PassThrough();

  const handle = startProxy({
    serverName: policy.name,
    command: process.execPath,
    args: [filesystemServerEntry(), sandboxDir],
    logger,
    input: clientToProxy,
    output: proxyToClient,
    enforcer,
  });

  const reader = jsonRpcReader(proxyToClient);

  t.after(async () => {
    reader.close();
    if (!handle.child.killed) handle.child.kill();
    await handle.exit.catch(() => 0);
    await logger.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // initialize
  clientToProxy.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "wardn-test", version: "0.0.0" },
      },
    }) + "\n",
  );
  await reader.awaitResponse(1);
  clientToProxy.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

  // out-of-policy call — register the resolver BEFORE writing, otherwise
  // the synthesized reject (in-process, no async hop) can race past it.
  const blockedPromise = reader.awaitResponse(2);
  clientToProxy.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "read_text_file", arguments: { path: outside } },
    }) + "\n",
  );
  const blocked = (await blockedPromise) as { result?: { isError?: boolean; content?: Array<{ text?: string }> } };
  assert.equal(blocked.result?.isError, true, "out-of-policy call should be rejected");
  assert.match(blocked.result?.content?.[0]?.text ?? "", /outside the sandbox policy/);
});
