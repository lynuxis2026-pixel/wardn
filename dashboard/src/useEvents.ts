import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "./types.ts";

const MAX_ENTRIES = 300;

/**
 * Subscribe to the daemon's SSE stream. Returns a rolling buffer of the most
 * recent entries; reconnects automatically with backoff.
 */
export function useEvents(): { entries: LogEntry[]; connected: boolean } {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let backoff = 500;

    const connect = (): void => {
      if (cancelled) return;
      const es = new EventSource("/api/events");
      es.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        backoff = 500;
      };
      es.onmessage = (ev) => {
        try {
          const entry = JSON.parse(ev.data) as LogEntry;
          setEntries((prev) => {
            const next = [...prev, entry];
            return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
          });
        } catch {
          /* drop malformed */
        }
      };
      es.onerror = () => {
        es.close();
        if (cancelled) return;
        setConnected(false);
        reconnectTimer.current = window.setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 10_000);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer.current !== undefined) window.clearTimeout(reconnectTimer.current);
    };
  }, []);

  return { entries, connected };
}
