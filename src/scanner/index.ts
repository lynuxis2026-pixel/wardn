import { isBroadPath, RULES } from "./rules.js";
import type { McpServer, ScanResult, Signal, TrustLevel } from "../types.js";
import type { ServerPolicy } from "../sandbox/types.js";

function levelFromSignals(signals: Signal[]): TrustLevel {
  if (signals.some((s) => s.severity === "risky")) return "risky";
  if (signals.some((s) => s.severity === "review")) return "review";
  return "trusted";
}

/**
 * Adjust the raw scanner signals for a server's sandbox policy.
 *
 * The signals describe what the server *could* do as configured. When the
 * gateway enforces a policy, certain capabilities are no longer reachable;
 * the corresponding signals are dropped so the trust level reflects what the
 * server can actually do at runtime. A summarising `sandboxed` info signal is
 * always appended so the user can see why the level changed.
 */
function applyPolicyToSignals(signals: Signal[], policy: ServerPolicy): Signal[] {
  if (!policy.enabled) return signals;
  const policyHasBroadFs = policy.filesystem.paths.some((p) => isBroadPath(p));
  const filtered = signals.filter((s) => {
    if (s.id === "broad-fs" && !policyHasBroadFs) return false;
    return true;
  });
  const paths = policy.filesystem.paths.length > 0 ? policy.filesystem.paths.join(", ") : "none";
  filtered.push({
    id: "sandboxed",
    severity: "info",
    reason: `Sandboxed: fs=[${paths}], network=${policy.network ? "on" : "off"}, env-whitelist=${policy.envWhitelist.length}`,
  });
  return filtered;
}

export function scanServer(server: McpServer, policy?: ServerPolicy): ScanResult {
  const signals: Signal[] = [];
  for (const rule of RULES) {
    const sig = rule(server);
    if (sig) signals.push(sig);
  }
  const finalSignals = policy ? applyPolicyToSignals(signals, policy) : signals;
  return { server, level: levelFromSignals(finalSignals), signals: finalSignals };
}

export function scanAll(servers: McpServer[], policies?: Record<string, ServerPolicy>): ScanResult[] {
  return servers.map((s) => scanServer(s, policies?.[s.name]));
}

export interface ScanSummary {
  total: number;
  risky: number;
  review: number;
  trusted: number;
}

export function summarize(results: ScanResult[]): ScanSummary {
  return {
    total: results.length,
    risky: results.filter((r) => r.level === "risky").length,
    review: results.filter((r) => r.level === "review").length,
    trusted: results.filter((r) => r.level === "trusted").length,
  };
}
