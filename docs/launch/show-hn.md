# Show HN draft

> First-time HN accounts post slightly less weight than aged accounts. Two
> tactics that help: keep the post short (under 200 words), and let the demo
> do the selling instead of adjectives.

## Title

```
Show HN: Wardn – See and stop the risky code your AI agents run
```

Alternatives if the first feels too marketing:
- `Show HN: Wardn – a local-first MCP control plane`
- `Show HN: I built a malicious MCP server to test my own security tool`

The third one frames it as a story and tends to outperform pure product pitches with new accounts.

## Body (~160 words)

```
Hi HN — I built wardn after I noticed my Claude Desktop config had given an
MCP server read/write access to my entire disk for months.

  npx -y @ludicolijn/wardn scan

discovers every MCP server in Claude Desktop / Cursor / VS Code, scores each
with explainable signals (broad-fs, shell-exec, unpinned package, remote
transport, holds-secrets), exits non-zero if anything risky is found.

  npm i -g @ludicolijn/wardn

then `wardn sandbox enable filesystem --path ~/safe` locks a server to one
directory with no network. `wardn gateway start` puts a byte-faithful proxy
between any MCP client and any stdio server and rejects out-of-policy
tool-calls before they reach the server.

The reproducible proof: `wardn demo` spawns a deliberately malicious MCP
server I bundled and shows the sandbox blocking 4/4 attack vectors before
they touch the server process. The demo is the test — anyone can run it.

(npm rejected the unscoped name `wardn` as too similar to `yarn` so the
package lives under `@ludicolijn/wardn`. The CLI binary is still `wardn`
after install.)

MIT, local-first, no telemetry. Honest threat model in SECURITY.md.

https://github.com/lynuxis2026-pixel/wardn
```

## Comment-reply notes

- **"How is this different from Docker?"** → Docker is one isolation layer wardn *uses* when available. The gateway-level policy + tool-call inspection are the new bit; Docker doesn't know what a `tools/call` is.
- **"Why local-first?"** → The gateway has to sit *between* client and server. There's no remote middle to host. Plus no SaaS dashboard for something running on your laptop.
- **"What about kernel namespaces?"** → bubblewrap is wired up — wardn auto-detects `bwrap` on Linux when Docker is missing, wraps spawn with `--unshare-net` + read-only mounts.
- **Critical security comment** → "Good catch — could you open an issue (or email security@lynuxis.nl if it's exploitable)? Rather fix than argue."
- **Don't** reply defensively. *"You're right — here's the trade-off"* outperforms *"you're wrong"*, especially on a new account.

## Posting time

Tuesday / Wednesday / Thursday, **08:00 PT ≈ 17:00 NL**. Avoid Mondays
(weekend backlog flushes through) and Fridays (low traffic).

After submitting: refresh `/newest` to confirm your post is there, then don't
touch anything else for 10 minutes. Don't upvote your own post from another
account — HN's anti-abuse catches it and dead-lists you.
