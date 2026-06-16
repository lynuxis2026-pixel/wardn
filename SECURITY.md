# Security policy

`wardn` is a security tool. We try to eat our own dog food.

## Reporting a vulnerability

Please email **security@lynuxis.nl** with:

- a description of the issue and the impact you observed
- reproduction steps (a minimal MCP server config + the wardn command that exposes it is ideal)
- the wardn version (`wardn --version`), Node version, and OS

We aim to acknowledge within 72 hours and to ship a fix or mitigation within
14 days for high-severity issues. We will credit you in the release notes
unless you ask us not to.

Please do **not** open a public issue for anything that lets an MCP server
escape its sandbox, exfiltrate the user's environment, or bypass the gateway —
those go to the email above first.

## Threat model — what wardn does and does not promise

**In scope.** wardn protects against MCP servers that try to:

- read files outside their sandbox whitelist via `tools/call` path arguments
- make outbound network calls while the sandbox has `network: false`
- run arbitrary shell commands via tools whose name matches a known dangerous pattern
- exfiltrate environment variables the user did not explicitly whitelist

It does this in two layers: spawn-time policy (the server only ever sees the
allowed paths and env) and runtime tool-call interception (every JSON-RPC
`tools/call` is inspected and rejected if it leaves the policy).

**Out of scope (today).** wardn does **not** guarantee:

- isolation from in-process tricks unique to a host language (Node `vm` escapes,
  Python `ctypes`, etc.) — Docker isolation is needed for that and is optional.
- protection against bugs in the upstream MCP server itself, unrelated to its
  tool surface.
- protection if you set `network: true` and a tool then connects to an attacker.
- audit trails of who ran what on a multi-user machine — wardn is single-user.

If you spot a path argument, env var name, or tool-name pattern that wardn
should default-deny but doesn't — please report it as a vulnerability rather
than just a feature request. That gap **is** the bug.

## Operating wardn safely

- Keep `wardn scan` in CI to alert when a config grows a risky server.
- Sandbox the filesystem server (`wardn sandbox enable filesystem --path ...`)
  before the first run on a new machine.
- Use `wardn rewrite apply` so every client routes through the gateway, then
  inspect `~/.wardn/gateway.log` periodically.
- Treat anything wardn flags `RISKY` as one click away from a real incident
  until you've either sandboxed or removed it.
