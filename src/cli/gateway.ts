import pc from "picocolors";
import { Logger } from "../gateway/logger.js";
import { startProxy, type ProxyEnforcer } from "../gateway/proxy.js";
import { startDaemon } from "../gateway/daemon.js";
import { findServerByName } from "../gateway/registry.js";
import { PolicyStore } from "../sandbox/store.js";
import { applySpawnPolicy, decideOutgoing, identifyKind } from "../sandbox/enforce.js";
import { dockerizeSpawn, isDockerAvailable } from "../sandbox/docker.js";
import { bubblewrapSpawn, isBubblewrapAvailable } from "../sandbox/bubblewrap.js";

export interface GatewayRunOptions {
  from?: string;
}

export interface GatewayStartOptions {
  port?: number;
  host?: string;
  /** Use fixture configs from this directory instead of the real client configs. */
  from?: string;
}

const DEFAULT_PORT = 7331;
const DEFAULT_HOST = "127.0.0.1";

export async function runGateway(name: string, opts: GatewayRunOptions): Promise<number> {
  const server = findServerByName(name, { from: opts.from });
  if (!server) {
    process.stderr.write(`wardn gateway: no server named "${name}" in your configs\n`);
    return 2;
  }
  if (server.transport !== "stdio" || !server.command) {
    process.stderr.write(
      `wardn gateway: "${name}" is a ${server.transport} server, only stdio proxying is supported in this increment\n`,
    );
    return 2;
  }

  const logger = new Logger();
  const policy = new PolicyStore().get(server.name);
  const sandboxed = !!policy?.enabled;

  let spawn = { command: server.command, args: [...server.args], env: { ...server.env }, changes: [] as string[] };
  let enforcer: ProxyEnforcer | undefined;
  let replaceEnv = false;

  if (sandboxed && policy) {
    const rewritten = applySpawnPolicy(server, policy);
    let isolation: "docker+policy" | "bubblewrap+policy" | "policy-only" = "policy-only";
    let final = rewritten;
    if (isDockerAvailable()) {
      final = dockerizeSpawn(rewritten, { policy });
      isolation = "docker+policy";
    } else if (isBubblewrapAvailable()) {
      final = bubblewrapSpawn(rewritten, policy);
      isolation = "bubblewrap+policy";
    }
    spawn = final;
    enforcer = {
      decide: (line: string) => {
        const decision = decideOutgoing(line, policy);
        if (decision.reject) return { reject: decision.reject };
        return { allow: true };
      },
    };
    replaceEnv = true;
    logger.append({
      ts: new Date().toISOString(),
      server: server.name,
      direction: "system",
      message: `sandbox active (${isolation}, kind=${identifyKind(server)}): ${final.changes.join("; ") || "no spawn changes"}`,
    });
  }

  logger.append({
    ts: new Date().toISOString(),
    server: server.name,
    direction: "system",
    message: `proxy started: ${spawn.command} ${spawn.args.join(" ")}`,
  });

  const handle = startProxy({
    serverName: server.name,
    command: spawn.command,
    args: spawn.args,
    env: spawn.env,
    logger,
    enforcer,
    replaceEnv,
  });

  const code = await handle.exit;
  logger.append({
    ts: new Date().toISOString(),
    server: server.name,
    direction: "system",
    message: `proxy exited (code=${code})`,
  });
  await logger.close();
  return code;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

export async function startGatewayDaemon(opts: GatewayStartOptions): Promise<void> {
  const port = opts.port ?? DEFAULT_PORT;
  const host = opts.host ?? DEFAULT_HOST;
  const logger = new Logger();

  if (!LOOPBACK_HOSTS.has(host)) {
    process.stderr.write(
      "\n" +
        pc.red("⚠  wardn gateway: ") +
        `you are binding the API to ${pc.bold(host)} — anyone on this network can read /api/scan and toggle sandbox policies via POST /api/sandbox/<name>.\n` +
        pc.dim("   The daemon has no auth in this release. Bind to 127.0.0.1 (the default) for single-machine use, or front it with a reverse proxy that enforces auth.\n\n"),
    );
  }

  let daemon: Awaited<ReturnType<typeof startDaemon>>;
  try {
    daemon = await startDaemon({ port, host, logger, scanFrom: opts.from });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`wardn gateway: failed to start daemon — ${msg}\n`);
    return;
  }

  const base = `http://${daemon.host}:${daemon.port}`;
  process.stdout.write("\n" + pc.bold("wardn gateway") + pc.dim(" — daemon up") + "\n\n");
  process.stdout.write(`  dashboard  ${pc.cyan(base + "/")}\n`);
  process.stdout.write(`  status     ${pc.cyan(base + "/api/status")}\n`);
  process.stdout.write(`  events     ${pc.cyan(base + "/api/events")} ${pc.dim("(SSE)")}\n`);
  process.stdout.write(`  log        ${pc.dim(logger.filePath())}\n\n`);
  process.stdout.write(pc.dim("  Ctrl+C to stop.\n\n"));

  const shutdown = async (): Promise<void> => {
    await daemon.close();
    await logger.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise<void>(() => {
    /* hold the event loop open until a signal arrives */
  });
}
