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

## ⏳ Increment 2 — Gateway (proxy-flow)

Lokale daemon die tussen client en MCP-servers zit, zodat we straks kunnen sandboxen, permissioneren en loggen.

**Claude Code-prompt:**
> Implementeer increment 2 (Gateway) uit BUILD_PLAN.md. Bouw `src/gateway/` als een Fastify-daemon die
> MCP-servers spawnt en hun stdio proxyt, plus een HTTP/SSE-endpoint. Log elke JSON-RPC tool-call (server,
> methode, params-samenvatting, duur). Voeg `wardn gateway` toe aan de CLI (poort + status tonen). Schrijf
> een integratietest die een echte stdio MCP-server (bv. `@modelcontextprotocol/server-filesystem` met een
> veilig sandbox-pad) door de gateway laat lopen en bevestigt dat een `tools/list`-call identiek terugkomt
> én in de log verschijnt. Loop elke flow langs. Update memory.md en BUILD_PLAN.md. Terminals op de achtergrond.

**Acceptatie:** echte tool-call loopt via de gateway, werkt identiek, staat in de live-log.

---

## ⏳ Increment 3 — Sandbox + permissies (sandbox-flow)

**Claude Code-prompt:**
> Implementeer increment 3 (Sandbox + permissies) uit BUILD_PLAN.md. Bouw `src/sandbox/`: een per-server
> permissie-manifest (filesystem-paden whitelist, netwerk aan/uit, env-whitelist) opgeslagen in een lokaal
> config-bestand. Gebruik Docker voor isolatie in de MVP: detecteer of Docker beschikbaar is en geef een
> nette, duidelijke fout als het ontbreekt. Voeg `wardn sandbox <name>` toe die het manifest toepast en de
> toggle in de config zet. Werk de scanner bij zodat een gesandboxte server zijn risky-signaal verliest
> binnen de sandbox-grenzen. Loop elke flow langs: scan → sandbox toepassen → opnieuw scannen moet aantonen
> dat de permissie echt is ingeperkt; schrijf een test die dit bewijst. Update memory.md en BUILD_PLAN.md.
> Terminals op de achtergrond.

**Acceptatie:** een server sandboxen verandert aantoonbaar wat hij kan (bv. broad-fs valt weg);
permissie-toggle werkt zichtbaar.

---

## ⏳ Increment 4 — Dashboard (visualize)

**Claude Code-prompt:**
> Implementeer increment 4 (Dashboard) uit BUILD_PLAN.md. Bouw een React/Vite-frontend in `dashboard/` in de
> donkere Lynuxis-stijl (achtergrond `#000510`, cyan accenten `#4db4dc`/`#7fd0ee`), geserveerd door de daemon
> op een lokale poort. Toon: lijst van servers met trust-badges (risky/review/trusted), per server de
> permissies en de redenen, en de live tool-call-log uit de gateway. Voeg een één-klik 'Sandbox'-knop toe die
> de sandbox-flow aanroept. Loop elke knop en elke flow langs: dashboard opent, servers laden, badges kloppen
> met `wardn scan --json`, sandbox-knop werkt end-to-end, live-log toont echte calls. Update memory.md en
> BUILD_PLAN.md. Terminals op de achtergrond.

**Acceptatie:** de "X servers, Y risky"-screenshot is reproduceerbaar in de browser; sandbox-knop werkt.

---

## ⏳ Increment 5 — Cross-client config-rewrite (cross-client-flow)

**Claude Code-prompt:**
> Implementeer increment 5 (Cross-client config-rewrite) uit BUILD_PLAN.md. Bouw `src/rewrite/`: herschrijf de
> Claude Desktop / Cursor / VS Code-configs zodat MCP-verkeer via de wardn-gateway loopt, met een backup van
> het origineel en een `wardn restore` om alles terug te zetten. Loop elke flow langs: rewrite toepassen in
> elke client, verifiëren dat de client via de gateway praat, en daarna volledig terugdraaien zonder restanten;
> schrijf tests met fixture-configs. Update memory.md en BUILD_PLAN.md. Terminals op de achtergrond.

**Acceptatie:** rewrite werkt in alle clients en is volledig terug te draaien.

---

## Daarna (fase 2/3)

- Registry/marketplace + one-click install.
- Model-router (Ollama lokaal + cloud) — hergebruik EdgeWeave/NEXUS.
- Geheugen/RAG-modules; team-features + hosted tier (verdienlijn).
- Launch: README + demo-GIF, Show HN / r/LocalLLaMA / r/ClaudeAI / X, awesome-mcp PR.
