import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { Logger, type LogEntry } from "../src/gateway/logger.js";
import { startProxy } from "../src/gateway/proxy.js";

/** Spawn a tiny echo-server stub so the proxy has something to feed bytes to. */
function startEchoProxy(): {
  stdin: PassThrough;
  stdout: PassThrough;
  logger: Logger;
  exit: Promise<number>;
  cleanup: () => Promise<void>;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-proxy-edge-"));
  const log = path.join(dir, "gateway.log");
  const logger = new Logger(log);
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const h = startProxy({
    serverName: "echo",
    command: process.execPath,
    // Inline JS that echoes every line of stdin back out unchanged.
    args: [
      "-e",
      "process.stdin.on('data',c=>process.stdout.write(c)); process.stdin.on('end',()=>process.exit(0));",
    ],
    logger,
    input: stdin,
    output: stdout,
  });
  const cleanup = async (): Promise<void> => {
    if (!h.child.killed) h.child.kill();
    await h.exit.catch(() => 0);
    await logger.close();
    fs.rmSync(dir, { recursive: true, force: true });
  };
  return { stdin, stdout, logger, exit: h.exit, cleanup };
}

function readEntries(file: string): LogEntry[] {
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as LogEntry);
}

test("parseSummary records a raw field for a JSON primitive line", async (t) => {
  const ctx = startEchoProxy();
  t.after(() => ctx.cleanup());

  // "42" is valid JSON but not an object — parseSummary should record `raw`.
  ctx.stdin.write("42\n");
  await new Promise((r) => setTimeout(r, 100));

  const entries = readEntries(ctx.logger.filePath());
  const out = entries.find((e) => e.direction === "out");
  assert.ok(out);
  assert.equal(out.raw, "42");
});

test("parseSummary records a raw field for malformed JSON", async (t) => {
  const ctx = startEchoProxy();
  t.after(() => ctx.cleanup());

  ctx.stdin.write("{ not json\n");
  await new Promise((r) => setTimeout(r, 100));

  const entries = readEntries(ctx.logger.filePath());
  const out = entries.find((e) => e.direction === "out");
  assert.ok(out);
  assert.match(out.raw ?? "", /not json/);
});

test("pipeLines flushes trailing bytes without a newline when the stream ends", async (t) => {
  const ctx = startEchoProxy();
  t.after(() => ctx.cleanup());

  ctx.stdin.write("trailing-no-newline");
  ctx.stdin.end();
  await ctx.exit.catch(() => 0);

  const entries = readEntries(ctx.logger.filePath());
  // The flushed line shows up as an outgoing entry with `raw` set.
  assert.ok(entries.some((e) => e.direction === "out" && e.raw === "trailing-no-newline"));
});

test("spawn error path logs a system entry when the binary doesn't exist", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wardn-proxy-err-"));
  const log = path.join(dir, "gateway.log");
  const logger = new Logger(log);
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const h = startProxy({
    serverName: "missing",
    command: path.join(dir, "does-not-exist.exe"),
    args: [],
    logger,
    input: stdin,
    output: stdout,
  });
  t.after(async () => {
    if (!h.child.killed) h.child.kill();
    await h.exit.catch(() => 0);
    await logger.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await h.exit.catch(() => 0);
  // Give the error listener a moment to flush.
  await new Promise((r) => setTimeout(r, 100));
  const entries = readEntries(log);
  assert.ok(
    entries.some((e) => e.direction === "system" && /spawn error/i.test(e.message ?? "")),
    `expected a "spawn error" system entry, got ${JSON.stringify(entries)}`,
  );
});
