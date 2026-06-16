import path from "node:path";
import type { McpServer } from "../types.js";
import type { ServerPolicy } from "./types.js";

export type ServerKind = "filesystem" | "github" | "fetch" | "memory" | "puppeteer" | "unknown";

/** Always allow these env vars through — they are required for any process to function. */
const BASELINE_ENV: ReadonlyArray<string> = [
  "PATH",
  "PATHEXT",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "USER",
  "USERNAME",
  "SystemRoot",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "ComSpec",
  "COMSPEC",
  "OS",
  "NODE_PATH",
  "NODE_OPTIONS",
  "PWD",
];

/** Returns the first non-flag arg after the launcher — same heuristic the scanner uses. */
function packageArg(server: McpServer): string | undefined {
  const launcher = path.basename(server.command ?? "").toLowerCase();
  if (!["npx", "uvx", "bunx"].includes(launcher)) return undefined;
  for (const a of server.args) {
    if (a.startsWith("-")) continue;
    return a;
  }
  return undefined;
}

export function identifyKind(server: McpServer): ServerKind {
  const pkg = packageArg(server) ?? "";
  if (pkg.includes("server-filesystem")) return "filesystem";
  if (pkg.includes("server-github")) return "github";
  if (pkg.includes("server-fetch")) return "fetch";
  if (pkg.includes("server-memory")) return "memory";
  if (pkg.includes("server-puppeteer")) return "puppeteer";
  return "unknown";
}

export interface SpawnRewrite {
  command: string;
  args: string[];
  env: Record<string, string>;
  /** Human-readable summary of what was changed, for logging + UI. */
  changes: string[];
}

function filterEnv(serverEnv: Record<string, string>, whitelist: string[]): { env: Record<string, string>; stripped: string[] } {
  const allowed = new Set<string>([...BASELINE_ENV, ...whitelist]);
  const env: Record<string, string> = {};
  const stripped: string[] = [];
  for (const [k, v] of Object.entries(serverEnv)) {
    if (allowed.has(k)) env[k] = v;
    else stripped.push(k);
  }
  return { env, stripped };
}

/**
 * Rewrite a server's spawn config to fit the policy. Today this only knows
 * how to retarget the filesystem MCP server (its positional args are the
 * allowed directories); for other server kinds we still filter env vars.
 */
export function applySpawnPolicy(server: McpServer, policy: ServerPolicy): SpawnRewrite {
  const changes: string[] = [];
  const command = server.command ?? "";
  let args = [...server.args];

  if (identifyKind(server) === "filesystem") {
    // Args layout: [..flags, "@modelcontextprotocol/server-filesystem", ...paths]
    const pkgIndex = args.findIndex((a) => a.includes("server-filesystem"));
    if (pkgIndex !== -1) {
      const head = args.slice(0, pkgIndex + 1);
      const before = args.slice(pkgIndex + 1);
      args = [...head, ...policy.filesystem.paths];
      if (JSON.stringify(before) !== JSON.stringify(policy.filesystem.paths)) {
        changes.push(`filesystem paths: ${before.join(", ") || "(none)"} → ${policy.filesystem.paths.join(", ") || "(none)"}`);
      }
    }
  }

  const { env, stripped } = filterEnv(server.env, policy.envWhitelist);
  if (stripped.length > 0) changes.push(`env stripped: ${stripped.join(", ")}`);

  return { command, args, env, changes };
}

export interface OutgoingDecision {
  /** Forward verbatim to the server. */
  allow?: true;
  /** Reject the call. The proxy will write `response` back to the client and skip the server. */
  reject?: {
    response: object;
  };
}

const PATH_FIELDS = new Set(["path", "source", "destination", "target", "filepath", "file_path", "from", "to"]);

/**
 * Tokens that almost always grant arbitrary code/command execution. A tool
 * name containing any of these as a *separate token* (snake / kebab / colon /
 * camelCase) is default-denied when the policy is active.
 */
const DANGEROUS_TOKENS: ReadonlySet<string> = new Set([
  "shell",
  "exec",
  "run",
  "spawn",
  "eval",
  "command",
  "cmd",
  "process",
  "system",
]);

function tokenizeToolName(name: string): string[] {
  // First split snake/kebab/colon boundaries…
  const rough = name.split(/[_\-:]/);
  // …then split each chunk on lowercase→Uppercase boundaries (camelCase).
  const out: string[] = [];
  for (const chunk of rough) {
    for (const piece of chunk.split(/(?<=[a-z])(?=[A-Z])/)) {
      out.push(piece.toLowerCase());
    }
  }
  return out;
}

function looksDangerous(name: string): boolean {
  for (const tok of tokenizeToolName(name)) {
    if (DANGEROUS_TOKENS.has(tok)) return true;
  }
  return false;
}

/** Strings that look like a URL anywhere in a tool's arguments. */
const URL_RE = /\b(?:https?|wss?|ftp):\/\/[^\s"'<>]+/i;

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out);
  }
}

function collectPathsRecursive(value: unknown, out: string[], inPathContext: boolean): void {
  if (typeof value === "string") {
    if (!inPathContext) return;
    if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("file://")) {
      const cleaned = value.startsWith("file://")
        ? decodeURIComponent(value.slice("file://".length).replace(/^\/+([A-Za-z]:)/, "$1"))
        : value;
      out.push(cleaned);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectPathsRecursive(v, out, inPathContext);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lc = k.toLowerCase();
      const isPathKey = PATH_FIELDS.has(lc) || lc === "paths" || lc === "uris";
      // Always recurse: a path-named field can live arbitrarily deep. We only
      // *collect* string values that sit under a path-named key, so freeform
      // text in `description`/`message`/etc. doesn't accidentally trigger.
      collectPathsRecursive(v, out, inPathContext || isPathKey);
    }
  }
}

function collectPaths(value: unknown, out: string[]): void {
  collectPathsRecursive(value, out, false);
}

function normalizeForCompare(p: string): string {
  const resolved = path.resolve(p);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function pathInsideAny(target: string, allowed: string[]): boolean {
  if (allowed.length === 0) return false;
  const t = normalizeForCompare(target);
  for (const a of allowed) {
    const n = normalizeForCompare(a);
    if (t === n) return true;
    const sep = n.endsWith(path.sep) ? n : n + path.sep;
    if (t.startsWith(sep)) return true;
  }
  return false;
}

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

/**
 * Inspect an outgoing JSON-RPC line and decide whether it may proceed under
 * the policy. We only look at `tools/call` today; other methods pass through.
 */
export function decideOutgoing(line: string, policy: ServerPolicy): OutgoingDecision {
  if (!policy.enabled) return { allow: true };
  const trimmed = line.trim();
  if (!trimmed) return { allow: true };
  let msg: JsonRpcMessage;
  try {
    msg = JSON.parse(trimmed) as JsonRpcMessage;
  } catch {
    return { allow: true };
  }
  if (msg.method !== "tools/call") return { allow: true };
  if (!msg.params || typeof msg.params !== "object") return { allow: true };
  const params = msg.params as { name?: string; arguments?: unknown };

  // Default-deny tools whose name advertises arbitrary execution. A sandboxed
  // server has no reason to expose shell_exec / run / spawn — if it does, we
  // refuse before looking at the arguments. Devs can opt in per-tool via
  // policy.allowedTools.
  if (typeof params.name === "string" && looksDangerous(params.name)) {
    const allowed = policy.allowedTools?.includes(params.name);
    if (!allowed) {
      return {
        reject: {
          response: errorResponse(
            msg.id ?? null,
            `wardn: tool "${params.name}" matches a dangerous-tool pattern and is blocked by the sandbox policy for "${policy.name}". Add it to policy.allowedTools to override.`,
          ),
        },
      };
    }
  }

  // Network gating: when network is off, refuse any tool-call whose arguments
  // (anywhere in the structure) contain a URL. Real attackers won't always
  // put it in a field called "url".
  if (!policy.network) {
    const strings: string[] = [];
    collectStrings(params.arguments, strings);
    for (const s of strings) {
      const m = s.match(URL_RE);
      if (m) {
        return {
          reject: {
            response: errorResponse(
              msg.id ?? null,
              `wardn: network is disabled for "${policy.name}" — blocked tool-call referencing ${m[0]}`,
            ),
          },
        };
      }
    }
  }

  const found: string[] = [];
  collectPaths(params.arguments, found);

  for (const p of found) {
    if (!pathInsideAny(p, policy.filesystem.paths)) {
      return {
        reject: {
          response: errorResponse(
            msg.id ?? null,
            `wardn: path "${p}" is outside the sandbox policy for "${policy.name}". Allowed: ${policy.filesystem.paths.join(", ") || "(none)"}`,
          ),
        },
      };
    }
  }

  return { allow: true };
}

function errorResponse(id: string | number | null, message: string): object {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: message }],
      isError: true,
    },
  };
}
