import { spawnSync } from "node:child_process";
import path from "node:path";
import type { ServerPolicy } from "./types.js";
import type { SpawnRewrite } from "./enforce.js";
import { resolveCommand } from "../gateway/resolve-command.js";

let cachedAvailability: boolean | undefined;

/**
 * Probe `bwrap --version` once per process. Bubblewrap is Linux-only
 * (kernel-namespace based). On macOS / Windows we treat it as unavailable.
 */
export function isBubblewrapAvailable(): boolean {
  if (cachedAvailability !== undefined) return cachedAvailability;
  if (process.platform !== "linux") {
    cachedAvailability = false;
    return false;
  }
  /* c8 ignore start — bwrap probe runs only on Linux with the binary
     installed. Argument-builder branches are exercised via
     _setBubblewrapAvailableForTests. */
  try {
    const res = spawnSync(resolveCommand("bwrap"), ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 3_000,
    });
    cachedAvailability = res.status === 0 && !!res.stdout?.toString().trim();
  } catch {
    cachedAvailability = false;
  }
  return cachedAvailability;
  /* c8 ignore stop */
}

/**
 * Wrap a SpawnRewrite so it runs inside a bubblewrap sandbox.
 *
 * - Filesystem: bind-mounts each policy path read-write, the rest of `/` as
 *   read-only (so the process can still read its own libs / node binary).
 * - Network: `--unshare-net` revokes network namespace access entirely when
 *   `policy.network: false`.
 * - PID + IPC namespaces are unshared by default.
 *
 * Returns the original rewrite unchanged when bwrap is not available. Callers
 * should surface a notice once before relying on this transform.
 */
export function bubblewrapSpawn(rewrite: SpawnRewrite, policy: ServerPolicy): SpawnRewrite {
  if (!isBubblewrapAvailable()) return rewrite;

  const args: string[] = [
    "--die-with-parent",
    "--unshare-pid",
    "--unshare-ipc",
    "--unshare-uts",
    "--proc", "/proc",
    "--dev", "/dev",
    "--ro-bind", "/usr", "/usr",
    "--ro-bind", "/bin", "/bin",
    "--ro-bind", "/lib", "/lib",
  ];

  // lib64 only exists on 64-bit distros; bwrap fails hard on a missing path.
  // We tolerate this by feature-detecting at spawn-time (callers may want to
  // skip the wrap on unusual distros).
  args.push("--ro-bind-try", "/lib64", "/lib64");
  args.push("--ro-bind-try", "/etc", "/etc");

  if (!policy.network) {
    args.push("--unshare-net");
  } else {
    args.push("--share-net");
  }

  for (const p of policy.filesystem.paths) {
    const abs = path.resolve(p);
    args.push("--bind", abs, abs);
  }

  args.push("--", rewrite.command, ...rewrite.args);

  return {
    command: "bwrap",
    args,
    env: rewrite.env,
    changes: [
      ...rewrite.changes,
      `bubblewrap-isolated (network=${policy.network ? "host" : "none"}, binds=${policy.filesystem.paths.length})`,
    ],
  };
}

/** Test hook — clears the in-process availability cache. */
export function _resetBubblewrapCacheForTests(): void {
  cachedAvailability = undefined;
}

/** Test hook — pretend bubblewrap is or isn't available without probing. */
export function _setBubblewrapAvailableForTests(available: boolean | undefined): void {
  cachedAvailability = available;
}
