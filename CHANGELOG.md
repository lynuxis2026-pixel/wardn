# Changelog

All notable changes to this project will be documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/lynuxis2026-pixel/wardn/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/lynuxis2026-pixel/wardn/releases/tag/v0.0.1
