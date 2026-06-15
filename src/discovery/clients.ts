import os from "node:os";
import path from "node:path";

export interface ClientConfigLocation {
  client: string;
  /** Absolute path to the config file we expect for this client. */
  file: string;
  /** Key in the JSON that holds the server map. */
  serversKey: "mcpServers" | "servers";
}

const home = os.homedir();
const platform = process.platform;

function appData(): string {
  return process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
}

/**
 * Standard, well-known config locations for MCP-capable clients across OSes.
 * We only return paths relevant to the current platform.
 */
export function knownClientLocations(): ClientConfigLocation[] {
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
      file: path.join(appData(), "Claude", "claude_desktop_config.json"),
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
      file: path.join(appData(), "Code", "User", "mcp.json"),
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
