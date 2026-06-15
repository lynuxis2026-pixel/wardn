# START HERE — bouwen met Claude Code

Alles staat klaar. Dit zijn de exacte stappen.

## 1. Uitpakken & installeren

```bash
cd wardn
npm install
```

(Node ≥ 18; zie `.nvmrc`.)

## 2. Bewijs dat de basis werkt

```bash
npm run scan -- --from fixtures
```

Je hoort te zien: **5 servers · 1 risky · 3 review · 1 trusted**, met per server de reden.
Werkt dit, dan is increment 1 (discovery + trust-scan) bevestigd op jouw machine.

> Wil je je échte servers scannen: `npx tsx src/index.ts scan` (zonder `--from`). Dat leest je
> Claude Desktop / Cursor / VS Code-configs op de standaardlocaties.

## 3. Open Claude Code in deze map

Claude Code leest automatisch `CLAUDE.md` (projectgids + werkafspraken) bij het starten.

## 4. Bouw de volgende increment

Twee manieren:

- **Slash command:** typ `/next`. Claude Code pakt het eerstvolgende increment uit `BUILD_PLAN.md`,
  bouwt het, loopt elke flow langs tot 100%, en werkt `memory.md` + `BUILD_PLAN.md` bij.
- **Of handmatig:** open `BUILD_PLAN.md`, kopieer de "Claude Code-prompt" van increment 2, en plak hem.

Volgorde van de increments:
2. Gateway (proxy-flow) → 3. Sandbox + permissies → 4. Dashboard → 5. Cross-client rewrite.

Tussendoor `/flowcheck` om alle zes kritieke flows te verifiëren.

## 5. Vastleggen

Commit na elk werkend increment. De repo is al git-geïnitialiseerd met een eerste commit.

---

### Werkafspraken (staan ook in CLAUDE.md)
1. Elk project start met CLAUDE.md + memory — ✅ aanwezig.
2. Niet bouwen zonder signaal — jij stuurt per increment.
3. Elke flow 100% werkend bij alles wat nieuw is.
4. Terminals alleen op de achtergrond.

### Nog te beslissen (zie memory.md)
- Sandbox-tech: Docker als startpunt (bevestigen vóór increment 3).
- `wardn.dev` + npm-naam reserveren zodra de naam definitief is.
