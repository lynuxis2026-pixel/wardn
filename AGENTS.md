# AGENTS.md — wardn

Projectgids voor Codex. Lees dit eerst bij elke sessie.

## Wat is wardn

Een **local-first, open-source MCP control plane**. Eén commando (`npx wardn`) laat een developer
zien welke MCP-servers er draaien, scoort elke op risico, en (binnenkort) sandboxt + governt ze.
De wig is **security-trust**: *"zie en stop de riskante code die je agents draaien."*

- Doelgroep MVP: individuele developer / kleine studio met Codex, Cursor, of een eigen agent.
- Tegen wie: enterprise control planes (JFrog, Kong, TrueFoundry, Microsoft AGT). Hun zwakte = onze kracht:
  zij zijn cloud/zwaar/lelijk voor security-teams; wij zijn `npx`, lokaal, mooi, gratis core.
- Verdienmodel: **open-core** (gratis lokale core) + betaalde hosted/team-tier + Lynuxis-dienstenfunnel.
- Merk: Lynuxis. Donkere esthetiek `#000510` + cyan `#4db4dc`. Elke screenshot = Lynuxis op de map.

## De naam

`wardn` (gestileerde "warden"). Vastgelegd als één waarde; omdopen is triviaal.
- npm: vrij. github: repo onder de Lynuxis-org. domein: `wardn.dev` te claimen.

## MVP-scope (keihard — alleen wat de virale screenshot maakt)

1. **Discover** — lees bestaande client-configs (Codex Desktop, Cursor, VS Code), lijst alle servers. ✅
2. **Scan** — trust-score per server via uitlegbare heuristiek. ✅
3. **Visualize** — dashboard met servers, permissies, trust-score. ✅
4. **Gate + sandbox** — alle MCP-traffic via lokale gateway; per-server permissies; sandbox-executie. ✅
5. **Cross-client** — één gateway, werkt in alle clients via config-rewrite. ✅

NIET in MVP: marketplace, model-router, geheugen/RAG, team/SSO/cloud — dat is fase 2/3.

## De zes kritieke flows (moeten 100% werken — werkafspraak)

- [x] **Install-flow** — `npx wardn` start zonder config.
- [x] **Discovery-flow** — bestaande configs correct gelezen, alle servers verschijnen.
- [x] **Scan-flow** — elke server een uitlegbare score; geen vals alarm.
- [x] **Sandbox-flow** — sandboxen verandert aantoonbaar wat een server kan.
- [x] **Proxy-flow** — echte tool-call loopt via de gateway, identiek, zichtbaar in de live-log.
- [x] **Cross-client-flow** — config-rewrite werkt in alle clients én is terug te draaien.

## Architectuur

```
src/
  index.ts            CLI entry (commander): scan | sandbox | gateway
  types.ts            gedeelde types (McpServer, Signal, ScanResult, TrustLevel)
  discovery/
    clients.ts        standaard config-paden per OS/client
    index.ts          lezen + parsen + normaliseren -> McpServer[]
  scanner/
    rules.ts          uitlegbare trust-signalen (de regels)
    index.ts          aggregatie -> TrustLevel + summary
  gateway/            stdio-proxy, daemon, live-log, server registry
  sandbox/            policy store, enforcement, optionele Docker-wrapper
  rewrite/            client-config rewrite + restore
  cli/
    scan.ts           `wardn scan` output (het magische moment)
    gateway.ts        `wardn gateway run|start`
    sandbox.ts        `wardn sandbox enable|disable|status`
    rewrite.ts        `wardn rewrite apply|restore|status`
dashboard/            React/Vite-dashboard in Lynuxis-stijl
fixtures/             test-configs (NIET de echte machine)
tests/                unit + integratietests voor de kritieke flows
```

Fase 1 is functioneel rond: **gateway** (Fastify-daemon, proxyt MCP over stdio + HTTP/SSE),
**sandbox** (policy-first + optionele Docker-laag), **dashboard** (React/Vite, Lynuxis-stijl),
en **rewrite** (cross-client config rewrite + restore).

## Conventies

- TypeScript, ESM, Node ≥18. **Imports met `.js`-extensie** (NodeNext). Draaien via `tsx`, builden via `tsc`.
- **Uitlegbare signalen**: elke flag heeft een leesbare `reason`. Nooit een server flaggen zonder waarom.
- **Niet crywolfen**: officiële `@modelcontextprotocol/*`-servers niet straffen voor conventioneel gebruik
  (bv. unpinned `npx -y`). Conservatief flaggen > ruis.
- Lean dependencies. Runtime nu: `commander`, `picocolors`, `fastify`, `@fastify/cors`,
  `@fastify/static`. Voeg niets toe zonder reden.
- Exit-code: `wardn scan` geeft exit 1 als er risky servers zijn (handig in CI).

## Werkafspraken (van de opdrachtgever)

1. Elk nieuw project start met een AGENTS.md + memory-file. ✅
2. Niet bouwen tot het signaal "bouwen" is gegeven; tot dan plannen/uitwerken.
3. Loop bij alles wat nieuw is **elke flow** langs — elke knop, functie, feature moet 100% werken.
4. Terminals alleen op de achtergrond gebruiken.

## Guardrails (tegen klassieke AI-coding-valkuilen)

- Maak geen stille aannames. Twijfel je over een pad/gedrag → check het of vraag het, charge niet door.
- Over-engineer niet. Houd 50 regels 50 regels; geen 500.
- Raak geen code aan die buiten de taak valt.
