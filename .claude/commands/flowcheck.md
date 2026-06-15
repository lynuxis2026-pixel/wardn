# /flowcheck — controleer alle kritieke flows

Loop de zes kritieke flows uit `CLAUDE.md` één voor één langs en rapporteer per flow PASS of FAIL met bewijs (commando + output, of test).

1. Install-flow — `npx wardn` / start zonder config
2. Discovery-flow — configs gelezen, servers verschijnen
3. Scan-flow — uitlegbare score per server, geen vals alarm
4. Sandbox-flow — sandboxen verandert aantoonbaar wat een server kan
5. Proxy-flow — echte tool-call via de gateway, identiek, in de live-log
6. Cross-client-flow — config-rewrite werkt in alle clients én is terug te draaien

Voor elke FAIL: fix het direct, en draai de flow opnieuw tot PASS. Geef aan het eind een korte tabel met de status van alle zes. Terminals alleen op de achtergrond.
