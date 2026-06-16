import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EMPTY_POLICY_FILE, type PolicyFile, type ServerPolicy } from "./types.js";

function defaultPolicyFile(): string {
  /* c8 ignore next — WARDN_HOME default; the os.homedir() branch is for the
     real install. */
  const home = process.env.WARDN_HOME ?? path.join(os.homedir(), ".wardn");
  return path.join(home, "policy.json");
}

export interface PolicyStoreOptions {
  file?: string;
}

export class PolicyStore {
  private readonly file: string;

  constructor(opts: PolicyStoreOptions = {}) {
    this.file = opts.file ?? defaultPolicyFile();
  }

  filePath(): string {
    return this.file;
  }

  read(): PolicyFile {
    let text: string;
    try {
      text = fs.readFileSync(this.file, "utf8");
    } catch {
      return { version: 1, servers: {} };
    }
    try {
      const parsed = JSON.parse(text) as Partial<PolicyFile>;
      if (parsed && typeof parsed === "object" && parsed.servers && typeof parsed.servers === "object") {
        return { version: 1, servers: parsed.servers as Record<string, ServerPolicy> };
      }
    } catch (err) {
      process.stderr.write(`wardn: policy file ${this.file} is not valid JSON (${(err as Error).message}); ignoring\n`);
    }
    return { ...EMPTY_POLICY_FILE };
  }

  write(file: PolicyFile): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(file, null, 2) + "\n");
  }

  get(name: string): ServerPolicy | undefined {
    return this.read().servers[name];
  }

  upsert(policy: ServerPolicy): void {
    const file = this.read();
    file.servers[policy.name] = policy;
    this.write(file);
  }

  remove(name: string): boolean {
    const file = this.read();
    if (!(name in file.servers)) return false;
    delete file.servers[name];
    this.write(file);
    return true;
  }
}

/**
 * Build a default-locked policy for a freshly sandboxed server.
 * Filesystem access defaults to a per-server sub-directory under the user's
 * home so the server has *somewhere* to write but nothing dangerous.
 */
export function defaultPolicyFor(name: string): ServerPolicy {
  /* c8 ignore next — same WARDN_HOME default story. */
  const home = process.env.WARDN_HOME ?? path.join(os.homedir(), ".wardn");
  const sandboxRoot = path.join(home, "sandboxes", name);
  return {
    name,
    enabled: true,
    filesystem: { paths: [sandboxRoot] },
    network: false,
    envWhitelist: [],
    note: "default-locked",
  };
}
