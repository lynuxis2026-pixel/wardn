import type { ScanPayload, StatusPayload, ServerPolicy } from "./types.ts";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return (await res.json()) as T;
}

let cachedToken: string | undefined;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch("/api/token");
  if (!res.ok) {
    throw new Error(`could not read API token (${res.status}). The daemon may not be running on loopback.`);
  }
  const body = (await res.json()) as { token: string };
  cachedToken = body.token;
  return cachedToken;
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

export async function toggleSandbox(
  name: string,
  opts: ToggleSandboxOptions,
): Promise<{ ok: boolean; policy: ServerPolicy }> {
  const token = await getToken();
  const r = await fetch(`/api/sandbox/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(opts),
  });
  return jsonOrThrow<{ ok: boolean; policy: ServerPolicy }>(r);
}
