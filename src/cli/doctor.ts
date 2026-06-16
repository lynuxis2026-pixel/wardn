import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { knownClientLocations } from "../discovery/clients.js";
import { discoverFromKnownClients } from "../discovery/index.js";
import { PolicyStore } from "../sandbox/store.js";
import { isDockerAvailable } from "../sandbox/docker.js";
import { isBubblewrapAvailable } from "../sandbox/bubblewrap.js";
import { loadTrustRegistry } from "../scanner/trust-registry.js";

export type CheckStatus = "ok" | "warn" | "fail" | "info";

export interface DoctorCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

interface DoctorOptions {
  /** When set, looks up the dashboard inside this dir instead of the bundled location. */
  dashboardDir?: string;
}

function wardnHome(): string {
  return process.env.WARDN_HOME ?? path.join(os.homedir(), ".wardn");
}

function defaultDashboardDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "dashboard", "dist");
}

/** Pure function — gathers every check result. Easy to test. */
export function runChecks(opts: DoctorOptions = {}): DoctorCheck[] {
  const checks: DoctorCheck[] = [];

  // 1. Node version
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  checks.push({
    id: "node-version",
    label: "Node.js version",
    status: major >= 18 ? "ok" : "fail",
    detail: `${process.version} (need ≥ 18)`,
  });

  // 2. WARDN_HOME writable
  const home = wardnHome();
  let homeStatus: CheckStatus = "ok";
  let homeDetail = home;
  try {
    fs.mkdirSync(home, { recursive: true });
    const probe = path.join(home, ".doctor-probe");
    fs.writeFileSync(probe, "");
    fs.unlinkSync(probe);
  } catch (err) {
    homeStatus = "fail";
    homeDetail = `${home} (${(err as Error).message})`;
  }
  checks.push({ id: "wardn-home", label: "WARDN_HOME writable", status: homeStatus, detail: homeDetail });

  // 3. Client configs found
  const locs = knownClientLocations();
  const present = locs.filter((l) => fs.existsSync(l.file));
  checks.push({
    id: "clients",
    label: "MCP-capable clients on this machine",
    status: present.length > 0 ? "ok" : "warn",
    detail: present.length > 0 ? present.map((l) => l.client).join(", ") : "no Claude Desktop / Cursor / VS Code config found",
  });

  // 4. Discovered servers
  let servers = 0;
  try {
    servers = discoverFromKnownClients().length;
  } catch {
    /* counted as 0 */
  }
  checks.push({
    id: "servers",
    label: "MCP servers discovered",
    status: servers > 0 ? "ok" : "info",
    detail: `${servers} server${servers === 1 ? "" : "s"}`,
  });

  // 5. Sandbox tooling
  const docker = isDockerAvailable();
  const bwrap = isBubblewrapAvailable();
  const hasContainer = docker || bwrap;
  const tooling = [docker ? "docker" : null, bwrap ? "bubblewrap" : null].filter(Boolean).join(", ");
  checks.push({
    id: "sandbox-tooling",
    label: "Sandbox isolation tooling",
    status: hasContainer ? "ok" : "info",
    detail: hasContainer ? tooling : "policy-only (no Docker / bubblewrap detected — light isolation)",
  });

  // 6. Policy file validity
  const store = new PolicyStore();
  let policyStatus: CheckStatus = "ok";
  let policyDetail = "no policy yet";
  try {
    const file = store.read();
    const count = Object.keys(file.servers).length;
    policyDetail = count > 0 ? `${count} polic${count === 1 ? "y" : "ies"} at ${store.filePath()}` : "no policies yet";
  } catch (err) {
    policyStatus = "fail";
    policyDetail = (err as Error).message;
  }
  checks.push({ id: "policy", label: "Sandbox policy file", status: policyStatus, detail: policyDetail });

  // 7. Trust registry source
  const reg = loadTrustRegistry();
  const overrideFile = path.join(home, "trust-registry.json");
  const hasOverride = fs.existsSync(overrideFile);
  checks.push({
    id: "trust-registry",
    label: "Trust registry",
    status: "ok",
    detail: `${Object.keys(reg.packages).length} entries (${hasOverride ? "live override" : "bundled"})`,
  });

  // 8. Dashboard built
  const dashDir = opts.dashboardDir ?? defaultDashboardDir();
  const dashIndex = path.join(dashDir, "index.html");
  checks.push({
    id: "dashboard",
    label: "Dashboard build",
    status: fs.existsSync(dashIndex) ? "ok" : "warn",
    detail: fs.existsSync(dashIndex) ? dashDir : `${dashIndex} not built — run npm run dashboard:build`,
  });

  return checks;
}

const ICON: Record<CheckStatus, string> = {
  ok: pc.green("✓"),
  warn: pc.yellow("○"),
  fail: pc.red("✕"),
  info: pc.cyan("·"),
};

export function runDoctor(opts: DoctorOptions = {}): number {
  const checks = runChecks(opts);
  process.stdout.write("\n" + pc.bold("wardn doctor") + "\n\n");
  for (const c of checks) {
    process.stdout.write(`  ${ICON[c.status]}  ${pc.bold(c.label.padEnd(38))} ${pc.dim(c.detail)}\n`);
  }
  process.stdout.write("\n");
  const failed = checks.some((c) => c.status === "fail");
  return failed ? 1 : 0;
}
