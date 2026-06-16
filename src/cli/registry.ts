import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import pc from "picocolors";
import { loadTrustRegistry, _resetTrustRegistryCacheForTests } from "../scanner/trust-registry.js";

export const DEFAULT_REGISTRY_URL =
  "https://raw.githubusercontent.com/lynuxis2026-pixel/wardn/main/data/trust.json";

function wardnHome(): string {
  return process.env.WARDN_HOME ?? path.join(os.homedir(), ".wardn");
}

export function overrideFilePath(): string {
  return path.join(wardnHome(), "trust-registry.json");
}

interface RegistryShape {
  version?: number;
  updatedAt?: string;
  packages?: Record<string, unknown>;
}

/** Pure validator — returns the parsed object or throws a readable error. */
export function validateRegistry(raw: string): RegistryShape {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error("response is not valid JSON: " + (err as Error).message);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("registry must be a JSON object");
  }
  const obj = parsed as RegistryShape;
  if (!obj.packages || typeof obj.packages !== "object") {
    throw new Error('missing required "packages" map');
  }
  if (obj.version !== 1) {
    throw new Error(`unsupported registry version: ${obj.version}`);
  }
  return obj;
}

export interface UpdateOptions {
  /** Override the fetch URL (test injection). */
  url?: string;
  /** Override the timeout in ms. */
  timeoutMs?: number;
  /** Provide pre-fetched body — useful for tests, skips the HTTP call. */
  body?: string;
}

export interface UpdateResult {
  source: string;
  storedAt: string;
  packages: number;
  updatedAt?: string;
}

export async function updateRegistry(opts: UpdateOptions = {}): Promise<UpdateResult> {
  const url = opts.url ?? DEFAULT_REGISTRY_URL;
  let body: string;
  if (opts.body !== undefined) {
    body = opts.body;
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      body = await res.text();
    } finally {
      clearTimeout(timer);
    }
  }
  const validated = validateRegistry(body);
  const out = overrideFilePath();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body.endsWith("\n") ? body : body + "\n");
  _resetTrustRegistryCacheForTests();
  return {
    source: url,
    storedAt: out,
    packages: Object.keys(validated.packages ?? {}).length,
    updatedAt: validated.updatedAt,
  };
}

export interface StatusInfo {
  source: "live" | "bundled";
  file: string;
  packages: number;
  updatedAt: string;
  ageDays?: number;
}

export function registryStatus(): StatusInfo {
  const override = overrideFilePath();
  if (fs.existsSync(override)) {
    const txt = fs.readFileSync(override, "utf8");
    const parsed = JSON.parse(txt) as RegistryShape & { updatedAt?: string };
    return {
      source: "live",
      file: override,
      packages: Object.keys(parsed.packages ?? {}).length,
      updatedAt: parsed.updatedAt ?? "(unknown)",
      ageDays: ageDaysSince(parsed.updatedAt),
    };
  }
  const bundled = loadTrustRegistry();
  return {
    source: "bundled",
    file: "data/trust.json",
    packages: Object.keys(bundled.packages).length,
    updatedAt: bundled.updatedAt || "(unknown)",
    ageDays: ageDaysSince(bundled.updatedAt),
  };
}

function ageDaysSince(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

export async function runRegistryUpdate(opts: { url?: string }): Promise<number> {
  process.stdout.write("\n" + pc.bold("wardn registry update") + "\n\n");
  process.stdout.write(`  ${pc.dim("source:")} ${opts.url ?? DEFAULT_REGISTRY_URL}\n`);
  try {
    const res = await updateRegistry({ url: opts.url });
    process.stdout.write(`  ${pc.green("✓")} ${res.packages} package${res.packages === 1 ? "" : "s"}` +
      (res.updatedAt ? pc.dim(` (registry stamp: ${res.updatedAt})`) : "") + "\n");
    process.stdout.write(`  ${pc.dim("stored:")} ${res.storedAt}\n\n`);
    return 0;
  } catch (err) {
    process.stderr.write(pc.red(`  ✕ update failed: ${(err as Error).message}\n\n`));
    return 1;
  }
}

export function runRegistryStatus(): number {
  const s = registryStatus();
  process.stdout.write("\n" + pc.bold("wardn registry status") + "\n\n");
  const tag = s.source === "live" ? pc.green("live override") : pc.cyan("bundled");
  process.stdout.write(`  ${pc.dim("source:")} ${tag}\n`);
  process.stdout.write(`  ${pc.dim("file:  ")} ${s.file}\n`);
  process.stdout.write(`  ${pc.dim("size:  ")} ${s.packages} packages\n`);
  process.stdout.write(`  ${pc.dim("stamp: ")} ${s.updatedAt}${typeof s.ageDays === "number" ? pc.dim(` (${s.ageDays}d old)`) : ""}\n\n`);
  return 0;
}
