# Launch checklist — wardn v0.1.0

## T-7 days

- [ ] **`npm publish`** — log in (`npm login`), confirm `npm whoami`, then `npm publish`. 2FA prompts for OTP if enabled.
- [ ] **`npm view wardn`** — confirm the name resolved and the tarball is sane.
- [ ] **Claim `wardn.dev`** at Porkbun/Cloudflare. ~12 EUR/year.
- [ ] **Cloudflare Pages** — connect repo, root directory `landing`, no build command needed (see [cloudflare.md](cloudflare.md)).
- [ ] **GitHub release** — `gh release create v0.1.0 --generate-notes` after `npm publish` so the release notes can mention the npm tarball.
- [ ] **Repo meta on GitHub** — set description, add topics: `mcp` `model-context-protocol` `ai-security` `claude` `cursor` `vscode` `local-first` `open-source`. Upload a 1280×640 social-preview image (export from `assets/wardn-attack-demo.svg`).
- [ ] **Demo GIF** — `vhs docs/launch/demo.tape` produces `demo.gif`. Sanity-check the timing.
- [ ] **Fresh-install smoke** — spin up a clean VM (or `docker run -it node:20-alpine sh`), run `npx wardn scan`. If it breaks, you're not launch-ready.
- [ ] **Draft files reviewed** — [show-hn.md](show-hn.md), [twitter-thread.md](twitter-thread.md), [awesome-mcp-pr.md](awesome-mcp-pr.md), [devto-article.md](devto-article.md) all read aloud once.

## Launch day — order matters

Spread the channels over 36–48 hours so each one has space to compound. Hacker News needs the first 6–8 hours uncontested.

**T = 0** (Tue / Wed / Thu, **08:00 PT ≈ 17:00 NL**)

1. Submit Show HN with [show-hn.md](show-hn.md) as the post body.
2. **Do not** post anywhere else for the first 10 minutes — let the HN front-page algorithm see clean organic engagement.

**T + 10 min**

3. Post the X/Twitter thread ([twitter-thread.md](twitter-thread.md)). The demo GIF goes in the first tweet, the HN link in the second.

**T + 2 h**

4. Reddit posts — separate, hand-written variations:
   - `r/ClaudeAI` — closest audience
   - `r/LocalLLaMA` — appreciates "no cloud, no telemetry"
   - `r/cursor` — for the Cursor-using devs

**T + 4 h**

5. Open the **awesome-mcp PR** ([awesome-mcp-pr.md](awesome-mcp-pr.md)).
6. DM 3–4 people who already tweet about MCP / AI-security with a *short* "thought you'd find this interesting" + the demo GIF. Not "please boost".

**T + 24 h**

7. Publish the **Dev.to article** ([devto-article.md](devto-article.md)). Title: *"I built a malicious MCP server to test my own security tool"*. SEO bait + credibility.
8. Cross-post on Hashnode + Lobsters.

**T + 48 h**

9. Roundup post in the original Show HN thread with what people said + what you'll fix in v0.1.1.

## Don't

- Don't claim 100% protection. Link [SECURITY.md](../../SECURITY.md) and own the threat model.
- Don't burst-post all channels in the first 30 minutes — Reddit and HN both penalise the pattern.
- Don't reply defensively to critical HN comments. *"Good point, here's the trade-off"* outperforms *"you're wrong"* every time.

## After launch

- Watch `gh repo view --json stargazerCount` for the curve. Two days, then weekly.
- Open follow-up issues for every concrete feature request that scored ≥ 3 upvotes on HN.
- Send a thank-you commit to the first 5 trust-registry PRs.
