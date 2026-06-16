# awesome-mcp PR draft

Target repo: https://github.com/punkpeye/awesome-mcp-servers (or whichever
"awesome-mcp" list is currently most-starred — check before submitting).

## PR title

```
Add wardn — local-first MCP control plane (discover · score · sandbox · watch)
```

## File entry

Most "awesome-X" lists keep a single-line markdown entry. Place under the
section closest to "tooling" / "security" — if none exists, propose a new
section ("Security & sandboxing").

```markdown
- [wardn](https://github.com/lynuxis2026-pixel/wardn) — Local-first MCP control plane. Discovers every MCP server in your clients, scores it for risk, sandboxes the dangerous ones, and watches every JSON-RPC tool-call live. `npx -y @ludicolijn/wardn scan` — no telemetry, MIT. [![wardn](https://img.shields.io/badge/⛨-wardn-4db4dc?labelColor=000510)](https://github.com/lynuxis2026-pixel/wardn)
```

## PR body

```markdown
## Adding `wardn`

`wardn` is a local-first MCP control plane I shipped this week.

**Install**

```bash
npx -y @ludicolijn/wardn scan        # try without installing
npm i -g @ludicolijn/wardn           # then just: wardn scan
```

The package lives under `@ludicolijn/wardn` because npm rejected the unscoped
`wardn` as too similar to `yarn`. The CLI binary is `wardn` after install.

**What it does**

- `wardn scan` — discovers MCP servers from Claude Desktop / Cursor / VS Code configs and scores each with explainable signals (broad filesystem, shell launcher, unpinned package, remote transport, credentials in env).
- `wardn sandbox enable <name>` — per-server policy file (filesystem whitelist, network on/off, env-whitelist).
- `wardn gateway start` — byte-faithful stdio proxy + Fastify daemon. Rejects out-of-policy `tools/call` before the server sees it.
- `wardn rewrite apply` — routes existing client configs through wardn with byte-identical backups.
- `wardn demo` — bundled malicious MCP server proving the sandbox blocks 4/4 attack vectors.

**Honest scope**

- Local-first. No telemetry. No cloud account. MIT-licensed.
- Catches tool-call-level escapes. Optional Docker / bubblewrap auto-detected for in-process isolation.
- Threat model documented in [SECURITY.md](https://github.com/lynuxis2026-pixel/wardn/blob/main/SECURITY.md).
- 152 tests, 100% line / function / statement coverage, branches 92.22%.

**Why I think it belongs here**

The list has plenty of *servers* — wardn is one of the few items that helps you reason about the servers themselves. Closest neighbour in scope is "security tooling for MCP", which doesn't have a section yet — happy to either slot under existing tooling or propose a new one if maintainers prefer.

Repo: https://github.com/lynuxis2026-pixel/wardn

Thanks for maintaining the list.
```

## Pre-submit checklist

- [ ] `@ludicolijn/wardn` is published on npm (so the install link works)
- [ ] Repo description is filled in on GitHub
- [ ] At least one release tag exists (v0.1.0)
- [ ] README is up-to-date with current commands
- [ ] No "TODO" sections visible in the README
