# X / Twitter thread draft

## Asset

Attach `demo.gif` (generated from `docs/launch/demo.tape` via vhs) to the FIRST tweet.
Native video / GIF in tweet 1 boosts impressions significantly more than a link.

---

## Tweet 1 (the hook — no link, GIF only)

> Your AI agent has more permissions than your colleagues.
>
> I built `wardn` — a local-first MCP control plane that catches malicious tool-calls before they run.
>
> Here's a deliberately-malicious MCP server trying four attack vectors and the sandbox blocking all four 👇
>
> [GIF: demo.gif — 6 seconds, `wardn demo` showing 4/4 blocked]

## Tweet 2 (the install + GitHub link)

> One command, no setup:
>
> npx -y @ludicolijn/wardn scan
>
> Discovers every MCP server in Claude Desktop / Cursor / VS Code, scores each with explainable signals, exits non-zero if anything risky is found.
>
> https://github.com/lynuxis2026-pixel/wardn

## Tweet 3 (the how)

> The gateway sits between your MCP client and any stdio server.
>
> Bytes are forwarded verbatim — wire format stays identical. Every `tools/call` is parsed; if it leaves the policy (path outside whitelist, network when off, dangerous tool name) the gateway returns a JSON-RPC error before the server sees it.
>
> [optional: screenshot of the dashboard with a sandboxed server]

## Tweet 4 (the community angle)

> wardn ships a curated trust registry — 17 known publishers (Anthropic, Microsoft Playwright, Notion, Upstash, Cloudflare …).
>
> Spot an MCP server we should add — or one we should flag? One YAML form PR and it's in next release.
>
> https://github.com/lynuxis2026-pixel/wardn/issues/new?template=trust-registry.yml

## Tweet 5 (optional — for the security-curious)

> Honest scope: wardn catches tool-call-level escapes. It doesn't pretend to stop in-process tricks unique to a host language — that's what the optional Docker / bubblewrap layer is for, auto-detected when present.
>
> Full threat model: https://github.com/lynuxis2026-pixel/wardn/blob/main/SECURITY.md

---

## Hashtags (use sparingly, one per tweet max)

`#MCP` `#ClaudeAI` `#AIsecurity` — only on tweets where the topic is genuinely matching.

## Accounts worth mentioning (don't @-shout — *mention*, second tweet at most)

- `@AnthropicAI` (ships MCP)
- `@cursor_ai` (uses MCP)
- `@code` (VS Code, also uses MCP)

Don't tag them in tweet 1 — algorithm reads it as solicitation. Tag in tweet 3 or 4 if it organically fits.
