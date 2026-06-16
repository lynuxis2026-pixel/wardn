import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { knownClientLocations } from "../discovery/clients.js";

export const DEFAULT_INVOKE_TEMPLATE = "npx -y @ludicolijn/wardn gateway run {name}";

interface RewriteIndexEntry {
  client: string;
  configFile: string;
  backupFile: string;
  timestamp: string;
  serversKey: string;
  /** Names of servers we redirected, for human readability. */
  servers: string[];
}

interface RewriteIndex {
  version: 1;
  entries: RewriteIndexEntry[];
}

function wardnHome(): string {
  return process.env.WARDN_HOME ?? path.join(os.homedir(), ".wardn");
}

function indexPath(): string {
  return path.join(wardnHome(), "rewrites.json");
}

function readIndex(): RewriteIndex {
  try {
    const txt = fs.readFileSync(indexPath(), "utf8");
    const parsed = JSON.parse(txt) as Partial<RewriteIndex>;
    if (parsed && Array.isArray(parsed.entries)) {
      return { version: 1, entries: parsed.entries };
    }
  } catch {
    /* missing or unreadable — start empty */
  }
  return { version: 1, entries: [] };
}

function writeIndex(idx: RewriteIndex): void {
  fs.mkdirSync(path.dirname(indexPath()), { recursive: true });
  fs.writeFileSync(indexPath(), JSON.stringify(idx, null, 2) + "\n");
}

function tokenizeTemplate(template: string, name: string): { command: string; args: string[] } {
  const expanded = template.replace(/\{name\}/g, name);
  const parts = expanded.split(/\s+/).filter(Boolean);
  const [command, ...args] = parts;
  if (!command) throw new Error(`invoke template must produce a non-empty command: ${template}`);
  return { command, args };
}

interface RewriteTarget {
  client: string;
  file: string;
  serversKey: "mcpServers" | "servers";
}

function listTargets(fromDir?: string, clientFilter?: string): RewriteTarget[] {
  if (fromDir) {
    const out: RewriteTarget[] = [];
    let entries: string[];
    try {
      entries = fs.readdirSync(fromDir).filter((f) => f.endsWith(".json"));
    } catch {
      return [];
    }
    for (const f of entries) {
      const client = path.basename(f, ".json").replace(/[_-]?config$/i, "").replace(/[_-]?mcp$/i, "");
      out.push({ client: client || "unknown", file: path.join(fromDir, f), serversKey: "mcpServers" });
    }
    return clientFilter ? out.filter((t) => t.client === clientFilter) : out;
  }
  /* c8 ignore start — the no-`from` path enumerates real client configs on
     the user's machine; tests always pass `--from` to avoid touching real
     state. The behaviour is verified via the `--from` path which exercises
     the same map/filter logic. */
  const locs = knownClientLocations();
  const targets = locs
    .filter((l) => fs.existsSync(l.file))
    .map<RewriteTarget>((l) => ({ client: l.client, file: l.file, serversKey: l.serversKey }));
  return clientFilter ? targets.filter((t) => t.client === clientFilter) : targets;
  /* c8 ignore stop */
}

interface ApplyOptions {
  client?: string;
  from?: string;
  invokeTemplate?: string;
  /** Preview mode — describe the changes but do not touch any file on disk. */
  dryRun?: boolean;
}

export interface ApplyResult {
  applied: Array<{ client: string; file: string; backup: string; servers: string[]; dryRun?: true }>;
  skipped: Array<{ client: string; file: string; reason: string }>;
}

export function applyRewrite(opts: ApplyOptions = {}): ApplyResult {
  const template = opts.invokeTemplate ?? DEFAULT_INVOKE_TEMPLATE;
  const targets = listTargets(opts.from, opts.client);
  const applied: ApplyResult["applied"] = [];
  const skipped: ApplyResult["skipped"] = [];
  const idx = readIndex();

  const tsStamp = process.env.WARDN_TIMESTAMP ?? new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(wardnHome(), "backups");
  if (!opts.dryRun) fs.mkdirSync(backupRoot, { recursive: true });

  for (const target of targets) {
    if (idx.entries.some((e) => e.configFile === target.file)) {
      skipped.push({ client: target.client, file: target.file, reason: "already rewritten — restore first" });
      continue;
    }
    let raw: string;
    try {
      raw = fs.readFileSync(target.file, "utf8");
    } catch (err) {
      skipped.push({ client: target.client, file: target.file, reason: `unreadable: ${(err as Error).message}` });
      continue;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      skipped.push({ client: target.client, file: target.file, reason: "not valid JSON" });
      continue;
    }
    const map = parsed[target.serversKey] as Record<string, Record<string, unknown>> | undefined;
    if (!map || typeof map !== "object") {
      skipped.push({ client: target.client, file: target.file, reason: `no "${target.serversKey}" map in config` });
      continue;
    }

    const backupFile = path.join(backupRoot, `${target.client}-${tsStamp}.json`);
    if (!opts.dryRun) fs.writeFileSync(backupFile, raw);

    const touched: string[] = [];
    for (const [name, entry] of Object.entries(map)) {
      if (!entry || typeof entry !== "object") continue;
      // Skip remote (url-based) servers — wardn gateway only proxies stdio today.
      if (typeof entry.url === "string") continue;
      const { command, args } = tokenizeTemplate(template, name);
      map[name] = { command, args };
      touched.push(name);
    }

    if (opts.dryRun) {
      applied.push({ client: target.client, file: target.file, backup: backupFile, servers: touched, dryRun: true });
      continue;
    }

    fs.writeFileSync(target.file, JSON.stringify(parsed, null, 2) + "\n");

    idx.entries.push({
      client: target.client,
      configFile: target.file,
      backupFile,
      timestamp: tsStamp,
      serversKey: target.serversKey,
      servers: touched,
    });
    applied.push({ client: target.client, file: target.file, backup: backupFile, servers: touched });
  }

  if (!opts.dryRun) writeIndex(idx);
  return { applied, skipped };
}

interface RestoreOptions {
  client?: string;
  from?: string;
}

export interface RestoreResult {
  restored: Array<{ client: string; file: string; backup: string }>;
  skipped: Array<{ client: string; file: string; reason: string }>;
}

export function restoreRewrite(opts: RestoreOptions = {}): RestoreResult {
  const idx = readIndex();
  const restored: RestoreResult["restored"] = [];
  const skipped: RestoreResult["skipped"] = [];
  const remaining: RewriteIndexEntry[] = [];

  // When --from is provided, only restore entries whose configFile lives in
  // that directory; this keeps test runs from touching the real machine.
  const fromAbs = opts.from ? path.resolve(opts.from) : undefined;

  for (const entry of idx.entries) {
    const matchesClient = !opts.client || entry.client === opts.client;
    const matchesFrom = !fromAbs || path.dirname(path.resolve(entry.configFile)) === fromAbs;
    if (!matchesClient || !matchesFrom) {
      remaining.push(entry);
      continue;
    }
    try {
      const backup = fs.readFileSync(entry.backupFile, "utf8");
      fs.writeFileSync(entry.configFile, backup);
      /* c8 ignore start — best-effort cleanup; we still report success because
         the config WAS restored. The fallback exists for sandboxed environments
         where backup files are read-only after copy. */
      try {
        fs.unlinkSync(entry.backupFile);
      } catch {
        /* leave the backup if we can't unlink */
      }
      /* c8 ignore stop */
      restored.push({ client: entry.client, file: entry.configFile, backup: entry.backupFile });
    } catch (err) {
      skipped.push({ client: entry.client, file: entry.configFile, reason: (err as Error).message });
      remaining.push(entry);
    }
  }

  writeIndex({ version: 1, entries: remaining });
  return { restored, skipped };
}

export function rewriteStatus(): RewriteIndex {
  return readIndex();
}
