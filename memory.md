# memory.md — wardn

Lopend geheugen: beslissingen, status, openstaande punten. Nieuwste bovenaan per sectie.

## Kernbeslissingen

- **Concept**: local-first, open-source MCP control plane. Wig = security-trust.
- **Naam**: `wardn` (werknaam, één constante, makkelijk te wijzigen). npm vrij; `wardn.dev`/`wardn.io` vrij;
  github.com/wardn als *username* bezet door derde (niet blokkerend — repo komt onder Lynuxis-org).
- **Verdienmodel**: open-core. Gratis lokale core + betaalde hosted/team-tier + Lynuxis-dienstenfunnel.
- **Tegen wie**: enterprise control planes (JFrog/Kong/TrueFoundry/Microsoft AGT/IBM). Wij pakken de lege
  developer-first/local-first/mooie troon.

## Status

- ✅ **Increment 1 — Discovery + Trust-scan + CLI** (af en geverifieerd):
  - Discovery uit standaard configs (Claude Desktop, Cursor, VS Code) + `--from <dir>` voor fixtures.
  - Uitlegbare scanner-regels: broad-fs (risky), shell-exec (risky), arbitrary-binary (review),
    floating-version (review, niet voor officiële scopes), unofficial-source (review),
    remote-transport (review), secrets-in-env (info), official (info).
  - `wardn scan` (+ `--json`, `--from`). Exit 1 bij risky.
  - Getest tegen fixtures: 5 servers → 1 risky / 3 review / 1 trusted. Lege map + json + tsc-build OK.
  - **Geleerd tijdens het langslopen van de flow**: officiële servers werden onterecht als REVIEW
    geflagd (unpinned version). Gefixt → geen vals alarm. Bevestigt de "niet-crywolfen"-regel.

## Openstaande beslissingen

- Sandbox-tech voor MVP: **Docker** als startpunt (aanname; bevestigen vóór increment 3).
- Domein `wardn.dev` claimen + npm-naam reserveren zodra naam definitief is.

## Volgende increment

- **Increment 2 — Gateway (proxy-flow)**: Fastify-daemon die MCP over stdio + HTTP/SSE proxyt en elke
  tool-call logt. Acceptatie: een echte tool-call van Claude/Cursor loopt via de gateway, werkt identiek,
  en verschijnt in de live-log.

## Niet vergeten

- Echte client-configs staan op de machine van de gebruiker (Windows, `C:\Users\ludi\...`); ik kan ze hier
  niet zien. Logica is daarom geverifieerd tegen fixtures; paden in `discovery/clients.ts` volgen de echte
  standaardlocaties.
