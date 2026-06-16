# Launch pack — zero-budget edition

Open in this order:

1. **[CHECKLIST.md](CHECKLIST.md)** — the master timeline (start here)
2. **[github-pages.md](github-pages.md)** — free landing host, 3 min setup
3. **[show-hn.md](show-hn.md)** — short post body + reply playbook (tuned for first-time HN accounts)
4. **[awesome-mcp-pr.md](awesome-mcp-pr.md)** — PR title + body + single-line entry
5. **[devto-article.md](devto-article.md)** — long-form launch story

### Optional, later

These exist for when the project has traction or you decide to invest:

- **[twitter-thread.md](twitter-thread.md)** — 4–5 tweets ready when you make an X account
- **[cloudflare.md](cloudflare.md)** — `wardn.dev` deploy if you ever buy the domain
- **[demo.tape](demo.tape)** — `vhs` script for a real GIF if you want one (the bundled SVG carries the demo fine for v1)

## What costs you nothing

| | |
|---|---|
| npm account | free |
| Hacker News account | free |
| Reddit account | free / existing |
| Dev.to account | free, login via GitHub |
| GitHub Pages (landing host) | free |
| GitHub releases | free |
| The repo + tests + docs | done |
| The animated demo SVG | done |

## What you can postpone

| | |
|---|---|
| Twitter / X | until you have a few hundred stars |
| `wardn.dev` domain | until you actually want a custom URL |
| Real GIF (vhs) | the static animated SVG carries v1 |
| Paid analytics | use GitHub insights for free |

## Two-minute launch sequence

```bash
npm login                  # free account if needed
npm publish                # ships v0.1.0
gh release create v0.1.0 --generate-notes
# enable GitHub Pages in repo settings (3 min, see github-pages.md)
# submit Show HN at 17:00 NL on Tue/Wed/Thu
```

After that the only thing that matters is the next 36 hours of engagement
on Hacker News.
