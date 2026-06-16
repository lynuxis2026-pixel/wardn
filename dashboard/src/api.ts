import type { ScanPayload, StatusPayload, ServerPolicy } from "./types.ts";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return (await res.json()) as T;
}

export function fetchScan(): Promise<ScanPayload> {
  return fetch("/api/scan").then((r) => jsonOrThrow<ScanPayload>(r));
}

export function fetchStatus(): Promise<StatusPayload> {
  return fetch("/api/status").then((r) => jsonOrThrow<StatusPayload>(r));
}

export interface ToggleSandboxOptions {
  enabled?: boolean;
  paths?: string[];
  network?: boolean;
  envWhitelist?: string[];
}

export function toggleSandbox(name: string, opts: ToggleSandboxOptions): Promise<{ ok: boolean; policy: ServerPolicy }> {
  return fetch(`/api/sandbox/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  }).then((r) => jsonOrThrow<{ ok: boolean; policy: ServerPolicy }>(r));
}
