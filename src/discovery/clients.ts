import os from "node:os";
import path from "node:path";

export interface ClientConfigLocation {
  client: string;
  /** Absolute path to the config file we expect for this client. */
  file: string;
  /** Key in the JSON that holds the server map. */
  serversKey: "mcpServers" | "servers";
}

export interface PlatformContext {
  /** "darwin" / "win32" / "linux" / ... — defaults to `process.platform`. */
  platform?: NodeJS.Platform;
  /** Home directory — defaults to os.homedir(). */
  home?: string;
  /** APPDATA env override; defaults to `process.env.APPDATA`. */
  appData?: string;
}

function appDataDir(home: string, override: string | undefined): string {
  return override ?? path.join(home, "AppData", "Roaming");
}

/**
 * Standard, well-known config locations for MCP-capable clients across OSes.
 * Pure function — every branch is reachable by passing a different ctx.
 */
export function knownClientLocations(ctx: PlatformContext = {}): ClientConfigLocation[] {
  const platform = ctx.platform ?? process.platform;
  const home = ctx.home ?? os.homedir();
  const appData = appDataDir(home, ctx.appData ?? process.env.APPDATA);
  const locs: ClientConfigLocation[] = [];

  // Claude Desktop
  if (platform === "darwin") {
    locs.push({
      client: "claude-desktop",
      file: path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
      serversKey: "mcpServers",
    });
  } else if (platform === "win32") {
    locs.push({
      client: "claude-desktop",
      file: path.join(appData, "Claude", "claude_desktop_config.json"),
      serversKey: "mcpServers",
    });
  } else {
    locs.push({
      client: "claude-desktop",
      file: path.join(home, ".config", "Claude", "claude_desktop_config.json"),
      serversKey: "mcpServers",
    });
  }

  // Cursor (global)
  locs.push({
    client: "cursor",
    file: path.join(home, ".cursor", "mcp.json"),
    serversKey: "mcpServers",
  });

  // VS Code (user-level mcp.json — best effort across platforms)
  if (platform === "darwin") {
    locs.push({
      client: "vscode",
      file: path.join(home, "Library", "Application Support", "Code", "User", "mcp.json"),
      serversKey: "servers",
    });
  } else if (platform === "win32") {
    locs.push({
      client: "vscode",
      file: path.join(appData, "Code", "User", "mcp.json"),
      serversKey: "servers",
    });
  } else {
    locs.push({
      client: "vscode",
      file: path.join(home, ".config", "Code", "User", "mcp.json"),
      serversKey: "servers",
    });
  }

  return locs;
}
