import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { Logger, LogEntry } from "./logger.js";
import { resolveCommand } from "./resolve-command.js";

export interface OutgoingEnforcerResult {
  allow?: true;
  reject?: { response: object };
}

export interface ProxyEnforcer {
  decide(line: string): OutgoingEnforcerResult;
}

export interface ProxyConfig {
  serverName: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  logger: Logger;
  /** Stream the client writes JSON-RPC into (defaults to process.stdin). */
  input?: NodeJS.ReadableStream;
  /** Stream the server's JSON-RPC is forwarded onto (defaults to process.stdout). */
  output?: NodeJS.WritableStream;
  /** Optional gatekeeper for outgoing (client→server) messages. */
  enforcer?: ProxyEnforcer;
  /**
   * If true the spawned process gets exactly `env` instead of inheriting from
   * the parent. Used by sandbox policy to drop ambient env vars.
   */
  replaceEnv?: boolean;
}

export interface ProxyHandle {
  child: ChildProcessWithoutNullStreams;
  /** Resolves with the child's exit code (0 if it exited cleanly). */
  exit: Promise<number>;
}

interface MessageSummary {
  method?: string;
  id?: string | number | null;
  isResponse?: boolean;
  isError?: boolean;
  paramKeys?: string[];
  raw?: string;
}

function parseSummary(line: string): MessageSummary {
  const trimmed = line.trim();
  if (!trimmed) return {};
  try {
    const json: unknown = JSON.parse(trimmed);
    if (typeof json !== "object" || json === null) {
      return { raw: trimmed.slice(0, 200) };
    }
    const msg = json as Record<string, unknown>;
    const summary: MessageSummary = {};
    if (typeof msg.method === "string") summary.method = msg.method;
    if (msg.id !== undefined) {
      if (typeof msg.id === "string" || typeof msg.id === "number" || msg.id === null) {
        summary.id = msg.id;
      }
    }
    if (msg.result !== undefined || msg.error !== undefined) summary.isResponse = true;
    if (msg.error !== undefined) summary.isError = true;
    if (msg.params && typeof msg.params === "object" && !Array.isArray(msg.params)) {
      summary.paramKeys = Object.keys(msg.params as Record<string, unknown>);
    }
    return summary;
  } catch {
    return { raw: trimmed.slice(0, 200) };
  }
}

/**
 * Splits a Readable stream into newline-terminated chunks without losing the
 * raw bytes. The proxy forwards `raw` verbatim and feeds `line` (utf-8) to the
 * JSON parser for logging.
 */
function pipeLines(
  stream: NodeJS.ReadableStream,
  onLine: (line: string, raw: Buffer) => void,
  onEnd?: () => void,
): void {
  let buffer: Buffer = Buffer.alloc(0);
  stream.on("data", (chunk: Buffer | string) => {
    const buf: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    buffer = buffer.length === 0 ? buf : (Buffer.concat([buffer, buf]) as Buffer);
    let idx = buffer.indexOf(0x0a); // \n
    while (idx !== -1) {
      const raw: Buffer = buffer.subarray(0, idx + 1);
      buffer = buffer.subarray(idx + 1);
      onLine(raw.toString("utf8"), raw);
      idx = buffer.indexOf(0x0a);
    }
  });
  stream.on("end", () => {
    if (buffer.length > 0) {
      onLine(buffer.toString("utf8"), buffer);
      buffer = Buffer.alloc(0);
    }
    onEnd?.();
  });
}

/**
 * Spawn an MCP server and proxy its stdio. Bytes are forwarded verbatim in
 * both directions so the wire format stays identical; a separate JSON parse
 * runs alongside purely to drive the log.
 */
export function startProxy(cfg: ProxyConfig): ProxyHandle {
  const input = cfg.input ?? process.stdin;
  const output = cfg.output ?? process.stdout;

  const spawnEnv: Record<string, string | undefined> = cfg.replaceEnv
    ? { ...(cfg.env ?? {}) }
    : { ...process.env, ...(cfg.env ?? {}) };

  // resolveCommand() finds .cmd/.bat shims on Windows so we never need
  // shell:true (which would trigger Node 22's DEP0190).
  const child = spawn(resolveCommand(cfg.command), cfg.args, {
    env: spawnEnv,
    cwd: cfg.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  }) as ChildProcessWithoutNullStreams;

  /** Track outgoing requests so we can attach durations to responses. */
  const pending = new Map<string | number, number>();

  const baseEntry = (direction: LogEntry["direction"]): Pick<LogEntry, "ts" | "server" | "direction"> => ({
    ts: new Date().toISOString(),
    server: cfg.serverName,
    direction,
  });

  // client → server
  pipeLines(input, (line, raw) => {
    const decision = cfg.enforcer?.decide(line);
    if (decision?.reject) {
      const responseLine = JSON.stringify(decision.reject.response) + "\n";
      output.write(responseLine);
      const summary = parseSummary(line);
      cfg.logger.append({
        ...baseEntry("system"),
        method: summary.method,
        id: summary.id,
        message: `blocked by sandbox policy`,
      });
      cfg.logger.append({
        ...baseEntry("in"),
        ...parseSummary(responseLine),
        isResponse: true,
        isError: true,
      });
      return;
    }
    if (!child.stdin.destroyed) child.stdin.write(raw);
    const summary = parseSummary(line);
    if (summary.method && summary.id !== undefined && summary.id !== null) {
      pending.set(summary.id, Date.now());
    }
    cfg.logger.append({ ...baseEntry("out"), ...summary });
  }, () => {
    if (!child.stdin.destroyed) child.stdin.end();
  });

  // server → client
  pipeLines(child.stdout, (line, raw) => {
    output.write(raw);
    const summary = parseSummary(line);
    let durationMs: number | undefined;
    if (summary.isResponse && summary.id !== undefined && summary.id !== null) {
      const start = pending.get(summary.id);
      if (start !== undefined) {
        durationMs = Date.now() - start;
        pending.delete(summary.id);
      }
    }
    cfg.logger.append({ ...baseEntry("in"), ...summary, ...(durationMs !== undefined ? { durationMs } : {}) });
  });

  // Surface server stderr — clients sometimes rely on it for diagnostics, and
  // swallowing it would hide real problems.
  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });

  child.on("error", (err) => {
    cfg.logger.append({
      ...baseEntry("system"),
      message: `spawn error: ${err instanceof Error ? err.message : String(err)}`,
    });
  });

  const exit = new Promise<number>((resolve) => {
    child.on("exit", (code) => resolve(code ?? 0));
  });

  return { child, exit };
}
