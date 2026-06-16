import { discoverFromKnownClients, discoverFromDir } from "../discovery/index.js";
import type { McpServer } from "../types.js";

export interface FindOptions {
  /** Directory of fixture configs; if omitted, the real client configs are read. */
  from?: string;
}

/**
 * Resolve a server definition by name. Matches across all known clients so a
 * user can say `wardn gateway run github` without caring which config it
 * lives in. Returns the first match.
 */
export function findServerByName(name: string, opts: FindOptions = {}): McpServer | undefined {
  const servers = opts.from ? discoverFromDir(opts.from) : discoverFromKnownClients();
  return servers.find((s) => s.name === name);
}
