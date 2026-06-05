# Beiträge zu PflegeAtlas

Schön, dass du mitmachen willst. PflegeAtlas lebt vom Wissen der Pflege-Community und dem Code-Beitrag offener Entwicklerinnen und Entwickler.

Es gibt zwei Arten beizutragen:

1. **Inhaltliche Beiträge** — Pflege-Artikel, Glossar-Erklärungen, Korrekturen.
2. **Code-Beiträge** — Frontend, Payload-Erweiterungen, Tests, Dokumentation.

## Inhaltliche Beiträge

Solange das öffentliche Submission-Formular noch im Aufbau ist, geht das per Mail an `mitmachen@pflegeatlas.org`. Bitte gib im Betreff an:

- **Neuer Artikel:** Thema und Intent (`Schnelle Hilfe am Bett` / `Hintergrundwissen` / `Lernen`).
- **Korrektur:** Link auf den bestehenden Artikel und kurze Beschreibung der Änderung.

Inhalte werden vor Veröffentlichung durch Redakteure mit pflegerischem Hintergrund geprüft.

Mit dem Einreichen stimmst du der Veröffentlichung unter [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de) zu.

## Code-Beiträge

### Setup

Siehe [README.md](./README.md#lokales-setup) — Node.js 22+, pnpm 9+, Docker für Postgres.

### Workflow

1. Issue eröffnen oder einem bestehenden Issue zustimmen, bevor du an größeren Änderungen arbeitest.
2. Vom aktuellen `main` einen Feature-Branch abzweigen (`feat/<thema>` oder `fix/<thema>`).
3. Lokal entwickeln; vor dem Push lokal grün ziehen:
   ```bash
   pnpm lint
   pnpm test
   pnpm build
   ```
4. Pull Request gegen `main` öffnen. CI muss grün sein, bevor der PR gemergt werden kann.
5. PR-Titel im Conventional-Commits-Stil (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, …).

### Code-Hinweise

- TypeScript strict, keine bewussten `any`-Casts ohne Grund.
- Komponenten konsequent token-basiert (Tailwind `@theme` in `src/app/(frontend)/styles.css`) — keine harten Tailwind-Default-Farben in produktivem Markup.
- Tests dort, wo das Verhalten nicht durch Typen abgesichert ist (Komponentenlogik, Routing, RichText-Rendering).
- Migrationen werden gegen leere DB sauber durchlaufen müssen (kein implizites Dev-Auto-Sync-Voraussetzen).

Mit dem Einreichen von Code stimmst du der Lizenzierung unter [MIT](./LICENSE) zu.

## Kommunikation

Aktuell läuft die Koordination per Mail / Issue-Tracker. Sobald sich eine sinnvolle zweite Kanal-Ebene findet (Discord/Slack/Matrix), wird das hier ergänzt.
