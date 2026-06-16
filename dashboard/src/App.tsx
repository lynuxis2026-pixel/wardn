import { useCallback, useEffect, useState } from "react";
import { fetchScan, fetchStatus, toggleSandbox } from "./api.ts";
import { useEvents } from "./useEvents.ts";
import type { ScanPayload, StatusPayload, ScanResult } from "./types.ts";

const BADGE_LABEL: Record<ScanResult["level"], string> = {
  risky: "RISKY",
  review: "REVIEW",
  trusted: "TRUSTED",
};

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 1000) return "now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
  return new Date(iso).toLocaleTimeString();
}

export function App(): JSX.Element {
  const [scan, setScan] = useState<ScanPayload | undefined>(undefined);
  const [status, setStatus] = useState<StatusPayload | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const { entries, connected } = useEvents();

  const refresh = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([fetchScan(), fetchStatus()]);
      setScan(s);
      setStatus(st);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(refresh, 8_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const onToggleSandbox = useCallback(
    async (name: string, currentlyEnabled: boolean) => {
      setBusy((b) => ({ ...b, [name]: true }));
      try {
        await toggleSandbox(name, { enabled: !currentlyEnabled });
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy((b) => ({ ...b, [name]: false }));
      }
    },
    [refresh],
  );

  const ranked = scan
    ? [...scan.results].sort((a, b) => {
        const rank = (l: ScanResult["level"]): number => (l === "risky" ? 0 : l === "review" ? 1 : 2);
        return rank(a.level) - rank(b.level) || a.server.name.localeCompare(b.server.name);
      })
    : [];

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo">⛨</span>
          <span className="brand-name">wardn</span>
          <span className="brand-sub">local mcp control plane</span>
        </div>
        <div className="status">
          <span className={connected ? "dot dot--live" : "dot dot--off"} />
          <span>{connected ? "live" : "reconnecting"}</span>
          {status && (
            <>
              <span className="sep">·</span>
              <span>docker {status.docker ? "✓" : "—"}</span>
              <span className="sep">·</span>
              <span>uptime {status.uptimeSec}s</span>
            </>
          )}
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {scan && (
        <section className="summary">
          <SummaryStat label="servers" value={scan.summary.total} />
          <SummaryStat label="risky" value={scan.summary.risky} tone={scan.summary.risky > 0 ? "risky" : "muted"} />
          <SummaryStat label="review" value={scan.summary.review} tone={scan.summary.review > 0 ? "review" : "muted"} />
          <SummaryStat label="trusted" value={scan.summary.trusted} tone="trusted" />
        </section>
      )}

      <main className="grid">
        <section className="servers">
          <h2 className="section-title">servers</h2>
          {ranked.map((r) => {
            const policy = scan?.policies[r.server.name];
            const sandboxed = !!policy?.enabled;
            return (
              <article key={r.server.name + r.server.client} className={`card card--${r.level}`}>
                <header className="card-head">
                  <div>
                    <span className={`badge badge--${r.level}`}>{BADGE_LABEL[r.level]}</span>
                    <h3 className="card-title">{r.server.name}</h3>
                    <span className="card-sub">{r.server.client}</span>
                  </div>
                  <button
                    className={sandboxed ? "btn btn--on" : "btn"}
                    onClick={() => onToggleSandbox(r.server.name, sandboxed)}
                    disabled={!!busy[r.server.name]}
                  >
                    {busy[r.server.name] ? "…" : sandboxed ? "sandboxed ⛨" : "sandbox"}
                  </button>
                </header>

                <ul className="signals">
                  {r.signals.length === 0 && <li className="signal signal--muted">no signals — looks clean</li>}
                  {r.signals.map((s) => (
                    <li key={s.id} className={`signal signal--${s.severity}`}>
                      <span className="signal-dot">●</span>
                      <span>{s.reason}</span>
                    </li>
                  ))}
                </ul>

                {sandboxed && policy && (
                  <div className="policy">
                    <span className="kv">
                      <span className="k">fs</span>
                      <span className="v">{policy.filesystem.paths.join(", ") || "—"}</span>
                    </span>
                    <span className="kv">
                      <span className="k">net</span>
                      <span className="v">{policy.network ? "on" : "off"}</span>
                    </span>
                  </div>
                )}
              </article>
            );
          })}
          {ranked.length === 0 && !error && <div className="empty">no MCP servers discovered yet…</div>}
        </section>

        <section className="log">
          <h2 className="section-title">live tool-calls</h2>
          <ol className="log-list">
            {entries.length === 0 && <li className="log-empty">waiting for events…</li>}
            {entries
              .slice()
              .reverse()
              .map((e, i) => (
                <li key={i} className={`log-row log-row--${e.direction}${e.isError ? " log-row--err" : ""}`}>
                  <span className="log-ts">{relativeTime(e.ts)}</span>
                  <span className={`log-dir log-dir--${e.direction}`}>{e.direction}</span>
                  <span className="log-server">{e.server}</span>
                  <span className="log-method">{e.method ?? (e.message ?? (e.isResponse ? "(response)" : "—"))}</span>
                  {typeof e.durationMs === "number" && <span className="log-dur">{e.durationMs}ms</span>}
                </li>
              ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

interface SummaryStatProps {
  label: string;
  value: number;
  tone?: "risky" | "review" | "trusted" | "muted";
}

function SummaryStat({ label, value, tone }: SummaryStatProps): JSX.Element {
  return (
    <div className={`stat stat--${tone ?? "default"}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
