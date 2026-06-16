import { spawnSync } from "node:child_process";
import path from "node:path";
import type { ServerPolicy } from "./types.js";
import type { SpawnRewrite } from "./enforce.js";
import { resolveCommand } from "../gateway/resolve-command.js";

let cachedAvailability: boolean | undefined;

/**
 * Probe `docker version` once per process. We treat any non-zero exit (or
 * missing binary) as "Docker is not usable" — distinguishing daemon-down from
 * missing-binary doesn't change our fallback path.
 */
export function isDockerAvailable(): boolean {
  if (cachedAvailability !== undefined) return cachedAvailability;
  try {
    const res = spawnSync(resolveCommand("docker"), ["version", "--format", "{{.Server.Version}}"], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 3_000,
    });
    cachedAvailability = res.status === 0 && !!res.stdout?.toString().trim();
  } catch {
    cachedAvailability = false;
  }
  return cachedAvailability;
}

/** Test hook — pretend Docker is or isn't available without probing. */
export function _setDockerAvailableForTests(available: boolean | undefined): void {
  cachedAvailability = available;
}

export interface DockerizeOptions {
  policy: ServerPolicy;
  /** Image to run inside. Falls back to node:20-alpine for npm-based servers. */
  image?: string;
}

/**
 * Wrap a SpawnRewrite so it runs inside a container with the policy's mounts
 * and network setting. Stdio is preserved (-i).
 *
 * This is best-effort. Returns the original rewrite unchanged when Docker
 * isn't available — the caller is expected to surface a notice once via
 * isDockerAvailable() before calling.
 */
export function dockerizeSpawn(rewrite: SpawnRewrite, opts: DockerizeOptions): SpawnRewrite {
  if (!isDockerAvailable()) return rewrite;

  const image = opts.image ?? "node:20-alpine";
  const args: string[] = ["run", "--rm", "-i"];

  if (!opts.policy.network) args.push("--network", "none");

  for (const p of opts.policy.filesystem.paths) {
    const abs = path.resolve(p);
    args.push("-v", `${abs}:${abs}`);
  }

  for (const [k, v] of Object.entries({} as Record<string, string>)) {
    args.push("-e", `${k}=${v}`);
  }

  args.push(image, rewrite.command, ...rewrite.args);

  return {
    command: "docker",
    args,
    env: rewrite.env,
    changes: [...rewrite.changes, `containerized (image=${image}, network=${opts.policy.network ? "host" : "none"})`],
  };
}
