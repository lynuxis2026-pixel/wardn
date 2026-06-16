# Show HN draft

## Title

```
Show HN: Wardn – See and stop the risky code your AI agents run
```

Alt-titles if the first reads spammy:
- `Show HN: Wardn – a local-first MCP control plane`
- `Show HN: Wardn – sandbox your AI agent's MCP servers in one command`

## Body (paste as the post body)

```
Hi HN, I built wardn because I kept giving my AI agent more permissions than
I'd give a colleague.

If you use Claude Desktop / Cursor / VS Code with MCP servers, each one is
code with real permissions — filesystem access, network, shell, sometimes
your API tokens. There's no easy way to see what's actually running, what it
can touch, or whether to trust it.

`npx wardn scan` discovers every MCP server in your client configs, scores it
with explainable signals (broad-fs, shell-exec, unpinned package, remote
transport, holds-secrets), and exits non-zero on risky ones so you can put it
in CI.

`npx wardn sandbox enable filesystem --path ~/safe` locks a server to one
directory with no network and a filtered env. `npx wardn gateway start` puts
a byte-faithful proxy between any MCP client and any stdio server, logs every
JSON-RPC call, and rejects out-of-policy tool-calls before the server is
reached.

The reproducible proof: `npx wardn demo` spawns a deliberately malicious MCP
server I bundled in `examples/evil-mcp/` and shows the sandbox blocking 4/4
attack vectors (path traversal, exfiltration, destructive command, shell
injection) before any of them reach the process.

It's MIT, local-first, no telemetry, no cloud account. Five runtime deps. Test
suite is 100% on lines/functions/statements (branches 92%). Honest threat
model in SECURITY.md — wardn protects against tool-call-level escapes, not
in-process Node `vm` tricks (that's what optional Docker / bubblewrap is for).

I'd love to know what real MCP setups look like out there — drop me a server
I should add to the curated trust registry, or an attack vector I missed.

Repo: https://github.com/lynuxis2026-pixel/wardn
npm:  https://www.npmjs.com/package/wardn
```

## Notes for replying to comments

- **"How is this different from Docker?"** → Docker is one of the isolation layers wardn *uses* when available; the gateway-level policy and tool-call inspection are the new bit. Docker doesn't know what a `tools/call` is.
- **"Why local-first?"** → Because the dev-tier doesn't want another SaaS dashboard for something running on their laptop, and because the gateway has to sit *between* the client and the server — there's no remote middle to host.
- **"Will you publish a hosted version?"** → Yes, team/hosted tier is on the paid track; OSS local core stays free MIT forever.
- **"What about Linux kernel namespaces?"** → bubblewrap is wired up — wardn auto-detects bwrap on Linux when Docker is missing and wraps spawn with `--unshare-net` + read-only mounts.
- **Critical security comment** → "Good catch. Could you open an issue (or email security@lynuxis.nl if it's exploitable)? I'd rather fix it than argue."

## Word count

~250 words in the body. HN's sweet spot is 150–300 — enough context, no fluff.
