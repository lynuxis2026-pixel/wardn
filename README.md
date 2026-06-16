# wardn

**See and stop the risky code your AI agents run.**

`wardn` is a local-first MCP control plane for developers using Claude Desktop, Cursor, VS Code,
Codex, or custom agents. One command discovers your MCP servers, explains their risk, routes calls
through a local gateway, and lets you sandbox the dangerous ones.

> A [Lynuxis](https://lynuxis.nl) project.

![wardn dashboard preview](assets/wardn-dashboard.svg)

## Why wardn exists

MCP servers are useful, but each one is code running with real permissions: filesystem access,
network access, shell access, and sometimes your API tokens. Most developers have no quick way to
see what is running, what it can touch, or which servers deserve trust.

`wardn` gives that visibility locally. No cloud account. No telemetry. No enterprise console. Just:

```bash
npx wardn scan
```

## The moment

```text
wardn scan

Found 5 MCP servers across 2 clients

  ● RISKY    filesystem           (claude_desktop)
             ↳ Broad filesystem access granted: "/"
  ○ REVIEW   remote-notion        (cursor)
             ↳ Remote server — data leaves your machine (mcp.example.com)
  ○ REVIEW   scraper              (cursor)
             ↳ Unpinned package version (cool-scraper-mcp) — supply-chain risk
  ○ REVIEW   weird                (cursor)
             ↳ Unrecognized launcher: "/usr/local/bin/custom-mcp"
  ✓ TRUSTED  github               (claude_desktop)

  5 servers · 1 risky · 3 review · 1 trusted
```

Then lock the risky server down:

```bash
npx wardn sandbox enable filesystem --path ~/safe-workspace
```

Start the local gateway and dashboard:

```bash
npx wardn gateway start
```

Open:

```text
http://127.0.0.1:7331/
```

Finally, route existing clients through wardn:

```bash
npx wardn rewrite apply
npx wardn rewrite restore
```

`rewrite restore` puts the original config back byte-for-byte.

## What it does

| Flow | Status | What happens |
|---|---:|---|
| Discover | Done | Reads Claude Desktop, Cursor, and VS Code MCP configs. |
| Scan | Done | Scores every server with explainable trust signals. |
| Visualize | Done | Serves a local dashboard with trust badges, policies, and live logs. |
| Gateway | Done | Proxies stdio MCP traffic and logs JSON-RPC calls. |
| Sandbox | Done | Enforces filesystem, network, and env policies before tool-calls reach the server. |
| Cross-client rewrite | Done | Rewrites client configs to route through wardn, with backups and restore. |

## Features

- **Local-first by default**: policies, logs, and backups live under `~/.wardn`.
- **Explainable trust scores**: broad filesystem access, remote transport, unpinned packages,
  arbitrary binaries, shell launchers, and credentials in env all show a human-readable reason.
- **Policy-first sandboxing**: blocks out-of-policy `tools/call` requests before they reach the MCP
  server. Docker adds optional container isolation when available.
- **Byte-faithful gateway**: forwards MCP stdio traffic while observing JSON-RPC metadata for logs.
- **Live dashboard**: Lynuxis dark UI, served by the local gateway daemon.
- **Safe config rewrite**: all rewrites are backed up and reversible.

## Commands

```text
wardn scan [--from <dir>] [--json]
wardn sandbox enable <name>  [--path <dir>]... [--allow-network] [--allow-env <key>]...
wardn sandbox disable <name>
wardn sandbox status [<name>]
wardn gateway run <name>     [--from <dir>]
wardn gateway start          [--port <n>] [--host <h>] [--from <dir>]
wardn rewrite apply          [--client <c>] [--invoke <tpl>] [--from <dir>]
wardn rewrite restore        [--client <c>] [--from <dir>]
wardn rewrite status
```

## How sandboxing works

When a policy is enabled, wardn enforces it in the gateway:

1. **Spawn policy**: known servers such as `@modelcontextprotocol/server-filesystem` are spawned
   with restricted filesystem arguments, filtered env vars, and optional Docker isolation.
2. **Tool-call policy**: outgoing `tools/call` JSON-RPC messages are inspected. Paths outside the
   whitelist or URLs while network is disabled are rejected before the MCP server sees them.
3. **Visible feedback**: the scanner reflects the policy, so a broad filesystem server can move from
   `RISKY` to `TRUSTED` once it is sandboxed.

Files:

```text
~/.wardn/policy.json      sandbox policies
~/.wardn/gateway.log      JSON-RPC event log
~/.wardn/backups/         client config backups
```

Use `WARDN_HOME=/tmp/wardn-test` to isolate test runs.

## Development

```bash
npm install
npm test
npm run build
npm run dashboard:build
npm run scan -- --from fixtures
npm pack --dry-run
```

Validation currently covers:

- gateway proxying a real MCP filesystem server
- sandbox rejection before server execution
- policy store and scanner downgrade behavior
- rewrite apply/restore with byte-identical rollback
- dashboard build and package inclusion

Requires Node 18 or newer. TypeScript, ESM, and NodeNext imports with `.js` extensions.

## Roadmap

The local MVP is complete. Next layers:

- hosted/team policies
- registry and marketplace signals
- richer Linux-native isolation
- team audit trails
- model/router integrations

## License

MIT
