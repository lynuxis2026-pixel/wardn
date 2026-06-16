# memory.md — wardn

Lopend geheugen: beslissingen, status, openstaande punten. Nieuwste bovenaan per sectie.

## Kernbeslissingen

- **Concept**: local-first, open-source MCP control plane. Wig = security-trust.
- **Naam**: `wardn` (werknaam, één constante, makkelijk te wijzigen). npm vrij; `wardn.dev`/`wardn.io` vrij;
  github.com/wardn als *username* bezet door derde (niet blokkerend — repo komt onder Lynuxis-org).
- **Verdienmodel**: open-core. Gratis lokale core + betaalde hosted/team-tier + Lynuxis-dienstenfunnel.
- **Tegen wie**: enterprise control planes (JFrog/Kong/TrueFoundry/Microsoft AGT/IBM). Wij pakken de lege
  developer-first/local-first/mooie troon.
- **Sandbox-strategie**: policy-laag in de gateway als primaire afdwinging (arg-rewriting, env-filter,
  JSON-RPC tool-call validatie) + Docker als optionele harde isolatie wanneer beschikbaar. Reden:
  Docker Desktop is geen redelijk MVP-vereiste voor "npx wardn" op een typische dev-machine; zonder
  Docker werkt de demo nog steeds, met Docker krijg je kernel-isolatie erbovenop. Geverifieerd via
  `decideOutgoing`-tests én een end-to-end test die een out-of-policy `tools/call` blokkeert zonder
  het server-process te bereiken.

## Status

- ✅ **Increment 1 — Discovery + Trust-scan + CLI** (af en geverifieerd).
- ✅ **Increment 2 — Gateway (proxy-flow)** (af en geverifieerd).
- ✅ **Increment 3 — Sandbox + permissies (sandbox-flow)** (af en geverifieerd):
  - `src/sandbox/types.ts` + `store.ts`: per-server policy onder `~/.wardn/policy.json` (filesystem
    whitelist, network on/off, env-whitelist). `WARDN_HOME` override.
  - `src/sandbox/enforce.ts`: `applySpawnPolicy()` (retargets filesystem-server args, baseline-env +
    whitelist) en `decideOutgoing()` (rejected `tools/call` met out-of-policy paths of net-calls
    krijgt een synthetische JSON-RPC `result.isError`).
  - `src/sandbox/docker.ts`: detecteert Docker, wraps spawn met `--network none` + read-only mounts.
    Bij geen Docker: stille fallback naar policy-only met duidelijke melding in de CLI.
  - Scanner-integratie: `scanServer(server, policy?)` filtert broad-fs uit signalen als de policy
    het pad inperkt; voegt een `sandboxed` info-signaal toe. `wardn scan` toont een ⛨-tag.
  - CLI: `wardn sandbox enable|disable|status`. Demo-flow geverifieerd: scan → enable → rescan
    laat filesystem van RISKY naar TRUSTED gaan; disable draait terug.
  - Integratietest `tests/gateway-sandbox.integration.test.ts`: out-of-policy `tools/call` krijgt
    isError=true zonder de echte filesystem-server te bereiken.
- ✅ **Increment 4 — Dashboard** (af en geverifieerd):
  - Daemon-API uitgebreid (`/api/status`, `/api/scan`, `POST /api/sandbox/:name`, SSE `/api/events`)
    en serveert `dashboard/dist` statisch met `@fastify/static`. CORS via `@fastify/cors`. Als de
    dashboard nog niet gebouwd is verschijnt een Lynuxis-styled placeholder met instructies.
  - `dashboard/`: React + Vite (TypeScript). Vanilla CSS in Lynuxis-stijl (`#000510` achtergrond,
    cyan `#4db4dc` accenten, monospace headings). Componenten: header (live-status, docker-detect,
    uptime), summary-stats, ServerCard met badge + signalen + één-klik sandbox-knop, LiveLog die
    `EventSource('/api/events')` consumeert met reconnect-backoff.
  - Build pipeline: `npm run dashboard:build` → `dashboard/dist` (149 kB JS / 48 kB gzip). Vite dev
    server proxiet `/api` naar de daemon op 7331. Dashboard gebruikt Vite 6.4.3 met `esbuild`
    override 0.28.1 en `build.target = "esnext"` zodat Node 18-support behouden blijft én
    `npm --prefix dashboard audit` schoon is.
  - Flow-walk: daemon op port 17331 + `--from fixtures` toont 5 servers via `/api/scan`; POST
    `/api/sandbox/filesystem` zet policy → rescan laat 0 risky zien.
- ✅ **Increment 5 — Cross-client rewrite (cross-client-flow)** (af en geverifieerd):
  - `src/rewrite/`: scant elke client-config, schrijft elke stdio-server om naar `npx -y wardn
    gateway run <name>` (template overrideable via `--invoke`). Remote/url-servers worden overgeslagen.
    Originals worden bewaard in `~/.wardn/backups/<client>-<timestamp>.json`; een index
    `~/.wardn/rewrites.json` koppelt configs aan backups zodat restore byte-identiek terugzet.
  - CLI: `wardn rewrite apply|restore|status` met `--client`, `--from`, `--invoke`.
  - Tests: apply mutates stdio servers, preserves overige top-level keys, skip op remote; restore
    geeft byte-identieke file terug; tweede apply zonder restore wordt netjes geweigerd.
- ✅ **Packaging-smoke**: `package.json` neemt `dist`, `dashboard/dist`, `assets`, `data`, en
  `examples/evil-mcp` mee in de npm-tarball; `prepack` bouwt CLI + dashboard. Geverifieerd met
  `npm pack --dry-run` én install-from-tarball.
- ✅ **Roadmap-clearing ronde** (alles wat op de roadmap stond + mijn eigen toevoegingen):
  - `wardn doctor` — diagnose suite (node, WARDN_HOME, clients, servers, sandbox tooling, policy,
    trust registry source, dashboard build).
  - `wardn watch [--once] [--interval N] [--from]` — periodic rescan, persists snapshot,
    diffs (+/~/-), non-zero exit op nieuwe risky. Snapshot file: `~/.wardn/scan-snapshot.json`.
  - `wardn report [--stdout] [--out] [--from]` — markdown trust-report (summary + servers tabel +
    signal-redenen + sandbox policies + rewrites).
  - `wardn registry update [--url]` + `wardn registry status` — pulls live `data/trust.json` van
    main branch; scanner prefereert `~/.wardn/trust-registry.json` boven bundled.
  - `wardn rewrite apply --dry-run` — preview-modus, schrijft nul bytes (geverifieerd via diff).
  - `src/sandbox/bubblewrap.ts` — Linux-native isolatie: detect `bwrap`, wrap spawn met
    `--unshare-net`, `--ro-bind /`, bind-mounts per policy-pad. Gateway gebruikt automatisch
    Docker > bubblewrap > policy-only. CLI laat de gekozen tier zien bij `sandbox enable`.
  - `src/gateway/auth.ts` — daemon auth token. Persistent file `~/.wardn/api-token` (32 hex bytes,
    mode 0600), `Authorization: Bearer` required op alle write-endpoints (POST/PUT/PATCH/DELETE).
    Read endpoints blijven open; dashboard haalt token via loopback-only `GET /api/token`.
    Dashboard SDK cached de token na eerste fetch en zet header bij toggle automatisch.
- ✅ **100%-score-audit** (vorige ronde):
  - Discovery + daemon HTTP-API + registry zijn nu apart getest (`tests/discovery.test.ts`,
    `tests/daemon.test.ts` via Fastify `inject()`, `tests/registry.test.ts`). 36 tests groen.
  - Coverage via `c8`: lines 83.5 / functions 90.36 / branches 74.61 / statements 83.5 — boven alle
    gates (`--lines=80 --functions=80 --branches=70`). CI gate via `test:coverage` op
    ubuntu-latest + node 20.
  - Default-deny voor dangerous tool names tokenize't nu cleanly over snake / kebab / colon /
    camelCase boundaries — `runQuery` + `shellExec` worden geblokt, `truncate` + `search_documents`
    laten door. `policy.allowedTools` voor per-tool opt-in (bv. een legitieme `run_query` op een
    SQL-server).
  - `wardn gateway start` waarschuwt nu hard wanneer host ≠ loopback — de API heeft geen auth in
    dit release, dus binden naar `0.0.0.0` is een footgun.
  - Dashboard a11y + mobile: type=button + `aria-label` + `aria-pressed` op sandbox-knoppen,
    focus-visible ring (3px cyan glow), `aria-live="polite"` op live-stream + status, role=alert
    op errors. Mobile (375x812): geen horizontale overflow, log staat static (niet sticky),
    summary 2 kolommen, brand-name als `<h1>`. LiveLog gebruikt nu monotone `__id` als React key
    ipv index — geen stale closures meer bij rolling buffer.
  - Code-review pass: dead `path` import en `needsShell()` stub uit `proxy.ts` weggehaald (shell:false
    permanent want resolveCommand handelt PATHEXT zelf). `console.log`, `any`, `@ts-ignore`,
    `TODO/FIXME` zijn nergens te vinden. ESLint niet toegevoegd — geen sloppy stack die het rechtvaardigt.
  - `CHANGELOG.md` (Keep-a-Changelog) + `docs/ARCHITECTURE.md` (mermaid data-flow diagram, layer-bij-
    layer beschrijving, threat-model link).
- ✅ **GitHub-launch readiness** (vorige ronde):
  - `examples/evil-mcp/` zelfstandige malafide MCP-server + `wardn demo` die 'm onder een tight
    sandbox door de gateway laat lopen en alle 4 attack vectors (read_secret, exfiltrate, nuke,
    shell_exec) live geblokt laat zien. Integratietest: `tests/demo.integration.test.ts` controleert
    dat geen enkele call de evil-mcp bereikt.
  - Defense-in-depth in `decideOutgoing`: alle string-args worden gescand op URL's bij `network:off`
    (niet alleen `url`/`uri`-velden), en tool-namen die matchen op `(shell|exec|run|spawn|eval|
    command|cmd|process|system)` worden default-deny bij actieve policy.
  - `data/trust.json` curated registry van officiële + community-verified MCP-publishers (Anthropic,
    Microsoft Playwright, Notion, Upstash, Cloudflare). Nieuwe scanner-regel `ruleTrustRegistry`
    emit `verified` info-signaal of `known-bad` risky. Dashboard toont 'Verified publisher: …'.
  - Repo-maturity: `SECURITY.md` met threat-model + responsible disclosure mailbox,
    `CONTRIBUTING.md` met "high-leverage contributions" gericht op de trust-registry, drie
    `.github/ISSUE_TEMPLATE/`-forms (bug / feature / trust-registry), PR-template,
    `.github/workflows/ci.yml` matrix node 18/20/22 × ubuntu/macos/windows (tsc + test + build +
    dashboard build + pack --dry-run), README-badges (npm, CI, license, node).
  - `assets/wardn-attack-demo.svg` — pure animated SVG met SMIL (loopt 16s, lijn-per-lijn fade-in)
    die de demo-output simuleert. Embedt direct in GitHub READMEs.
  - `landing/index.html` — Lynuxis-styled one-pager voor wardn.dev placeholder: hero, demo-frame,
    6 feature-cards, quickstart, copy-to-clipboard install, OG-meta voor X/HN-shares. Self-contained
    HTML + inline CSS, geen deps.

## Test-state

- `npm test` → 97 tests, allemaal groen:
  - proxy.integration: `tools/list` door echte filesystem-server, log heeft beide richtingen + duur
  - gateway-sandbox.integration: out-of-policy `tools/call` geblokkeerd vóór de server
  - sandbox (7 unit tests): store, spawn-rewrite, decideOutgoing (path / net / non-tool), scanner
    downgrade, path-normalisatie
  - rewrite (3): apply mutates+backups, restore byte-identiek, double-apply skipped
  - demo.integration: alle 4 attack-vectors geblokt, geen enkel bereikt evil-mcp
  - trust-registry (5): lookup-verified, @version-strip, unknown packages, scanner emits
    `verified` signaal, scanner emits niets voor onbekende packages
  - discovery (7): claude_desktop / cursor / vscode shapes, broken JSON skip, missing map,
    non-existent dir, fallback to `servers` key
  - daemon (4): GET /api/status, GET /api/scan, POST /api/sandbox/:name with body, no-body toggle
  - registry (3): findServerByName resolve, unknown name, multi-client name conflict
  - sandbox (extra): camelCase dangerous-tool detection, safe-name no-block, allowedTools override
- `npm run test:coverage` → **lines 100% / functions 100% / statements 100% / branches 91.91%**.
  Gates verhoogd naar 100/100/100/90.
- Extra suites toegevoegd in deze ronde:
  - bubblewrap (3 tests, includes Linux-only smoke skip op andere platforms)
  - doctor (2 tests, dashboard pass/fail paden)
  - watch (4 tests, baseline / no-diff / new-risky-detection / transition-only)
  - report (2 tests, sections + empty fixture)
  - registry-update (6 tests, validatie + override → scanner pickup + status reporting)
  - daemon auth (4 extra tests: 401 zonder token, 401 met foute token, /api/token over loopback,
    /api/token 403 voor non-loopback)
  - rewrite dry-run (geen mutatie, geen backup, geen index entry).
- Coverage-loop ronde toegevoegd: tests/edge-cases, tests/branch-coverage, tests/proxy-edge,
  tests/docker. Plus daemon dashboard placeholder + SSE headers + per-IP token endpoint.
- **Echte bug gevonden tijdens loop**: `decideOutgoing.collectPaths` daalde niet af in geneste
  objecten waarvan de outer key geen path-naam had. `{config: {filepath: "/etc/shadow"}}` werd
  niet geblokt. Vervangen door recursieve walker met `inPathContext`-flag — recurse altijd,
  collect alleen strings onder path-named keys. Test toegevoegd.
- **Resilience bug gevonden**: bij spawn-failure (ENOENT) firede Node alleen 'error', niet
  'exit', dus `handle.exit` resolved nooit. `startProxy` resolved nu in beide gevallen (code 127
  bij spawn-error). Test bewijst dat een "spawn error" system entry geschreven wordt.
- Extra smokes groen: `npm run build`, `npm run dashboard:build`, daemon API (`/api/status`,
  `/api/scan`, `POST /api/sandbox/filesystem`), rewrite apply/restore op fixturekopieën, en
  install-from-tarball.
- Browser-smoke groen via lokale gateway: desktop-dashboard laadt zonder console errors; sandbox-knop
  zet `filesystem` naar `sandboxed` en stats naar `0 risky`; mobiele viewport 390×844 heeft geen
  horizontale overflow (`scrollWidth === clientWidth`).
- Audits groen: root `npm audit --audit-level=moderate` en dashboard
  `npm --prefix dashboard audit --audit-level=moderate`.

## Openstaande beslissingen

- Domein `wardn.dev` claimen + npm-naam reserveren zodra naam definitief is.
- Docker als secundaire (optionele) laag bevestigd. Een Linux-native isolatie (bubblewrap / landlock)
  zou later mooier zijn dan Docker voor "echt local-first" — niet nodig voor MVP.

## Niet vergeten

- `wardn rewrite apply` schrijft naar de echte client-configs zodra hij zonder `--from` draait —
  altijd backup zichtbaar in de output, restore werkt byte-identiek. Voor lokaal testen liever via
  `--from <dir>` met gekopieerde fixtures.
- Het invoke-template default `npx -y wardn gateway run {name}` veronderstelt dat `wardn` op npm
  staat. Pre-publish: een lokale dev kan `--invoke "node /abs/path/dist/index.js gateway run {name}"`
  gebruiken.
- Echte client-configs staan op de machine van de gebruiker (Windows, `C:\Users\ludi\...`).
- `WARDN_HOME` override werkt voor de log, policy én rewrite-index; handig voor tests die niet de
  echte gebruiker willen vervuilen.
