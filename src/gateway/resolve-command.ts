import fs from "node:fs";
import path from "node:path";

export interface ResolveCtx {
  /** Defaults to `process.platform`. */
  platform?: NodeJS.Platform;
  /** Defaults to `process.env.PATH`. */
  pathEnv?: string;
  /** Defaults to `process.env.PATHEXT` (or the Windows default). */
  pathExt?: string;
  /** Defaults to `fs.accessSync` — injectable for tests. */
  exists?: (file: string) => boolean;
}

function defaultExists(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Locate an executable in PATH on Windows, including .cmd / .bat shims like
 * npx, uvx, bunx. Returning the resolved path lets us avoid `shell: true` and
 * the Node 22 DEP0190 deprecation warning that comes with it.
 *
 * Pure — all platform inputs can be injected via `ctx`.
 */
export function resolveCommand(cmd: string, ctx: ResolveCtx = {}): string {
  const platform = ctx.platform ?? process.platform;
  if (platform !== "win32") return cmd;
  if (path.isAbsolute(cmd)) return cmd;
  if (/\.(exe|cmd|bat|com)$/i.test(cmd)) return cmd;

  const exts = (ctx.pathExt ?? process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean);
  const pathDirs = (ctx.pathEnv ?? process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const exists = ctx.exists ?? defaultExists;

  for (const dir of pathDirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext);
      if (exists(candidate)) return candidate;
    }
  }
  return cmd;
}
