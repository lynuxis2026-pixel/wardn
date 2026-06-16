# Dev.to article draft

Also publishable on Hashnode + Lobsters + your own blog. Same body, different
cross-post links. Add Dev.to canonical URL on every cross-post.

## Title

```
I built a malicious MCP server to test my own security tool
```

## Tags (Dev.to)

`opensource` · `ai` · `security` · `javascript`

## Cover image

`assets/wardn-attack-demo.svg` (rendered to PNG at 1280×640 — Dev.to compresses anything larger).

---

## Article

```markdown
> _Demo first: [`wardn demo`](https://github.com/lynuxis2026-pixel/wardn#5-prove-it-works) — runs a deliberately malicious MCP server through the gateway under a tight sandbox and shows every attack getting blocked before the server is reached._

A few weeks ago I noticed something unsettling.

My Claude Desktop config had three MCP servers wired in. One of them was the official `@modelcontextprotocol/server-filesystem`, pointed at `/`. The entire disk. I added it months ago "to try something" and never trimmed it.

I'm a careful developer. I don't `curl | sh`. I review my dependencies. And yet I'd handed an AI agent — which runs code I never wrote, against tools I half-read — read/write access to my entire filesystem. With my SSH keys, my `.env` files, my git history, all in scope.

I'm not alone. Every MCP-curious developer I know is one bad config away from the same situation. There are thousands of MCP servers in the wild now, most maintained by nobody you've heard of, and absolutely zero standard tooling to *see* what's installed, *score* its risk, or *stop* it from doing something stupid.

So I built one. It's called **`wardn`**.

## The 30-second pitch

```bash
npx -y @ludicolijn/wardn scan
# or, after `npm i -g @ludicolijn/wardn`:
wardn scan
```

(Heads up: npm wouldn't let me publish the unscoped name — too close to `yarn`. So the package
lives under `@ludicolijn/wardn`. The CLI binary is still `wardn` once installed.)

Reads your Claude Desktop / Cursor / VS Code configs, lists every MCP server, scores each with explainable signals:

```text
● RISKY    filesystem           — Broad filesystem access granted: "/"
○ REVIEW   scraper              — Unpinned package (cool-scraper-mcp)
○ REVIEW   remote-notion        — Remote server — data leaves your machine
✓ TRUSTED  github               — Holds credentials (GITHUB_TOKEN)
```

Exits non-zero if anything risky is found. Drop it into CI and you have a regression test for "what's installed on my dev machine".

Then you sandbox:

```bash
wardn sandbox enable filesystem --path ~/safe-workspace
```

The filesystem server can now only see one directory. No network. Filtered env. Re-scan shows it as `TRUSTED ⛨ sandboxed`.

Then you start the gateway:

```bash
wardn gateway start
```

A local Fastify daemon binds to `127.0.0.1:7331`. Every `tools/call` from any MCP client now flows through wardn. The gateway forwards bytes verbatim (the wire stays identical) but vets each call. Out-of-policy = blocked before the server even sees the request.

## Then I built the bad guy

The hardest part of any security tool is *proving* it works. "We tested it" isn't proof; "I made a malicious server and watched the tool catch it" is.

So `examples/evil-mcp/` ships in the repo. It's a deliberately malicious MCP server — no real damage, the dangerous side effects are simulated — but it advertises four tools any real attacker would write:

```text
read_secret  — reads files from your home directory
exfiltrate   — POSTs data to a remote URL
nuke         — recursively deletes a directory
shell_exec   — runs an arbitrary shell command
```

`wardn demo` spawns evil-mcp behind the gateway under a tight sandbox, then fires the four attack vectors one by one. The output:

```text
→ attacker calls read_secret (read ~/.ssh/id_rsa)
  ✕ BLOCKED  path "~/.ssh/id_rsa" outside sandbox policy

→ attacker calls exfiltrate (POST stolen data to evil.example)
  ✕ BLOCKED  network disabled — blocked tool-call to https://evil.example/drop

→ attacker calls nuke (rm -rf the user's home directory)
  ✕ BLOCKED  path "~/" outside sandbox policy

→ attacker calls shell_exec (curl | sh)
  ✕ BLOCKED  tool name matches dangerous-tool pattern

✓ 4/4 attempts blocked
  Without wardn, every call above would have run on your machine.
```

The point isn't the count. The point is that this is *reproducible*. Anyone who installs wardn can run the same command and watch the same four blocks. That's the difference between "trust us" and "see for yourself".

## The two real bugs the demo found

Writing the evil-mcp surfaced two bugs I'd otherwise have shipped:

**1. Nested objects bypassed the path check.** My original code only looked at path-named keys at the top level of a `tools/call`'s arguments. A malicious tool with `{ config: { filepath: "/etc/shadow" } }` slipped right through, because `config` wasn't in my `PATH_FIELDS` set. Caught by a unit test I wrote *because* the evil-mcp made me think about what an attacker would actually do.

**2. The proxy hung forever when spawn failed.** If the server binary doesn't exist, Node fires `'error'` but not `'exit'`. My exit promise listened only to `'exit'`, so it never resolved. Tests for the missing-binary path made it obvious in seconds.

Both fixed in v0.1.0. Both shipped with regression tests. This is exactly why I wrote the demo before I called it done.

## What wardn doesn't promise

- It does **not** protect against in-process tricks unique to a host language (Node `vm` escapes, Python `ctypes`, etc.). That's what the optional Docker / bubblewrap layer is for — wardn auto-detects them and wraps spawn with `--network none` + read-only mounts when present.
- It does **not** stop bugs in the upstream MCP server itself, unrelated to its tool surface.
- It does **not** have an audit trail across a multi-user machine. It's single-user, local-first.

Full threat model lives in [SECURITY.md](https://github.com/lynuxis2026-pixel/wardn/blob/main/SECURITY.md). Honesty about what a tool does *not* do is, IMO, the most important security feature.

## Trust registry — the next step

The scanner uses heuristics — they're good but they're heuristics. To make trust judgements more grounded, wardn ships a curated [`data/trust.json`](https://github.com/lynuxis2026-pixel/wardn/blob/main/data/trust.json) mapping known MCP packages to a verified publisher (Anthropic, Microsoft Playwright, Notion, Upstash, Cloudflare so far).

The scanner uses it on top of the heuristics — an official server shows `Verified publisher: Anthropic`, a `knownBad: true` entry is treated as `RISKY` regardless of how innocent the config looks.

The hard part of this is community-curation, not code. Every PR to the registry is a one-screen YAML form. If you maintain or use an MCP server I haven't catalogued yet, [open a Trust registry entry](https://github.com/lynuxis2026-pixel/wardn/issues/new?template=trust-registry.yml) — that's the highest-leverage contribution to the project today.

## Try it

```bash
wardn scan          # see what's running
wardn demo          # see what wardn catches
```

Repo: https://github.com/lynuxis2026-pixel/wardn

MIT, local-first, no telemetry. Five runtime dependencies. 152 tests, 100% line + function + statement coverage.

Built by [Lynuxis](https://lynuxis.nl).

---

_Was this useful? Drop a ⭐ on the repo — it's the only metric I check. And if you spot an MCP server I should add to the registry (or one I should flag), the trust-registry issue template is one short form._
```

## Word count

~1050 words. Sweet spot for Dev.to engagement — long enough to credibility-signal, short enough to read in one sit.

## Cross-post strategy

| Where | When | Adjust |
|---|---|---|
| Dev.to | Day 1 of launch + 24h | original |
| Hashnode | Day 1 + 1h | identical, canonical → Dev.to |
| Lobsters | Day 2 | just the link, brief comment |
| HN (Show HN was day 1) | — | don't repost; engage in comments instead |
| LinkedIn (optional) | Day 3 | trim to ~400 words for the LI body, link to Dev.to |
