# Launch checklist — wardn v0.1.0

The zero-budget path. No Twitter, no paid domain, no marketing spend.
HN + Reddit + GitHub Pages + free npm account is plenty for v1.

## What you actually need

| | Account | Cost | Time |
|---|---|---|---|
| 1 | npm | free | 5 min — npmjs.com/signup |
| 2 | Hacker News | free | 2 min — news.ycombinator.com |
| 3 | Reddit | free | use existing or 2 min |
| 4 | Dev.to (optional) | free | login via GitHub |

That's it. No Twitter, no `wardn.dev` domain — you can add those later if the
project gains traction. GitHub Pages serves the landing for free.

## T-1 day — setup

- [ ] **`npm publish`** — log in (`npm login`), confirm `npm whoami`, then `npm publish`. 2FA prompt if enabled.
- [ ] **`npm view wardn`** — confirm the package is live and the tarball is sane.
- [ ] **GitHub release** — `gh release create v0.1.0 --generate-notes --title "v0.1.0 — first launch"`.
- [ ] **GitHub Pages** — Settings → Pages → source `main` / folder `/landing`. Live at `lynuxis2026-pixel.github.io/wardn/` after ~1 min. See [github-pages.md](github-pages.md).
- [ ] **Repo meta** — set description on GitHub. Topics: `mcp` `model-context-protocol` `ai-security` `claude` `cursor` `local-first` `mit`.
- [ ] **Social preview image** — export `assets/wardn-attack-demo.svg` to PNG 1280×640, upload via Settings → General → Social preview.
- [ ] **Fresh-install smoke** — on a different machine / VM / friend's laptop, run `npx wardn scan`. If it breaks, you're not launch-ready.
- [ ] **Read [show-hn.md](show-hn.md) aloud once.** If anything in the body sounds salesy, cut it.

## Launch day — order matters

Spread channels over 36–48 h. The first 6 h on HN is yours alone.

**T = 0** — Tuesday / Wednesday / Thursday, **08:00 PT ≈ 17:00 NL**

1. Submit Show HN with the body from [show-hn.md](show-hn.md).
2. Refresh `/newest` to confirm it landed. Don't touch anything else for 10 minutes.

**T + 10 min**

3. Comment on your own post once with the "I made the evil-mcp" angle if it helps the discussion start.

**T + 2 h**

4. Reddit, 3 subs, **3 hand-written variations** (Reddit's anti-spam catches copy-paste):
   - r/ClaudeAI — focus on MCP-in-Claude-Desktop angle
   - r/LocalLLaMA — focus on "no cloud, no telemetry"
   - r/cursor — focus on Cursor + MCP setup

**T + 4 h**

5. Open the **awesome-mcp PR** — see [awesome-mcp-pr.md](awesome-mcp-pr.md). Check first which awesome-mcp list is currently most-starred.

**T + 24 h**

6. Publish the **Dev.to article** ([devto-article.md](devto-article.md)). Free account, GitHub login.
7. Cross-post on Hashnode with canonical URL → Dev.to.

## Don't

- **Don't** claim 100% protection. Link [SECURITY.md](../../SECURITY.md) and own the threat model.
- **Don't** burst-post all channels in the first hour. Reddit + HN both penalise the pattern, especially for fresh accounts.
- **Don't** reply defensively to critical HN comments. *"Good point — here's the trade-off"* outperforms *"you're wrong"* every time.
- **Don't** upvote your own post from a second account. HN's anti-abuse catches it and dead-lists the submission.

## After launch

- Watch the curve: `gh repo view --json stargazerCount`. Twice on day 1, weekly after.
- Open follow-up issues for every concrete feature request that scored ≥ 3 upvotes on HN.
- Send a thank-you commit to the first 5 trust-registry PRs — those people are your launch coalition.

## Optional, later

These are valuable but not required for v1:

- **Twitter/X** — only when the repo has a few hundred stars; otherwise it's a 6-month grind for 200 followers. The [twitter-thread.md](twitter-thread.md) draft is ready when you have an account.
- **`wardn.dev` domain** — ~12 EUR/yr. Useful when you have something to put behind a custom URL (a hosted demo, an API). See [cloudflare.md](cloudflare.md) for the deploy when you're ready.
- **Demo GIF via `vhs`** — the animated SVG already in the repo carries the demo. A real GIF is nicer but the static SVG works fine for v1.
