import pc from "picocolors";
import { discoverFromKnownClients, discoverFromDir } from "../discovery/index.js";
import { scanAll, summarize } from "../scanner/index.js";
import { PolicyStore } from "../sandbox/store.js";
import type { ScanResult, TrustLevel } from "../types.js";
import type { ServerPolicy } from "../sandbox/types.js";

export interface ScanOptions {
  from?: string;
  json?: boolean;
}

const BADGE: Record<TrustLevel, string> = {
  risky: pc.red("● RISKY  "),
  review: pc.yellow("○ REVIEW "),
  trusted: pc.green("✓ TRUSTED"),
};

function rank(level: TrustLevel): number {
  return level === "risky" ? 0 : level === "review" ? 1 : 2;
}

export function runScan(opts: ScanOptions): number {
  const servers = opts.from ? discoverFromDir(opts.from) : discoverFromKnownClients();
  const policies: Record<string, ServerPolicy> = new PolicyStore().read().servers;
  const results = scanAll(servers, policies);
  const summary = summarize(results);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ summary, results, policies }, null, 2) + "\n");
    return summary.risky > 0 ? 1 : 0;
  }

  process.stdout.write("\n" + pc.bold("wardn scan") + "\n\n");

  if (servers.length === 0) {
    process.stdout.write(
      pc.dim(
        opts.from
          ? `No MCP servers found in ${opts.from}\n`
          : "No MCP servers found in the standard client configs.\n",
      ) + "\n",
    );
    return 0;
  }

  const clients = [...new Set(servers.map((s) => s.client))];
  process.stdout.write(
    pc.dim(`Found ${servers.length} MCP server${servers.length === 1 ? "" : "s"} across ${clients.length} client${clients.length === 1 ? "" : "s"}`) + "\n\n",
  );

  const sorted = [...results].sort((a, b) => rank(a.level) - rank(b.level) || a.server.name.localeCompare(b.server.name));
  for (const r of sorted) {
    const name = r.level === "risky" ? pc.bold(r.server.name) : r.server.name;
    const sandboxed = r.signals.some((s) => s.id === "sandboxed");
    const sandboxTag = sandboxed ? "  " + pc.cyan("⛨ sandboxed") : "";
    process.stdout.write(`  ${BADGE[r.level]}  ${name.padEnd(20)} ${pc.dim(`(${r.server.client})`)}${sandboxTag}\n`);
    for (const sig of r.signals.filter((s) => s.severity !== "info")) {
      process.stdout.write(`             ${pc.dim("↳")} ${sig.reason}\n`);
    }
    if (sandboxed) {
      const note = r.signals.find((s) => s.id === "sandboxed");
      if (note) process.stdout.write(`             ${pc.cyan("⛨")} ${pc.dim(note.reason)}\n`);
    }
  }

  process.stdout.write("\n");
  const parts = [
    pc.dim(`${summary.total} servers`),
    summary.risky > 0 ? pc.red(`${summary.risky} risky`) : pc.dim("0 risky"),
    summary.review > 0 ? pc.yellow(`${summary.review} review`) : pc.dim("0 review"),
    pc.green(`${summary.trusted} trusted`),
  ];
  process.stdout.write("  " + parts.join(pc.dim(" · ")) + "\n");

  if (summary.risky > 0 || summary.review > 0) {
    process.stdout.write("\n  " + pc.dim("Next: ") + pc.cyan("wardn sandbox enable <name>") + pc.dim("  (isolate a risky server)") + "\n");
  }
  process.stdout.write("\n");

  return summary.risky > 0 ? 1 : 0;
}
