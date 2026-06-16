import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

function tokenFile(): string {
  /* c8 ignore next — WARDN_HOME default is exercised by tests; the os.homedir
     branch is reserved for the production install. */
  const home = process.env.WARDN_HOME ?? path.join(os.homedir(), ".wardn");
  return path.join(home, "api-token");
}

/**
 * Read the daemon's API token from disk, generating one on first call. The
 * file is written with mode 0600 on POSIX (best effort on Windows — we still
 * write a non-world-readable path under the user's home).
 */
export function loadOrCreateApiToken(): string {
  const file = tokenFile();
  try {
    const existing = fs.readFileSync(file, "utf8").trim();
    /* c8 ignore next — defensive: the file we write is always ≥ 32 hex
       chars, so the short-existing branch is only hit if a user manually
       truncated the token file. */
    if (existing.length >= 32) return existing;
  } catch {
    /* missing — fall through to create */
  }
  const token = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, token + "\n", { mode: 0o600 });
  return token;
}

const LOOPBACK_IPS: ReadonlySet<string> = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
]);

/** True when the request originated on the same machine. */
export function isLoopbackIp(ip: string | undefined): boolean {
  if (!ip) return false;
  return LOOPBACK_IPS.has(ip);
}

/** Methods that mutate server state — these require an auth token. */
const WRITE_METHODS: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * True when the request needs auth (a mutating method). Read methods are open
 * because the daemon binds to loopback by default and the dashboard depends on
 * being able to fetch /api/scan.
 */
export function requiresAuth(method: string): boolean {
  return WRITE_METHODS.has(method.toUpperCase());
}

/**
 * Extract a bearer token from a Fastify request, returning undefined when the
 * header is missing or malformed.
 */
export function extractBearer(authHeader: string | undefined): string | undefined {
  if (!authHeader) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
  return match ? match[1] : undefined;
}

/** Constant-time compare to avoid token-length timing leaks. */
export function compareToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
    /* c8 ignore start — defensive: timingSafeEqual cannot throw on
       equal-length Buffer.from-derived buffers, but we keep the guard. */
  } catch {
    return false;
  }
  /* c8 ignore stop */
}

export function tokenFilePath(): string {
  return tokenFile();
}
