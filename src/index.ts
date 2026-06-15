#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { runScan } from "./cli/scan.js";

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

program
  .command("sandbox <name>")
  .description("Isolate a server with explicit permissions (coming soon)")
  .action((name: string) => {
    process.stdout.write(
      "\n" + pc.yellow("Not implemented yet.") + ` Sandboxing "${name}" lands in the next increment.\n` +
        pc.dim("For now, run ") + pc.cyan("wardn scan") + pc.dim(" to see what's running.\n\n"),
    );
  });

program
  .command("gateway")
  .description("Run the local MCP gateway (coming soon)")
  .action(() => {
    process.stdout.write("\n" + pc.yellow("Not implemented yet.") + " The gateway lands after discovery + scan are proven.\n\n");
  });

program.parse();
