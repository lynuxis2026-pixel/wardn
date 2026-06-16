import os from "node:os";
import path from "node:path";
import type { McpServer, Signal } from "../types.js";

const KNOWN_LAUNCHERS = new Set([
  "npx",
  "uvx",
  "uv",
  "node",
  "python",
  "python3",
  "deno",
  "bunx",
  "bun",
  "docker",
]);

const SHELLS = new Set(["sh", "bash", "zsh", "fish", "cmd", "cmd.exe", "powershell", "pwsh"]);

const OFFICIAL_SCOPES = ["@modelcontextprotocol/"];

function baseName(cmd?: string): string {
  if (!cmd) return "";
  return path.basename(cmd).toLowerCase();
}

/** Returns the package-ish arg for a launcher (first non-flag token after the launcher). */
function packageArg(server: McpServer): string | undefined {
  const launcher = baseName(server.command);
  if (!["npx", "uvx", "bunx"].includes(launcher)) return undefined;
  for (const a of server.args) {
    if (a.startsWith("-")) continue; // skip flags like -y
    return a;
  }
  return undefined;
}

export function isBroadPath(p: string): boolean {
  const home = os.homedir();
  const normalized = path.normalize(p);
  if (normalized === "/" || normalized === "\\") return true;
  if (normalized === home) return true;
  // A bare top-level directory like /Users, /home, C:\ etc.
  const depth = normalized.split(/[\\/]/).filter(Boolean).length;
  if (path.isAbsolute(normalized) && depth <= 1) return true;
  return false;
}

type Rule = (s: McpServer) => Signal | null;

const ruleBroadFilesystem: Rule = (s) => {
  for (const a of s.args) {
    if ((a.startsWith("/") || /^[A-Za-z]:[\\/]/.test(a)) && isBroadPath(a)) {
      return { id: "broad-fs", severity: "risky", reason: `Broad filesystem access granted: "${a}"` };
    }
  }
  return null;
};

const ruleShellExec: Rule = (s) => {
  if (SHELLS.has(baseName(s.command))) {
    return { id: "shell-exec", severity: "risky", reason: `Runs a raw shell (${baseName(s.command)}) — can execute arbitrary commands` };
  }
  return null;
};

const ruleArbitraryBinary: Rule = (s) => {
  const b = baseName(s.command);
  if (!b || s.transport === "remote") return null;
  if (KNOWN_LAUNCHERS.has(b) || SHELLS.has(b)) return null;
  return { id: "arbitrary-binary", severity: "review", reason: `Unrecognized launcher: "${s.command}"` };
};

const ruleFloatingVersion: Rule = (s) => {
  const pkg = packageArg(s);
  if (!pkg) return null;
  // Official servers are conventionally run unpinned (npx -y) — flagging them is noise.
  if (OFFICIAL_SCOPES.some((sc) => pkg.startsWith(sc))) return null;
  // strip leading scope @ before looking for a version pin
  const withoutScope = pkg.startsWith("@") ? pkg.slice(1) : pkg;
  const pinned = withoutScope.includes("@") && !/@latest$/i.test(pkg);
  if (!pinned) {
    return { id: "floating-version", severity: "review", reason: `Unpinned package version (${pkg}) — supply-chain risk` };
  }
  return null;
};

const ruleUnofficialSource: Rule = (s) => {
  const pkg = packageArg(s);
  if (!pkg) return null;
  if (OFFICIAL_SCOPES.some((sc) => pkg.startsWith(sc))) return null;
  return { id: "unofficial-source", severity: "review", reason: `Unverified source (${pkg})` };
};

const ruleRemoteTransport: Rule = (s) => {
  if (s.transport !== "remote" || !s.url) return null;
  let host = s.url;
  try {
    host = new URL(s.url).host;
  } catch {
    /* keep raw */
  }
  return { id: "remote", severity: "review", reason: `Remote server — data leaves your machine (${host})` };
};

const ruleSecretsInEnv: Rule = (s) => {
  const keys = Object.keys(s.env).filter((k) => /(_?KEY|TOKEN|SECRET|PASSWORD|PASSWD|API)/i.test(k));
  if (keys.length === 0) return null;
  return { id: "holds-secrets", severity: "info", reason: `Holds credentials (${keys.join(", ")}) — exfiltration surface` };
};

const ruleOfficial: Rule = (s) => {
  const pkg = packageArg(s);
  if (pkg && OFFICIAL_SCOPES.some((sc) => pkg.startsWith(sc))) {
    return { id: "official", severity: "info", reason: "Official Model Context Protocol server" };
  }
  return null;
};

export const RULES: Rule[] = [
  ruleBroadFilesystem,
  ruleShellExec,
  ruleArbitraryBinary,
  ruleFloatingVersion,
  ruleUnofficialSource,
  ruleRemoteTransport,
  ruleSecretsInEnv,
  ruleOfficial,
];
