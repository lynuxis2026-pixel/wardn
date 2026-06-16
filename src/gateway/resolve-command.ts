import fs from "node:fs";
import path from "node:path";

const WINDOWS_EXEC_EXTS = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);

/**
 * Locate an executable in PATH on Windows, including .cmd / .bat shims like
 * npx, uvx, bunx. Returning the resolved path lets us avoid `shell: true` and
 * the Node 22 DEP0190 deprecation warning that comes with it.
 */
export function resolveCommand(cmd: string): string {
  if (process.platform !== "win32") return cmd;
  if (path.isAbsolute(cmd)) return cmd;
  if (/\.(exe|cmd|bat|com)$/i.test(cmd)) return cmd;

  const pathDirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    for (const ext of WINDOWS_EXEC_EXTS) {
      const candidate = path.join(dir, cmd + ext);
      try {
        fs.accessSync(candidate, fs.constants.F_OK);
        return candidate;
      } catch {
        /* try next */
      }
    }
  }
  return cmd;
}
