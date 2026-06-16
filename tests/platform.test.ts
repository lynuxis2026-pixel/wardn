import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { knownClientLocations } from "../src/discovery/clients.js";
import { resolveCommand } from "../src/gateway/resolve-command.js";

// ===== clients.ts cross-platform branches =====

test("knownClientLocations returns the macOS layout", () => {
  const locs = knownClientLocations({ platform: "darwin", home: "/Users/test" });
  const map = Object.fromEntries(locs.map((l) => [l.client, l.file]));
  assert.ok(map["claude-desktop"].includes("Library") && map["claude-desktop"].endsWith("claude_desktop_config.json"));
  assert.ok(map["cursor"].endsWith(path.join(".cursor", "mcp.json")));
  assert.ok(map["vscode"].includes("Library") && map["vscode"].endsWith("mcp.json"));
});

test("knownClientLocations returns the Windows layout", () => {
  const locs = knownClientLocations({
    platform: "win32",
    home: "C:\\Users\\test",
    appData: "C:\\Users\\test\\AppData\\Roaming",
  });
  const map = Object.fromEntries(locs.map((l) => [l.client, l.file]));
  assert.match(map["claude-desktop"], /Claude[\\/]claude_desktop_config\.json$/);
  assert.match(map["claude-desktop"], /AppData/);
  assert.match(map["vscode"], /Code[\\/]User[\\/]mcp\.json$/);
});

test("knownClientLocations falls back to the Linux layout for any other platform", () => {
  const locs = knownClientLocations({ platform: "linux", home: "/home/test" });
  const map = Object.fromEntries(locs.map((l) => [l.client, l.file]));
  assert.ok(map["claude-desktop"].endsWith(path.join(".config", "Claude", "claude_desktop_config.json")));
  assert.ok(map["vscode"].endsWith(path.join(".config", "Code", "User", "mcp.json")));
});

test("knownClientLocations builds APPDATA from home when no override is given", () => {
  const locs = knownClientLocations({ platform: "win32", home: "C:\\Users\\me", appData: undefined });
  const claude = locs.find((l) => l.client === "claude-desktop")!;
  assert.match(claude.file, /AppData[\\/]Roaming[\\/]Claude/);
});

// ===== resolve-command.ts cross-platform branches =====

test("resolveCommand returns the input unchanged on non-Windows", () => {
  assert.equal(resolveCommand("npx", { platform: "darwin" }), "npx");
  assert.equal(resolveCommand("npx", { platform: "linux" }), "npx");
});

test("resolveCommand returns absolute paths unchanged on Windows", () => {
  const abs = "C:\\Program Files\\nodejs\\npx.cmd";
  assert.equal(resolveCommand(abs, { platform: "win32" }), abs);
});

test("resolveCommand returns names with explicit extensions unchanged", () => {
  for (const cmd of ["foo.exe", "bar.cmd", "baz.bat", "qux.com"]) {
    assert.equal(resolveCommand(cmd, { platform: "win32" }), cmd);
  }
});

test("resolveCommand walks PATHEXT for shims on Windows", () => {
  const probed: string[] = [];
  const found = resolveCommand("npx", {
    platform: "win32",
    pathEnv: ["C:\\node", "C:\\extra"].join(";"),
    pathExt: ".COM;.EXE;.CMD",
    exists: (file) => {
      probed.push(file);
      return file === path.join("C:\\node", "npx.CMD");
    },
  });
  assert.equal(found, path.join("C:\\node", "npx.CMD"));
  // First probe should have been C:\node\npx.COM (highest priority ext)
  assert.equal(probed[0], path.join("C:\\node", "npx.COM"));
});

test("resolveCommand falls back to the bare command when nothing matches", () => {
  const found = resolveCommand("nothing", {
    platform: "win32",
    pathEnv: "C:\\node",
    pathExt: ".EXE;.CMD",
    exists: () => false,
  });
  assert.equal(found, "nothing");
});

test("resolveCommand handles empty PATH cleanly", () => {
  assert.equal(
    resolveCommand("npx", { platform: "win32", pathEnv: "", pathExt: ".EXE", exists: () => false }),
    "npx",
  );
});
