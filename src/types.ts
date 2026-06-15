export type TrustLevel = "trusted" | "review" | "risky";

export type Severity = "risky" | "review" | "info";

export type Transport = "stdio" | "remote";

/** A normalized MCP server definition discovered from a client config. */
export interface McpServer {
  name: string;
  client: string;
  source: string; // file path the definition came from
  transport: Transport;
  command?: string;
  args: string[];
  env: Record<string, string>;
  url?: string;
}

/** One explainable finding produced by a scanner rule. */
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
