import pc from "picocolors";
import { applyRewrite, restoreRewrite, rewriteStatus, DEFAULT_INVOKE_TEMPLATE } from "../rewrite/index.js";

export interface ApplyCliOptions {
  client?: string;
  from?: string;
  invoke?: string;
  dryRun?: boolean;
}

export function applyCommand(opts: ApplyCliOptions): number {
  const result = applyRewrite({
    client: opts.client,
    from: opts.from,
    invokeTemplate: opts.invoke,
    dryRun: opts.dryRun,
  });
  const title = opts.dryRun ? "wardn rewrite apply" + pc.dim(" — dry run, nothing written") : "wardn rewrite apply";
  process.stdout.write("\n" + pc.bold(title) + "\n\n");
  for (const a of result.applied) {
    const tag = a.dryRun ? pc.yellow("• would rewrite") : pc.green("✓");
    process.stdout.write(`  ${tag} ${pc.bold(a.client)}  ${pc.dim(a.file)}\n`);
    process.stdout.write(`     ${pc.dim("→ rewrote")} ${a.servers.length ? a.servers.join(", ") : pc.dim("(no stdio servers)")}\n`);
    process.stdout.write(`     ${pc.dim("backup:")} ${pc.dim(a.backup)}${a.dryRun ? pc.dim(" (would create)") : ""}\n`);
  }
  for (const s of result.skipped) {
    process.stdout.write(`  ${pc.yellow("○")} ${pc.bold(s.client)}  ${pc.dim(s.file)}  ${pc.dim("— " + s.reason)}\n`);
  }
  if (result.applied.length === 0 && result.skipped.length === 0) {
    process.stdout.write(pc.dim("  No client configs found.\n"));
  }
  if (opts.dryRun) {
    process.stdout.write("\n" + pc.dim("  Drop --dry-run to actually apply these changes.\n\n"));
  } else {
    process.stdout.write("\n" + pc.dim("  Restart your MCP client(s) for the rewrite to take effect.\n"));
    process.stdout.write(pc.dim("  Roll back any time with ") + pc.cyan("wardn rewrite restore") + "\n\n");
  }
  return 0;
}

export interface RestoreCliOptions {
  client?: string;
  from?: string;
}

export function restoreCommand(opts: RestoreCliOptions): number {
  const result = restoreRewrite(opts);
  process.stdout.write("\n" + pc.bold("wardn rewrite restore") + "\n\n");
  for (const r of result.restored) {
    process.stdout.write(`  ${pc.green("✓")} ${pc.bold(r.client)}  ${pc.dim("restored from")} ${pc.dim(r.backup)}\n`);
  }
  for (const s of result.skipped) {
    process.stdout.write(`  ${pc.yellow("○")} ${pc.bold(s.client)}  ${pc.dim(s.file)}  ${pc.dim("— " + s.reason)}\n`);
  }
  if (result.restored.length === 0 && result.skipped.length === 0) {
    process.stdout.write(pc.dim("  Nothing to restore.\n"));
  }
  process.stdout.write("\n");
  return 0;
}

export function statusCommand(): number {
  const idx = rewriteStatus();
  process.stdout.write("\n" + pc.bold("wardn rewrite status") + "\n\n");
  if (idx.entries.length === 0) {
    process.stdout.write(pc.dim("  No active rewrites. ") + pc.cyan("wardn rewrite apply") + pc.dim(" to route MCP traffic through wardn.\n\n"));
    return 0;
  }
  for (const e of idx.entries) {
    process.stdout.write(`  ${pc.green("●")} ${pc.bold(e.client)}\n`);
    process.stdout.write(`     ${pc.dim("config:")} ${e.configFile}\n`);
    process.stdout.write(`     ${pc.dim("backup:")} ${e.backupFile}\n`);
    process.stdout.write(`     ${pc.dim("servers:")} ${e.servers.length ? e.servers.join(", ") : pc.dim("(none)")}\n`);
    process.stdout.write(`     ${pc.dim("when:")} ${e.timestamp}\n`);
  }
  process.stdout.write("\n  " + pc.dim("invoke template: ") + pc.cyan(DEFAULT_INVOKE_TEMPLATE) + "\n\n");
  return 0;
}
