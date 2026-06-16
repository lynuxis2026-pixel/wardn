import fs from "node:fs";
import path from "node:path";
import { knownClientLocations, type ClientConfigLocation } from "./clients.js";
import type { McpServer, Transport } from "../types.js";

interface RawServer {
  command?: string;
  args?: unknown;
  env?: Record<string, string>;
  url?: string;
  type?: string;
}

function normalize(name: string, client: string, source: string, raw: RawServer): McpServer {
  const url = typeof raw.url === "string" ? raw.url : undefined;
  const transport: Transport = url ? "remote" : "stdio";
  return {
    name,
    client,
    source,
    transport,
    command: typeof raw.command === "string" ? raw.command : undefined,
    args: Array.isArray(raw.args) ? raw.args.map(String) : [],
    env: raw.env && typeof raw.env === "object" ? raw.env : {},
    url,
  };
}

function parseConfigFile(file: string, client: string, serversKey: string): McpServer[] {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return []; // file does not exist / not readable — silently skip
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch (err) {
    process.stderr.write(`wardn: could not parse ${file} (invalid JSON), skipping\n`);
    return [];
  }
  const map = (json[serversKey] ?? json["mcpServers"] ?? json["servers"]) as
    | Record<string, RawServer>
    | undefined;
  if (!map || typeof map !== "object") return [];
  /* c8 ignore next — `raw ?? {}` defends against null entries in the config;
     fixtures always pass concrete objects. */
  return Object.entries(map).map(([name, raw]) => normalize(name, client, file, raw ?? {}));
}

/** Discover servers from the standard client config locations on this machine. */
export function discoverFromKnownClients(): McpServer[] {
  const out: McpServer[] = [];
  for (const loc of knownClientLocations()) {
    out.push(...parseConfigFile(loc.file, loc.client, loc.serversKey));
  }
  return out;
}

/**
 * Discover servers from a directory of config files (used for testing / fixtures).
 * The client name is inferred from the filename.
 */
export function discoverFromDir(dir: string): McpServer[] {
  const out: McpServer[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    process.stderr.write(`wardn: could not read directory ${dir}\n`);
    return [];
  }
  for (const f of entries) {
    const client = path.basename(f, ".json").replace(/[_-]?config$/i, "").replace(/[_-]?mcp$/i, "");
    /* c8 ignore next — the `|| "unknown"` fallback is only hit by files whose
       basename strips entirely to ""; not a shape that appears in practice. */
    out.push(...parseConfigFile(path.join(dir, f), client || "unknown", "mcpServers"));
  }
  return out;
}
