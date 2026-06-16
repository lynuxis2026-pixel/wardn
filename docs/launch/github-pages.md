# Deploy `landing/` on GitHub Pages — free, no domain needed

For the zero-budget launch this replaces the Cloudflare Pages flow. You can
always migrate to a custom domain later.

## Setup (3 minutes, one-time)

1. Open https://github.com/lynuxis2026-pixel/wardn/settings/pages
2. **Source**: `Deploy from a branch`
3. **Branch**: `main`
4. **Folder**: `/landing`
5. Click **Save**

GitHub Pages now serves your landing at:

```
https://lynuxis2026-pixel.github.io/wardn/
```

The first deploy takes ~1–2 minutes. Successive pushes to `main` redeploy
automatically.

## Verify

```bash
curl -I https://lynuxis2026-pixel.github.io/wardn/
# expect: HTTP/2 200, content-type: text/html

curl -I https://lynuxis2026-pixel.github.io/wardn/assets/wardn-attack-demo.svg
# expect: HTTP/2 200, content-type: image/svg+xml
```

If you see 404, GitHub Pages may need another minute. If after 5 minutes
you still get a 404, double-check:
- Branch is `main` (not `master`)
- Folder is `/landing` exactly (case-sensitive on Linux paths)
- `landing/index.html` exists at the root of that folder

## What's served

The whole `landing/` directory:

```
landing/
├── index.html       # the page (system fonts only — loads instant)
├── _headers         # ignored by GitHub Pages; kept for when you move to CF
└── assets/
    └── wardn-attack-demo.svg
```

Note: GitHub Pages does **not** honour the `_headers` file (that's a
Cloudflare Pages convention). If you eventually need a stricter CSP or HSTS,
that's the moment to move to Cloudflare Pages — see [cloudflare.md](cloudflare.md).

## After it's live

Update everywhere `wardn.dev` appears with the GitHub Pages URL:

- [ ] README footer + intro
- [ ] `landing/index.html` `og:image` already points to GitHub raw — no change needed
- [ ] Bio of your npm account
- [ ] Show HN post body (no change — that one only links to the repo, not the landing)

## When to migrate to a real domain

Buy `wardn.dev` (or anything else) when:

- The project has ≥ 1k stars and you have a hosted thing to put behind it.
- You want stricter security headers (the `_headers` file already drafted).
- You're tired of `lynuxis2026-pixel.github.io/wardn/` as the share URL.

Until then GitHub Pages is fine — many serious projects (incl. early
Vercel, early Tailscale's docs) launched on `*.github.io` URLs.
