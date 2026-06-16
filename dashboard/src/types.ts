export type TrustLevel = "trusted" | "review" | "risky";
export type Severity = "risky" | "review" | "info";
export type Direction = "in" | "out" | "system";

export interface McpServer {
  name: string;
  client: string;
  source: string;
  transport: "stdio" | "remote";
  command?: string;
  args: string[];
  env: Record<string, string>;
  url?: string;
}

export interface Signal {
  id: string;
  severity: Severity;
  reason: string;
}

export interface ScanResult {
  server: McpServer;
  level: TrustLevel;
  signals: Signal[];
}

export interface ScanSummary {
  total: number;
  risky: number;
  review: number;
  trusted: number;
}

export interface ServerPolicy {
  name: string;
  enabled: boolean;
  filesystem: { paths: string[] };
  network: boolean;
  envWhitelist: string[];
  note?: string;
}

export interface ScanPayload {
  summary: ScanSummary;
  results: ScanResult[];
  policies: Record<string, ServerPolicy>;
}

export interface LogEntry {
  ts: string;
  server: string;
  direction: Direction;
  method?: string;
  id?: string | number | null;
  isResponse?: boolean;
  isError?: boolean;
  paramKeys?: string[];
  raw?: string;
  message?: string;
  durationMs?: number;
}

export interface StatusPayload {
  status: string;
  pid: number;
  uptimeSec: number;
  logFile: string;
  docker: boolean;
  dashboard: string;
}
