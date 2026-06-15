# wardn

**Your AI agents are running code you've never seen. `wardn` shows you what — and stops the risky parts.**
One command. Runs local. Open source.

> Status: early. `wardn scan` works today. Sandboxing, the local gateway, and the dashboard are next.
> A [Lynuxis](https://lynuxis.nl) project.

---

## Why

You're running MCP servers in Claude Desktop, Cursor, or your own agent. Each one is code with broad
permissions — filesystem access, network, shell, your API tokens. There are thousands of MCP servers in
the wild and no easy way to see what's actually running on your machine, what it can touch, or whether to
trust it. `wardn` is the local, developer-first answer.

## What it does today

```bash
npx wardn scan
```

```
wardn scan

Found 5 MCP servers across 2 clients

  ● RISKY    filesystem           (claude-desktop)
             ↳ Broad filesystem access granted: "/"
  ○ REVIEW   remote-notion        (cursor)
             ↳ Remote server — data leaves your machine (mcp.example.com)
  ○ REVIEW   scraper              (cursor)
             ↳ Unpinned package version (cool-scraper-mcp) — supply-chain risk
             ↳ Unverified source (cool-scraper-mcp)
  ○ REVIEW   weird                (cursor)
             ↳ Unrecognized launcher: "/usr/local/bin/custom-mcp"
  ✓ TRUSTED  github               (claude-desktop)

  5 servers · 1 risky · 3 review · 1 trusted
```

- **Discovers** MCP servers from your existing client configs — no setup.
- **Scores** each server for risk with **explainable** reasons (no black box, no crying wolf).
- `--json` for scripts/CI. Exits non-zero when something risky is found.

## Roadmap

- [x] Discover + trust-scan + CLI
- [ ] Local gateway (proxy every tool call, live log)
- [ ] Sandbox + per-server permissions
- [ ] Dashboard (see everything, one-click isolate)
- [ ] Cross-client config rewrite

## Develop

```bash
npm install
npm run scan -- --from fixtures   # run against the sample configs
npm run build                     # typecheck + compile to dist/
```

Requires Node ≥ 18. TypeScript, ESM. Lean by design.

## License

MIT
