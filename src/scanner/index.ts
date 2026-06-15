import { RULES } from "./rules.js";
import type { McpServer, ScanResult, Signal, TrustLevel } from "../types.js";

function levelFromSignals(signals: Signal[]): TrustLevel {
  if (signals.some((s) => s.severity === "risky")) return "risky";
  if (signals.some((s) => s.severity === "review")) return "review";
  return "trusted";
}

export function scanServer(server: McpServer): ScanResult {
  const signals: Signal[] = [];
  for (const rule of RULES) {
    const sig = rule(server);
    if (sig) signals.push(sig);
  }
  return { server, level: levelFromSignals(signals), signals };
}

export function scanAll(servers: McpServer[]): ScanResult[] {
  return servers.map(scanServer);
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
