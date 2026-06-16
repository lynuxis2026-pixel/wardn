import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Popularity = "high" | "medium" | "low";

export interface TrustEntry {
  publisher?: string;
  verified?: boolean;
  popularity?: Popularity;
  notes?: string;
  knownBad?: boolean;
}

export interface TrustPublisher {
  label: string;
  npm?: string[];
  verified?: boolean;
}

export interface TrustRegistry {
  version: 1;
  updatedAt: string;
  source: string;
  packages: Record<string, TrustEntry>;
  publishers?: Record<string, TrustPublisher>;
}

let cached: TrustRegistry | undefined;

function registryPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/scanner → ../../data and dist/scanner → ../../data both land in the
  // repo's data/trust.json because the depth is the same.
  return path.resolve(here, "..", "..", "data", "trust.json");
}

/**
 * Load the curated trust data once per process. A missing or corrupt file
 * silently degrades to "no entries" — the scanner falls back to heuristics
 * exactly like before.
 */
export function loadTrustRegistry(): TrustRegistry {
  if (cached) return cached;
  try {
    const text = fs.readFileSync(registryPath(), "utf8");
    const parsed = JSON.parse(text) as TrustRegistry;
    if (parsed && typeof parsed === "object" && parsed.packages && typeof parsed.packages === "object") {
      cached = parsed;
      return parsed;
    }
  } catch {
    /* fall through */
  }
  cached = {
    version: 1,
    updatedAt: "",
    source: "(missing)",
    packages: {},
    publishers: {},
  };
  return cached;
}

export interface TrustLookup {
  entry?: TrustEntry;
  /** The package name we looked up (may be a stripped form of the spec arg). */
  packageName?: string;
  /** Resolved publisher metadata, if known. */
  publisher?: TrustPublisher;
}

/** Strip @scope/name@version → @scope/name. */
function normalizePackage(spec: string): string {
  if (!spec) return spec;
  if (spec.startsWith("@")) {
    const at = spec.indexOf("@", 1);
    return at === -1 ? spec : spec.slice(0, at);
  }
  const at = spec.indexOf("@");
  return at === -1 ? spec : spec.slice(0, at);
}

export function lookupPackage(spec: string | undefined): TrustLookup {
  if (!spec) return {};
  const reg = loadTrustRegistry();
  const name = normalizePackage(spec);
  const entry = reg.packages[name];
  let publisher: TrustPublisher | undefined;
  if (entry?.publisher && reg.publishers) {
    publisher = reg.publishers[entry.publisher];
  }
  return { entry, packageName: name, publisher };
}

/** Reset the in-process cache; used by tests that swap the registry on disk. */
export function _resetTrustRegistryCacheForTests(): void {
  cached = undefined;
}
