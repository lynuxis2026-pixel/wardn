# Changelog

All notable changes to this project will be documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`wardn doctor`** — diagnose the local setup: Node version, WARDN_HOME, MCP-capable clients,
  discovered servers, sandbox tooling (Docker / bubblewrap), policy validity, trust-registry
  source, dashboard build.
- **`wardn watch [--once] [--interval N]`** — periodic re-scan with diff vs.
  `~/.wardn/scan-snapshot.json`. Surfaces `+ new`, `~ changed`, `- removed`. Exits non-zero on a
  fresh `RISKY` finding — drop-in CI guard against config drift.
- **`wardn report`** — markdown trust report (summary, per-server table, sandbox policies,
  rewrite status). `--stdout` for piping; default writes `./wardn-report-YYYY-MM-DD.md`.
- **`wardn registry update / status`** — pulls the latest curated registry from the repo's
  `main` branch, validates the shape, stores it at `~/.wardn/trust-registry.json`. The scanner
  prefers the live override over the bundled `data/trust.json`.
- **`wardn rewrite apply --dry-run`** — preview every config that would be touched without
  writing to disk (no mutation, no backup, no index entry).
- **Bubblewrap isolation** for Linux — `src/sandbox/bubblewrap.ts` detects `bwrap` and wraps
  spawn with `--unshare-net`, `--ro-bind /`, and policy bind-mounts. Used automatically when
  Docker is absent.
- **Daemon auth token** — generated once on first start at `~/.wardn/api-token` (32 hex bytes,
  mode 0600). All write endpoints require `Authorization: Bearer <token>`. The dashboard reads
  the token from a loopback-only `/api/token` endpoint.

### Changed
- Trust registry loader now reads `~/.wardn/trust-registry.json` first, then falls back to
  bundled `data/trust.json` — a `wardn registry update` is enough to refresh the catalog without
  reinstalling the package.
- Sandbox enable CLI shows the active isolation tier
  (`docker + policy` / `bubblewrap + policy` / `policy-only`).

### Security
- The daemon's mutating endpoints (`POST /api/sandbox/:name`, future write routes) now require
  an authorization header. Previously the warning at startup was the only protection. Read
  endpoints stay open so the dashboard works without the round-trip.
- **`decideOutgoing` now recurses into nested objects** when looking for path arguments. Before
  this change a tool-call shaped like `{config: {filepath: "..."}}` would slip past the policy
  because `config` was not in the path-fields set. The recursion is gated by the
  `inPathContext` flag so freeform text under non-path keys still doesn't trip false positives.

### Tests
- Test suite grew from 36 → 142 specs across 24 files.
- **100% line, statement, and function coverage.** Branch coverage at 91.91% — the
  remaining 8% are nullish-coalescing defaults for things like `process.env.WARDN_HOME`,
  which we cover via test injection rather than mutating the real user environment.
- New gates: lines / functions / statements = 100%, branches ≥ 90%.
- `clients.ts` and `resolve-command.ts` refactored to take an injectable platform
  context so every OS-specific branch is exercised.
- c8 ignore blocks added on demonstrably-defensive defaults (the timingSafeEqual
  catch, the spawnSync probe arms tested via `_set*AvailableForTests`, the
  trust-registry empty fallback that only fires if the install is broken).

## [0.1.0] — first launch
### Added
- Curated trust registry at `data/trust.json` with verified-publisher lookups
  for the major MCP server packages (Anthropic, Microsoft Playwright, Notion,
  Upstash, Cloudflare). New `verified` info signal in scan output.
- `wardn demo` runs a bundled malicious MCP server (`examples/evil-mcp/`) under
  a tight sandbox and shows every attack getting blocked. Useful as the demo
  GIF in the README.
- `policy.allowedTools` lets a dev explicitly approve a tool whose name would
  otherwise be caught by the dangerous-name default-deny (e.g. `run_query`).
- Defense-in-depth in `decideOutgoing`: URLs are matched anywhere in a
  `tools/call` argument (not only `url`/`uri` fields), and tool names are
  tokenized across snake / kebab / colon / camelCase boundaries to catch
  `runQuery` / `shellExec` etc.
- Warning when `wardn gateway start` binds to a non-loopback host — the API
  has no auth in this release, so binding to `0.0.0.0` is footgun-territory.
- Coverage via `c8`: `npm run test:coverage` with gates at lines/functions ≥
  80% and branches ≥ 70%. CI gates on ubuntu+node20.
- Discovery and daemon HTTP API test suites (Fastify `inject()` for the API).
- Repo maturity: `SECURITY.md`, `CONTRIBUTING.md`, three GitHub issue forms
  (bug / feature / trust-registry), PR template, CI matrix on Ubuntu / macOS /
  Windows × Node 18 / 20 / 22, README badges, `docs/ARCHITECTURE.md`.
- Animated SVG demo at `assets/wardn-attack-demo.svg` (pure SMIL, embeds in
  the README without an external recording tool).
- Landing page placeholder at `landing/index.html` in the Lynuxis style.

### Changed
- Toggle semantics on `POST /api/sandbox/:name` with no body — first call now
  enables; subsequent calls toggle. Avoids the silent disable on first click.

### Security
- See [SECURITY.md](SECURITY.md) for the threat model and the responsible
  disclosure mailbox.

## [0.0.1] — first public preview

### Added
- Discover MCP servers from Claude Desktop, Cursor, VS Code.
- Explainable trust-scan with seven signals (broad-fs, shell-exec, arbitrary-
  binary, floating-version, unofficial-source, remote-transport, holds-secrets).
- Local stdio proxy (`wardn gateway run <name>`), Fastify daemon
  (`wardn gateway start`), SSE event stream at `/api/events`.
- Per-server sandbox policies (`~/.wardn/policy.json`) with filesystem
  whitelist, network on/off, env-whitelist. Spawn-time + runtime enforcement.
- Optional Docker isolation when available.
- React + Vite dashboard served by the daemon (`dashboard/dist`).
- Cross-client config rewrite (`wardn rewrite apply`/`restore`) with byte-
  identical backups.

[Unreleased]: https://github.com/lynuxis2026-pixel/wardn/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lynuxis2026-pixel/wardn/releases/tag/v0.1.0
[0.0.1]: https://github.com/lynuxis2026-pixel/wardn/releases/tag/v0.0.1
