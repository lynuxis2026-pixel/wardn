#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { runScan } from "./cli/scan.js";
import { runGateway, startGatewayDaemon } from "./cli/gateway.js";
import { enableSandbox, disableSandbox, showSandbox } from "./cli/sandbox.js";
import { applyCommand, restoreCommand, statusCommand } from "./cli/rewrite.js";
import { runDemo } from "./cli/demo.js";

const program = new Command();

program
  .name("wardn")
  .description("See and stop the risky code your AI agents run. Local-first MCP control plane.")
  .version("0.0.1");

program
  .command("scan")
  .description("Discover MCP servers from your clients and score each for risk")
  .option("--from <dir>", "scan JSON configs in a directory instead of the standard locations")
  .option("--json", "output machine-readable JSON")
  .action((opts) => {
    const code = runScan({ from: opts.from, json: opts.json });
    process.exitCode = code;
  });

const sandbox = program
  .command("sandbox")
  .description("Manage per-server sandbox policies (filesystem, network, env)");

sandbox
  .command("enable <name>")
  .description("Sandbox a server; creates a default-locked policy if none exists")
  .option("--path <dir>", "filesystem path the server may touch (repeatable)", (v, a: string[]) => [...a, v], [] as string[])
  .option("--allow-network", "permit outbound network from the server", false)
  .option("--allow-env <key>", "env var to pass through (repeatable)", (v, a: string[]) => [...a, v], [] as string[])
  .option("--from <dir>", "resolve <name> from JSON configs in a directory")
  .action((name: string, opts: { path?: string[]; allowNetwork?: boolean; allowEnv?: string[]; from?: string }) => {
    const code = enableSandbox(name, {
      paths: opts.path,
      allowNetwork: opts.allowNetwork,
      allowEnv: opts.allowEnv,
      from: opts.from,
    });
    process.exitCode = code;
  });

sandbox
  .command("disable <name>")
  .description("Disable the sandbox for a server (policy is preserved)")
  .action((name: string) => {
    process.exitCode = disableSandbox(name);
  });

sandbox
  .command("status [name]")
  .description("Show the current sandbox policies")
  .action((name?: string) => {
    process.exitCode = showSandbox(name);
  });

const gateway = program
  .command("gateway")
  .description("Local MCP gateway: stdio proxy + HTTP/SSE daemon");

gateway
  .command("run <name>")
  .description("Spawn a server by name and proxy its stdio (applies sandbox policy if any)")
  .option("--from <dir>", "resolve <name> from JSON configs in a directory")
  .action(async (name: string, opts: { from?: string }) => {
    const code = await runGateway(name, { from: opts.from });
    process.exitCode = code;
  });

gateway
  .command("start")
  .description("Start the long-running gateway daemon (HTTP + SSE + dashboard)")
  .option("-p, --port <port>", "listen on this port", (v) => Number.parseInt(v, 10))
  .option("-H, --host <host>", "bind to this host")
  .option("--from <dir>", "use fixture configs in <dir> for /api/scan instead of the real client configs")
  .action(async (opts: { port?: number; host?: string; from?: string }) => {
    await startGatewayDaemon({ port: opts.port, host: opts.host, from: opts.from });
  });

const rewrite = program
  .command("rewrite")
  .description("Route MCP traffic through wardn by rewriting client configs (with backup)");

rewrite
  .command("apply")
  .description("Rewrite each discovered MCP server to call wardn gateway run <name>")
  .option("--client <name>", "limit to a specific client (claude-desktop / cursor / vscode)")
  .option("--invoke <template>", `command template; {name} is substituted (default: "${"npx -y wardn gateway run {name}"}")`)
  .option("--from <dir>", "rewrite JSON configs in <dir> instead of the standard locations")
  .action((opts: { client?: string; invoke?: string; from?: string }) => {
    process.exitCode = applyCommand(opts);
  });

rewrite
  .command("restore")
  .description("Restore previously-rewritten client configs from backups")
  .option("--client <name>", "limit to a specific client")
  .option("--from <dir>", "restore configs in <dir> instead of the standard locations")
  .action((opts: { client?: string; from?: string }) => {
    process.exitCode = restoreCommand(opts);
  });

rewrite
  .command("status")
  .description("Show which client configs are currently rewritten")
  .action(() => {
    process.exitCode = statusCommand();
  });

program
  .command("demo")
  .description("Run an intentionally malicious MCP server through wardn and watch every attack get blocked")
  .option("--fast", "skip the dramatic pacing between attacks (used by tests)")
  .action(async (opts: { fast?: boolean }) => {
    const r = await runDemo({ fast: opts.fast });
    process.exitCode = r.reachedServer === 0 ? 0 : 1;
  });

program.parse();
