# Contributing to wardn

Thanks for considering a contribution. wardn is a small, lean, opinionated
tool — keeping it that way matters more than adding features. Here is how to
help without making it bigger than it needs to be.

## High-leverage contributions

Sorted by what we'd love to see first:

1. **Trust registry entries.** The single most useful PR is adding an MCP
   server you trust (or distrust) to [`data/trust.json`](data/trust.json).
   Include the publisher, popularity, and a one-line note. If you flag
   something `knownBad: true`, attach evidence in the PR description.
2. **New scanner signals.** Spot a real-world pattern wardn misses — a tool
   name that screams "RCE", a config shape that hides a token, a launcher
   pattern that bypasses the sandbox — and add a rule in `src/scanner/rules.ts`.
   Each rule must be **explainable**: a human-readable `reason` string is
   non-negotiable. No black box.
3. **Sandbox enforcement gaps.** If you can write a `tools/call` body that
   the gateway should reject but currently forwards, that's a bug — file it
   per [SECURITY.md](SECURITY.md) first, then PR a regression test +
   fix in `src/sandbox/enforce.ts`.
4. **Client support.** Adding a new MCP-capable client to discovery is a
   one-file PR in `src/discovery/clients.ts` plus a fixture.

## What we'll likely push back on

- Heavyweight dependencies. The whole runtime is ~5 packages. Every new dep
  needs a justification in the PR description.
- Network calls from the local CLI. wardn is local-first; telemetry, auto-update
  pings, and remote rule fetching are out of scope.
- Feature flags, plugin frameworks, abstraction layers added "for later".
  Bring the real second use case in the same PR or skip the abstraction.
- Big refactors without a concrete user benefit attached.

## Local development

```bash
git clone https://github.com/lynuxis2026-pixel/wardn.git
cd wardn
npm install
npm test
```

Common commands:

```bash
npm run dev -- scan --from fixtures      # scan the bundled fixtures
npm run dev -- demo                      # the evil-mcp demo flow
npm run dashboard:dev                    # Vite dev server (proxies /api to 7331)
npm run build                            # tsc to dist/
npm run dashboard:build                  # the React dashboard to dashboard/dist/
npm pack --dry-run                       # what would end up on npm
```

Requires Node ≥ 18. TypeScript, ESM, NodeNext imports with `.js` extensions.

## Tests

Every change that touches the gateway, the sandbox, or the rewrite layer needs
a test in `tests/`. We use `node:test` directly — no Jest, no Vitest.

```bash
npm test
```

If you add a new test file, include it in the `test` script in `package.json`.

## Commit + PR style

- Imperative commit subject ("add brave-search to trust registry", not
  "added"). One concept per commit.
- PR description: what changed, why, how to test. Screenshots for any UI
  change.
- CI must pass before review. Run `npm test` locally first; it's fast.

## Code style

- TypeScript strict mode. No `any` in new code (`unknown` plus a narrow is fine).
- Errors get explicit messages. Don't catch-and-swallow; surface or rethrow.
- No comments restating what the code says. Comments explain *why* something
  is non-obvious — a hidden invariant, a workaround for a known bug, etc.
- Identifiers in English even though the team chats in Dutch.

## License

By contributing you agree your work is released under the [MIT license](LICENSE).
