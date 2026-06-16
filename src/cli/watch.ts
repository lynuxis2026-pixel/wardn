import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import pc from "picocolors";
import { discoverFromDir, discoverFromKnownClients } from "../discovery/index.js";
import { scanAll } from "../scanner/index.js";
import { PolicyStore } from "../sandbox/store.js";
import type { McpServer, ScanResult, TrustLevel } from "../types.js";

interface Snapshot {
  takenAt: string;
  servers: Record<string, { level: TrustLevel; signalIds: string[]; client: string }>;
}

function snapshotKey(s: McpServer): string {
  return `${s.client}::${s.name}`;
}

function snapshotFile(): string {
  const home = process.env.WARDN_HOME ?? path.join(os.homedir(), ".wardn");
  return path.join(home, "scan-snapshot.json");
}

function readSnapshot(): Snapshot | undefined {
  try {
    const txt = fs.readFileSync(snapshotFile(), "utf8");
    const parsed = JSON.parse(txt) as Snapshot;
    if (parsed && typeof parsed === "object" && parsed.servers) return parsed;
  } catch {
    /* missing */
  }
  return undefined;
}

function writeSnapshot(snap: Snapshot): void {
  fs.mkdirSync(path.dirname(snapshotFile()), { recursive: true });
  fs.writeFileSync(snapshotFile(), JSON.stringify(snap, null, 2) + "\n");
}

function buildSnapshot(results: ScanResult[]): Snapshot {
  const servers: Snapshot["servers"] = {};
  for (const r of results) {
    servers[snapshotKey(r.server)] = {
      level: r.level,
      signalIds: r.signals.map((s) => s.id).sort(),
      client: r.server.client,
    };
  }
  return { takenAt: new Date().toISOString(), servers };
}

export interface ScanDiff {
  added: Array<{ key: string; level: TrustLevel }>;
  removed: Array<{ key: string; level: TrustLevel }>;
  changed: Array<{ key: string; from: TrustLevel; to: TrustLevel }>;
  newRisky: string[];
}

export function diffSnapshots(prev: Snapshot | undefined, next: Snapshot): ScanDiff {
  const diff: ScanDiff = { added: [], removed: [], changed: [], newRisky: [] };
  const prevKeys = new Set(prev ? Object.keys(prev.servers) : []);
  const nextKeys = new Set(Object.keys(next.servers));
  for (const k of nextKeys) {
    if (!prevKeys.has(k)) {
      diff.added.push({ key: k, level: next.servers[k].level });
      if (next.servers[k].level === "risky") diff.newRisky.push(k);
    } else {
      const a = prev!.servers[k];
      const b = next.servers[k];
      if (a.level !== b.level) {
        diff.changed.push({ key: k, from: a.level, to: b.level });
        if (b.level === "risky" && a.level !== "risky") diff.newRisky.push(k);
      }
    }
  }
  for (const k of prevKeys) {
    if (!nextKeys.has(k)) {
      diff.removed.push({ key: k, level: prev!.servers[k].level });
    }
  }
  return diff;
}

export interface WatchOptions {
  /** Run once, don't loop. Used by CI and tests. */
  once?: boolean;
  /** Seconds between scans in loop mode. */
  intervalSec?: number;
  /** Fixture directory; falls back to real client configs. */
  from?: string;
}

function tone(level: TrustLevel): (s: string) => string {
  if (level === "risky") return pc.red;
  if (level === "review") return pc.yellow;
  return pc.green;
}

function printDiff(diff: ScanDiff): void {
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
    process.stdout.write("  " + pc.dim("no change since last snapshot") + "\n");
    return;
  }
  for (const a of diff.added) {
    process.stdout.write(`  ${pc.green("+")} ${pc.bold(a.key)} ${tone(a.level)("[" + a.level.toUpperCase() + "]")}\n`);
  }
  for (const c of diff.changed) {
    process.stdout.write(`  ${pc.cyan("~")} ${pc.bold(c.key)} ${tone(c.from)(c.from)} → ${tone(c.to)(c.to)}\n`);
  }
  for (const r of diff.removed) {
    process.stdout.write(`  ${pc.dim("-")} ${pc.bold(r.key)} ${pc.dim("(was " + r.level + ")")}\n`);
  }
}

/** Single tick — pure-ish: writes a snapshot and returns the diff for inspection. */
export function watchOnce(opts: WatchOptions = {}): { diff: ScanDiff; results: ScanResult[] } {
  const servers = opts.from ? discoverFromDir(opts.from) : discoverFromKnownClients();
  const policies = new PolicyStore().read().servers;
  const results = scanAll(servers, policies);
  const next = buildSnapshot(results);
  const prev = readSnapshot();
  const diff = diffSnapshots(prev, next);
  writeSnapshot(next);
  return { diff, results };
}

export async function runWatch(opts: WatchOptions): Promise<number> {
  const intervalMs = Math.max(1, opts.intervalSec ?? 30) * 1000;

  const tick = (): { newRisky: number } => {
    const stamp = new Date().toLocaleTimeString();
    process.stdout.write("\n" + pc.bold("wardn watch") + pc.dim(` — ${stamp}`) + "\n\n");
    const { diff } = watchOnce(opts);
    printDiff(diff);
    if (diff.newRisky.length > 0) {
      process.stdout.write(
        "\n  " + pc.red("⚠  new risky server") + pc.red(diff.newRisky.length === 1 ? "" : "s") + ": " +
          diff.newRisky.join(", ") + "\n",
      );
    }
    return { newRisky: diff.newRisky.length };
  };

  const first = tick();
  if (opts.once) return first.newRisky > 0 ? 1 : 0;

  process.stdout.write("\n" + pc.dim(`  re-scanning every ${opts.intervalSec ?? 30}s. Ctrl+C to stop.`) + "\n");
  await new Promise<void>(() => {
    const id = setInterval(tick, intervalMs);
    const stop = (): void => {
      clearInterval(id);
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
  return 0;
}
