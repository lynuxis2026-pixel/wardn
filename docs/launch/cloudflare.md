# Deploy `landing/` on Cloudflare Pages

Goal: serve `wardn.dev` from the `landing/` directory, no build step, free tier.

## Pre-requisites

- Cloudflare account
- `wardn.dev` domain (Porkbun / Cloudflare Registrar / Namecheap)
- The repo pushed to GitHub (it is — `lynuxis2026-pixel/wardn`)

## One-time setup (Cloudflare dashboard)

1. **Pages → Create a project → Connect to Git** → pick `lynuxis2026-pixel/wardn`.
2. **Project name**: `wardn-landing` (or anything; you'll point the custom domain at this).
3. **Production branch**: `main`.
4. **Build settings**:
   - Framework preset: `None`
   - Build command: *(leave blank)*
   - Build output directory: `landing`
5. **Environment variables**: none needed.
6. Click **Save and Deploy**. First deploy lives at `wardn-landing.pages.dev`.

## Custom domain

1. Add the domain at **Workers & Pages → wardn-landing → Custom domains → Set up a custom domain**.
2. Enter `wardn.dev`. Cloudflare will ask you to verify nameserver ownership; if the domain is already on Cloudflare DNS that's instant.
3. Cloudflare will mint the cert (TLS 1.3) and configure the CNAME for you.

## What ships

`landing/` is self-contained as of v0.1.0:

```
landing/
├── index.html       # the page
├── _headers         # security headers (CSP, HSTS, nosniff, …)
└── assets/
    └── wardn-attack-demo.svg
```

`_headers` is a Cloudflare Pages convention — it applies the listed headers to every response. Inspect with:

```bash
curl -sI https://wardn.dev | grep -i -E "strict-transport|content-security|x-content-type"
```

## Verify after deploy

- [ ] `https://wardn.dev` loads, fonts render (JetBrains Mono + Inter).
- [ ] The demo SVG plays (it's an animated SMIL SVG — should loop).
- [ ] Copy-button works (clipboard API requires HTTPS — which is given on `wardn.dev`).
- [ ] Lighthouse score ≥ 95 (the page is single static HTML + one SVG + Google Fonts).
- [ ] `view-source:` shows no broken `../assets/` paths — they should all be `./assets/`.

## Pages preview URLs

Every PR to `main` gets a preview URL like `pr-7.wardn-landing.pages.dev`. That's a free A/B sandbox for landing iteration without touching the live domain.

## Costs

- Cloudflare Pages: free up to 500 builds/month and unlimited bandwidth.
- Domain: ~12 EUR/year.
- Total v1 hosting cost: 1 EUR/month.

## When NOT to use Cloudflare Pages

If you later add server-side rendering, an auth-gated dashboard, or a Postgres-backed registry mirror — switch to Vercel or Fly.io. For a static landing this is overkill-free and the security headers are the cleanest of any static host.
