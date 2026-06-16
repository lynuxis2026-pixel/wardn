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
- ✅ **Packaging-smoke**: `package.json` neemt `dist` én `dashboard/dist` mee in de npm-tarball en
  `prepack` bouwt beide. Geverifieerd met `npm pack --dry-run` én install-from-tarball: CLI start
  en `node_modules/wardn/dashboard/dist/index.html` bestaat.

## Test-state

- `npm test` → 13 tests, allemaal groen:
  - proxy.integration: `tools/list` door echte filesystem-server, log heeft beide richtingen + duur
  - gateway-sandbox.integration: out-of-policy `tools/call` geblokkeerd vóór de server
  - sandbox (7 unit tests): store, spawn-rewrite, decideOutgoing (path / net / non-tool), scanner
    downgrade, path-normalisatie
  - rewrite (3): apply mutates+backups, restore byte-identiek, double-apply skipped
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
