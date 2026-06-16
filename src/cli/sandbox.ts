import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { PolicyStore, defaultPolicyFor } from "../sandbox/store.js";
import { findServerByName } from "../gateway/registry.js";
import { isDockerAvailable } from "../sandbox/docker.js";
import { isBubblewrapAvailable } from "../sandbox/bubblewrap.js";
import type { ServerPolicy } from "../sandbox/types.js";

export interface EnableOptions {
  paths?: string[];
  allowNetwork?: boolean;
  allowEnv?: string[];
  from?: string;
}

function ensureDirs(paths: string[]): void {
  for (const p of paths) {
    try {
      fs.mkdirSync(p, { recursive: true });
    } catch {
      /* permissions or already exists — ignore */
    }
  }
}

export function enableSandbox(name: string, opts: EnableOptions): number {
  const server = findServerByName(name, { from: opts.from });
  if (!server) {
    process.stderr.write(`wardn sandbox: no server named "${name}" in your configs\n`);
    return 2;
  }
  const store = new PolicyStore();
  const existing = store.get(name);
  const base: ServerPolicy = existing ?? defaultPolicyFor(name);
  const policy: ServerPolicy = {
    ...base,
    enabled: true,
    filesystem: {
      paths: opts.paths && opts.paths.length > 0 ? opts.paths.map((p) => path.resolve(p)) : base.filesystem.paths,
    },
    network: opts.allowNetwork ?? base.network,
    envWhitelist: opts.allowEnv && opts.allowEnv.length > 0 ? opts.allowEnv : base.envWhitelist,
  };
  ensureDirs(policy.filesystem.paths);
  store.upsert(policy);

  process.stdout.write("\n" + pc.green("✓") + ` Sandbox enabled for ` + pc.bold(name) + "\n\n");
  process.stdout.write(`  ${pc.dim("filesystem")}  ${policy.filesystem.paths.join(", ") || pc.dim("(none)")}\n`);
  process.stdout.write(`  ${pc.dim("network   ")}  ${policy.network ? pc.yellow("on") : pc.green("off")}\n`);
  process.stdout.write(`  ${pc.dim("env       ")}  ${policy.envWhitelist.length ? policy.envWhitelist.join(", ") : pc.dim("(baseline only)")}\n`);
  const isolation = isDockerAvailable()
    ? pc.green("docker + policy")
    : isBubblewrapAvailable()
    ? pc.green("bubblewrap + policy")
    : pc.cyan("policy-only") + pc.dim(" (no container runtime detected)");
  process.stdout.write(`  ${pc.dim("isolation ")}  ${isolation}\n\n`);
  process.stdout.write(pc.dim("  Run ") + pc.cyan(`wardn gateway run ${name}`) + pc.dim(" to spawn the server inside the sandbox.\n\n"));
  return 0;
}

export function disableSandbox(name: string): number {
  const store = new PolicyStore();
  const existing = store.get(name);
  if (!existing) {
    process.stderr.write(`wardn sandbox: no policy for "${name}"\n`);
    return 1;
  }
  store.upsert({ ...existing, enabled: false });
  process.stdout.write("\n" + pc.yellow("○") + ` Sandbox disabled for ` + pc.bold(name) + pc.dim(" (policy preserved)") + "\n\n");
  return 0;
}

export function showSandbox(name?: string): number {
  const store = new PolicyStore();
  const file = store.read();
  const entries = Object.values(file.servers).filter((p) => !name || p.name === name);
  process.stdout.write("\n" + pc.bold("wardn sandbox") + pc.dim(`  ${store.filePath()}`) + "\n\n");
  if (entries.length === 0) {
    process.stdout.write(pc.dim("  No policies yet. ") + pc.cyan("wardn sandbox enable <name>") + pc.dim(" to create one.\n\n"));
    return 0;
  }
  for (const p of entries) {
    const state = p.enabled ? pc.green("● enabled ") : pc.dim("○ disabled");
    process.stdout.write(`  ${state}  ${pc.bold(p.name)}\n`);
    process.stdout.write(`             ${pc.dim("fs:")} ${p.filesystem.paths.join(", ") || pc.dim("(none)")}\n`);
    process.stdout.write(`             ${pc.dim("net:")} ${p.network ? pc.yellow("on") : "off"}    ${pc.dim("env:")} ${p.envWhitelist.length ? p.envWhitelist.join(", ") : pc.dim("(baseline only)")}\n`);
  }
  process.stdout.write("\n");
  return 0;
}
