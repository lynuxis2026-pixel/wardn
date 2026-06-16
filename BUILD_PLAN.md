# BUILD_PLAN.md — wardn

Increments in bouwvolgorde. Elk increment is "klaar" pas als de bijbehorende flow 100% werkt
(zie de zes kritieke flows in CLAUDE.md). In Claude Code: typ `/next`, of plak de prompt hieronder.

---

## ✅ Increment 1 — Discovery + Trust-scan + CLI  (KLAAR)

Datalaag onder de virale screenshot.

**Geleverd:** `discovery/` (lezen/normaliseren van configs), `scanner/` (uitlegbare regels + aggregatie),
`cli/scan.ts` (`wardn scan`, `--json`, `--from`). Geverifieerd tegen fixtures.

**Acceptatie:** ✅ `npx wardn scan --from fixtures` toont per server een uitlegbare trust-score en een
samenvatting; geen vals alarm op officiële servers.

---

## ✅ Increment 2 — Gateway (proxy-flow)  (KLAAR)

Lokale daemon die tussen client en MCP-servers zit, zodat we straks kunnen sandboxen, permissioneren en loggen.

**Geleverd:** `src/gateway/proxy.ts` (byte-faithful stdio-proxy met JSON-RPC-parse naast de wire),
`src/gateway/logger.ts` (NDJSON-log onder `~/.wardn/gateway.log`, EventEmitter voor in-process abonnees),
`src/gateway/daemon.ts` (Fastify-daemon, `GET /status` + SSE `GET /events`, file-tail zodat cross-process
proxies óók opduiken), `src/gateway/registry.ts`, en de CLI-commando's `wardn gateway run <name>` +
`wardn gateway start`. Integratietest via `npm test` laat een echte `@modelcontextprotocol/server-filesystem`
door de proxy lopen en bevestigt `tools/list` + beide log-richtingen + duur. Manueel geverifieerd op /status,
SSE-headers, externe log-writers, en foutpaden (unknown server, remote transport).

**Acceptatie:** ✅ echte tool-call loopt via de gateway, werkt identiek, staat in de log; daemon serveert
status + SSE; integratietest groen.

---

## ✅ Increment 3 — Sandbox + permissies (sandbox-flow)  (KLAAR)

**Geleverd:** `src/sandbox/` met types + store (`~/.wardn/policy.json`), `enforce.ts`
(`applySpawnPolicy` herschrijft args + filtert env; `decideOutgoing` keert out-of-policy `tools/call`
terug als JSON-RPC `result.isError` zónder de server te bereiken), `docker.ts` (detecteert + wraps
spawn met `--network none` + read-only mounts, anders stille fallback naar policy-only met duidelijke
CLI-melding). Scanner downgradet broad-fs als de policy het pad inperkt en zet een ⛨-marker. CLI:
`wardn sandbox enable|disable|status`. Integratietest bewijst dat een out-of-policy `tools/call` door
de gateway wordt afgekapt; demo-flow scan → enable → rescan laat filesystem van RISKY naar TRUSTED gaan.

**Acceptatie:** ✅ aantoonbare inperking; scanner reflecteert het; toggle werkt zowel via CLI als HTTP-API.

---

## ✅ Increment 4 — Dashboard (visualize)  (KLAAR)

**Geleverd:** `dashboard/` (React + Vite + TypeScript) in Lynuxis-stijl (`#000510` achtergrond, cyan
`#4db4dc` accenten, monospace headings, summary-stats + ServerCards + sticky LiveLog). De daemon kreeg
`/api/status`, `/api/scan`, `POST /api/sandbox/:name` en SSE `/api/events`, plus `@fastify/static` om
`dashboard/dist` op `/` te serveren (placeholder als nog niet gebouwd). `EventSource` met
reconnect-backoff. Bouwscripts `dashboard:build` + `dashboard:dev` (Vite proxy `/api` → 7331).

**Acceptatie:** ✅ daemon serveert dashboard HTML + JS bundle; `/api/scan` toont 5/1/3/1 op fixtures;
POST `/api/sandbox/:name` zet beleid en `/api/scan` toont meteen 0 risky.

---

## ✅ Increment 5 — Cross-client config-rewrite (cross-client-flow)  (KLAAR)

**Geleverd:** `src/rewrite/` herschrijft elke stdio-server in client-configs naar
`npx -y wardn gateway run <name>` (template overrideable via `--invoke`). Remote/url-servers worden
overgeslagen. Originelen onder `~/.wardn/backups/`; een `rewrites.json`-index koppelt configs aan
backups zodat restore byte-identiek terugzet. CLI: `wardn rewrite apply|restore|status`. Tests:
apply muteert stdio servers + bewaart overige top-level keys, restore byte-identiek, dubbele apply
wordt geweigerd.

**Acceptatie:** ✅ rewrite werkt op fixtures voor zowel claude_desktop als cursor; restore geeft de
oorspronkelijke bytes terug; status laat zien wat actief is.

---

## Daarna (fase 2/3)

- Registry/marketplace + one-click install.
- Model-router (Ollama lokaal + cloud) — hergebruik EdgeWeave/NEXUS.
- Geheugen/RAG-modules; team-features + hosted tier (verdienlijn).
- Launch: README + demo-GIF, Show HN / r/LocalLLaMA / r/ClaudeAI / X, awesome-mcp PR.
