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

function rank(level: ScanResult["level"]): number {
  return level === "risky" ? 0 : level === "review" ? 1 : 2;
}

export function App() {
  const [scan, setScan] = useState<ScanPayload | undefined>(undefined);
  const [status, setStatus] = useState<StatusPayload | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const { entries, connected } = useEvents();

  const refresh = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([fetchScan(), fetchStatus()]);
      setScan(s);
      setStatus(st);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoaded(true);
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
    ? [...scan.results].sort((a, b) => rank(a.level) - rank(b.level) || a.server.name.localeCompare(b.server.name))
    : [];

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo" aria-hidden="true">⛨</span>
          <h1 className="brand-name">wardn</h1>
          <span className="brand-sub">local mcp control plane</span>
        </div>
        <div className="status" aria-live="polite">
          <span className={connected ? "dot dot--live" : "dot dot--off"} aria-hidden="true" />
          <span>{connected ? "live" : "reconnecting"}</span>
          {status && (
            <>
              <span className="sep" aria-hidden="true">·</span>
              <span>docker {status.docker ? "✓" : "—"}</span>
              <span className="sep" aria-hidden="true">·</span>
              <span>uptime {status.uptimeSec}s</span>
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {scan && (
        <section className="summary" aria-label="trust summary">
          <SummaryStat label="servers" value={scan.summary.total} />
          <SummaryStat label="risky" value={scan.summary.risky} tone={scan.summary.risky > 0 ? "risky" : "muted"} />
          <SummaryStat label="review" value={scan.summary.review} tone={scan.summary.review > 0 ? "review" : "muted"} />
          <SummaryStat label="trusted" value={scan.summary.trusted} tone="trusted" />
        </section>
      )}

      <main className="grid">
        <section className="servers" aria-label="discovered MCP servers">
          <h2 className="section-title">servers</h2>

          {ranked.map((r) => {
            const policy = scan?.policies[r.server.name];
            const sandboxed = !!policy?.enabled;
            const cardKey = `${r.server.name}@${r.server.client}`;
            const btnLabel = busy[r.server.name]
              ? "applying"
              : sandboxed
              ? `Disable sandbox for ${r.server.name}`
              : `Sandbox ${r.server.name}`;
            return (
              <article
                key={cardKey}
                className={`card card--${r.level}`}
                data-sandboxed={sandboxed ? "true" : undefined}
              >
                <header className="card-head">
                  <div className="card-head-id">
                    <span className={`badge badge--${r.level}`}>{BADGE_LABEL[r.level]}</span>
                    <h3 className="card-title">{r.server.name}</h3>
                    <span className="card-sub">{r.server.client}</span>
                  </div>
                  <button
                    type="button"
                    className={sandboxed ? "btn btn--on" : "btn"}
                    onClick={() => onToggleSandbox(r.server.name, sandboxed)}
                    disabled={!!busy[r.server.name]}
                    aria-label={btnLabel}
                    aria-pressed={sandboxed}
                  >
                    {busy[r.server.name] ? "…" : sandboxed ? "sandboxed ⛨" : "sandbox"}
                  </button>
                </header>

                <ul className="signals">
                  {r.signals.length === 0 && (
                    <li className="signal signal--muted">no signals — looks clean</li>
                  )}
                  {r.signals.map((s) => (
                    <li key={s.id} className={`signal signal--${s.severity}`}>
                      <span className="signal-dot" aria-hidden="true">●</span>
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

          {loaded && ranked.length === 0 && !error && (
            <div className="empty">
              <p className="empty-title">no MCP servers found</p>
              <p>Start the daemon against the bundled fixtures to see what wardn does:</p>
              <code className="empty-cmd">npx -y @ludicolijn/wardn gateway start --from fixtures</code>
            </div>
          )}
        </section>

        <section className="log" aria-label="live tool-call log">
          <h2 className="section-title">live tool-calls</h2>
          <ol className="log-list" aria-live="polite">
            {entries.length === 0 && <li className="log-empty">waiting for events…</li>}
            {entries
              .slice()
              .reverse()
              .map((e) => (
                <li
                  key={e.__id}
                  className={`log-row log-row--${e.direction}${e.isError ? " log-row--err" : ""}`}
                >
                  <span className="log-ts">{relativeTime(e.ts)}</span>
                  <span className={`log-dir log-dir--${e.direction}`}>{e.direction}</span>
                  <span className="log-server">{e.server}</span>
                  <span className="log-method">
                    {e.method ?? e.message ?? (e.isResponse ? "(response)" : "—")}
                  </span>
                  {typeof e.durationMs === "number" && <span className="log-dur">{e.durationMs}ms</span>}
                </li>
              ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

type SummaryStatProps = {
  label: string;
  value: number;
  tone?: "risky" | "review" | "trusted" | "muted";
};

function SummaryStat({ label, value, tone }: SummaryStatProps) {
  return (
    <div className={`stat stat--${tone ?? "default"}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
