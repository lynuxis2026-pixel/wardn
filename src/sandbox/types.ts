/**
 * Per-server sandbox policy. Stored under ~/.wardn/policy.json.
 *
 * The policy is enforced by the gateway in two layers:
 *   1. Spawn-time rewriting: arguments and env vars are trimmed to what the
 *      policy allows before the server process starts.
 *   2. Runtime JSON-RPC interception: tool-calls carrying out-of-policy paths
 *      are rejected with a JSON-RPC error before they reach the server.
 *
 * When Docker is available the same policy drives the container's volume
 * mounts and network namespace. When Docker is missing the gateway falls back
 * to the in-process enforcement above.
 */

export interface PolicyFilesystem {
  /** Absolute paths the server may touch. Empty array = no filesystem access. */
  paths: string[];
}

export interface ServerPolicy {
  /** Friendly name (mirrors McpServer.name) — used as the policy map key. */
  name: string;
  /** Master switch — when false the gateway proxies as-is. */
  enabled: boolean;
  filesystem: PolicyFilesystem;
  /** Allow outbound network from the sandboxed process. Default: false. */
  network: boolean;
  /** Env vars allowed to pass through to the server. Anything else is stripped. */
  envWhitelist: string[];
  /** Free-form note shown in the scanner output. */
  note?: string;
}

export interface PolicyFile {
  version: 1;
  servers: Record<string, ServerPolicy>;
}

export const EMPTY_POLICY_FILE: PolicyFile = { version: 1, servers: {} };
