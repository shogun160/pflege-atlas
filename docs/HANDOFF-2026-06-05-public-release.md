# Handoff – Post-V1.1: Merge, CI-Fix, Public-Release

**Stand: 2026-06-05 (vierte Session am gleichen Tag, nach V1.1-Browser-Review und vor neuem Plan)** · Folge-Übergabe nach `HANDOFF-2026-06-05-v1-1.md`.

Der V1.1-Handoff bleibt als Zeitpunkt-Snapshot historisch korrekt — dieses Dokument schreibt nicht um, sondern führt fort.

## Wo wir stehen

- Repo: `/Users/oliverwosnitza/pflege-brainstorm` (lokal) — **public auf GitHub: https://github.com/shogun160/pflege-atlas**
- Branch: `main` ist HEAD; trackt `origin/main`
- HEAD: `8bf1bea` (`docs: prepare for public release — LICENSE … README … CONTRIBUTING`)
- Postgres läuft lokal (`docker compose up -d`)
- Stack unverändert: Next.js 16 + Payload CMS 3.85 + Postgres 16 + Tailwind v4 + Vitest 4
- CI auf `main`: zuletzt grün auf `8bf1bea`
- Lokale Feature-Branches `feat/v1-1-visual-polish` und `feat/v1-core-foundation` sind nicht gepusht — als Backup lokal vorhanden

## Was zwischen V1.1-Handoff und jetzt passiert ist

Vier Commits oben auf `main` über drei Themen:

1. **V1.1 nach `main` gemergt (`83fafbf`).** `--no-ff`-Merge von `feat/v1-1-visual-polish`, 21 Commits, 25 Files, +2013/-75. Tests 27/27, Build grün direkt nach dem Merge.

2. **CI-Migration-Konsolidierung (`7afa33c`).** Erster Push auf GitHub schickte die CI los — und sie schlug fehl. Latentes V1-Issue: die drei V1-Migrationen (`users_extended`, `add_articles`, `add_submissions`) machten `ALTER TABLE` und gingen davon aus, dass die Basis-Tabellen (`users` usw.) bereits existierten. Lokal funktionierte das, weil Payload im Dev-Mode beim ersten Boot ein Auto-Schema-Sync gemacht und das in `payload_migrations` als `dev` registriert hatte — in CI auf leerer DB war kein solcher Vorlauf da, `ALTER TABLE "users"` brach sofort ab. Fix: alle drei V1-Migrationen entfernt und durch eine einzige selbst-tragende `20260605_140707_init.ts` ersetzt, generiert aus einem `pg_dump --schema-only` der lokalen Dev-DB. Inklusive `payload_migrations` selbst, weil Payload diese Tabelle nicht automatisch anlegt, wenn ihr eigenes Migrate-CLI gegen eine leere DB läuft. Lokale `payload_migrations` aufgeräumt (alte Einträge gelöscht, Init als ausgeführt markiert), damit der Stand mit Realität übereinstimmt. CI auf nächstem Push: grün.

3. **Public-Release-Vorbereitung (`8bf1bea`).** Dreiteilig: `LICENSE` (MIT für Code mit explizitem Hinweis auf CC BY-SA 4.0 für Inhalte), README komplett neu (Deutsch, Stack + Setup + Befehle + Projektstruktur + Lizenz-Split + Beitrags-Pointer; löst die alte Payload-Bootstrap-Doku ab), `CONTRIBUTING.md` (getrennte Pfade für Content- vs. Code-Beiträge, PR-Workflow, Lizenz-Zustimmung beim Submit).

4. **Repo-Switch auf public + Branch Protection.** `gh repo edit --visibility public`. Anschließend Ruleset `main protection` (ID `17322358`) per Rulesets-API gesetzt, weil Free-Plans Branch Protection nur auf public Repos erlauben.

## Aktuelle Repo-Settings

- **Sichtbarkeit:** public.
- **Default-Branch:** `main`.
- **Ruleset `main protection` (active):**
  - Force-Pushes blockiert (`non_fast_forward`-Regel)
  - Branch-Löschen blockiert (`deletion`-Regel)
  - PR-Pflicht (`pull_request`-Regel, 0 Approvals erforderlich — du kannst deinen eigenen PR mergen)
  - Status-Check `ci` muss grün sein, bevor Merge-Button frei wird (`strict: false`, also kein Up-to-date-Erzwingen)
  - `bypass_actors`: `RepositoryRole` mit `actor_id: 5` (= Admin/Owner), `bypass_mode: always` — du als Owner pushst weiter direkt auf `main`. Alle Collaborators ohne Admin-Rolle (also auch `primus-homeassistant`) müssen den PR-Workflow nehmen.
- **Collaborator:** `primus-homeassistant` ist eingeladen (write-Permission). Einladung steht aus — er muss sie über E-Mail/GitHub-Notification annehmen, bevor er Zugriff hat.

## Test-/Build-/Lint-Status

- **Lint:** 0 Errors / 31 Warnings (V1-Baseline)
- **Tests:** 27/27 grün in 8 Test-Files
- **Build:** grün, alle Static-Pages werden generiert
- **CI auf `main`:** zuletzt grün auf `8bf1bea`

## Latente Findings — Stand jetzt

Die meisten V1.2-Refactor-Kandidaten aus dem V1.1-Handoff sind unverändert offen. Was sich verändert hat:

### Neu durch CI-Fix

- **Migration-Workflow ist jetzt strikt:** Schema-Änderungen müssen ab sofort als saubere Diff-Migrationen generiert werden (`pnpm payload migrate:create <name>` gegen eine DB im aktuellen Stand), die self-contained gegen leere DB laufen. Kein implizites Verlassen auf Dev-Mode-Auto-Sync mehr — sonst wieder rotes CI bei jedem Push. Setup-Anleitung in README/CONTRIBUTING erwähnt das implizit (Stelle „Migration migration:status / migrate:create"), aber explizit dokumentiert ist es nicht. Kann beim nächsten Schema-Plan (Auth, Submission) als Lehrlauf passieren.

### Neu durch Public-Release

- **Logo-PNGs sind jetzt weltweit sichtbar** (3 Files à ca. 1 MB unter `public/`). Vor V1.2 zu SVG/WebP optimieren — sonst werden sie zur ersten Anlauf-Adresse für jeden, der einen Performance-Audit macht. Plus: SVG wäre token-konsistent (Petrol/Clay direkt aus den Tailwind-Tokens ableitbar).
- **Footer-Link „Open Source auf GitHub"** zeigt aktuell auf `https://github.com/` (bare-Placeholder). Sollte jetzt, wo's eine echte Repo-URL gibt, auf `https://github.com/shogun160/pflege-atlas` zeigen. Zwei-Minuten-Fix.
- **README erwähnt eine fiktive Mailadresse** `mitmachen@pflegeatlas.org`, die noch nicht eingerichtet ist. Solange das so ist, landen die Submission-Mails im Nirwana. Domain ist registriert (`pflegeatlas.org` per Memory), aber Mail-Hosting steht aus. Vor dem ersten echten Submission-Wunsch klären — oder im README explizit als „kommt mit dem Submission-Formular".

### Aus V1.1-Reviews + Browser-Iteration (unverändert)

- **`tracking-[0.08em]` 6× dupliziert** (Article-Page Intent-Label, ArticleTOC × 3, IntentCards × 1, plus `/einreichen` × 3) — `<SectionLabel>`-Helper oder Tailwind-Theme-`tracking-label` ist überfällig.
- **IntentCards + Mitmach-Section a11y-Double-Announce** — `aria-label` plus sichtbares `<p>` mit gleichem Text auf der Homepage. Fix: `aria-labelledby` auf die `<p>`s.
- **Wordmark-Component** wird nur noch im Footer benutzt (Header trägt das Logo) — Refactor- oder Deprecation-Kandidat.
- **Mobile-Sidebar-Trigger** über Logo-Klick — Idee aus dem Review, kein Markup.
- **Search-Input ist Stub** (`<form action="/suche">`) — kein Backend.
- **Favicon-URL** unter Next 16 + Turbopack ist gehashed (`/icon-<hash>.svg`) — Browser-Resolution funktioniert, der Plan-Step-3-Smoketest mit `curl /icon` liefert 404. Keine echte Regression.
- **`tests/unit/schema-org.test.ts`** und `package.json "name"` referenzieren noch `pflegecommons` — Repo-Rename ist ein separater Plan.

### Tech-Debt aus V1 (latent)

- `toLocaleDateString('de-DE')` in `artikel/[slug]/page.tsx:59` — Node-vs-Browser-Locale-Drift.
- JSON-LD `createdAt`/`updatedAt` Coercion zwischen `Date` und `string` je nach Payload-Rückgabe.
- 6× `as any` in der Article-Page.
- Doppelte Payload-Query pro Artikel-Render (in `generateMetadata` und in der Page selbst) — Kandidat für React `cache()`-Deduplizierung.

## Was als nächstes ansteht

Plan-Wahl steht weiter aus. Kandidaten unverändert:

- **Submission-Formular** — würde den `/einreichen`-Stub zur echten Form gegen die existierende Submissions-Collection machen. Aktuell hängt der ganze Mitmach-Flow visuell schon, läuft aber im Leeren.
- **Meilisearch-Suche** — würde den Search-Stub im Hero aktivieren.
- **Auth & Editorial Workflow** — Better-Auth, Roles, Review-Queue für Submissions.
- **GitHub-Mirror-Cron** — Open-Source-Spiegel der Articles-Collection.
- **Plausible Analytics** — privacy-friendly Tracking.
- **Deployment** — Hosting, Domain-DNS, CI-zu-Production-Bridge. Hängt eng mit dem `mitmachen@pflegeatlas.org`-Mail-Setup zusammen.
- **V2 QM-Tool** — Paid-Tier (`paid: true`-Card in IntentCards).

Plus optional vorab als kleiner Pflege-Sprint:
- Footer-GitHub-Link auf die echte URL ziehen.
- Logo-PNGs optimieren.
- `<SectionLabel>`-Helper extrahieren.

Empfehlung wie schon im V1.1-Handoff: **Submission-Formular** oder **Meilisearch-Suche**, weil beide visuell schon präsent sind und im Moment „Funktion versprechen, die fehlt". Auth & Editorial ist der natürliche Vorlauf, sobald Submissions mit Review-Queue arbeiten sollen.

## Wartet auf

- Annahme der Collaborator-Einladung durch `primus-homeassistant`. Sobald da: empfehlenswert ein kleiner Test-PR (z.B. Footer-GitHub-Link-Fix), um den PR-Workflow durchzuspielen.
- Olivers Wahl des nächsten Plans.

## Geänderte Dateien seit V1.1-Handoff

```
LICENSE                                                 (neu)
CONTRIBUTING.md                                         (neu)
README.md                                               (Komplettüberarbeitung)
src/migrations/index.ts                                 (auf 1 Init reduziert)
src/migrations/20260605_140707_init.ts                  (neu, ersetzt 3 V1-Migrationen)
src/migrations/20260605_140707_init.json                (neu)
src/migrations/20260605_052951_users_extended.ts        (gelöscht)
src/migrations/20260605_052951_users_extended.json      (gelöscht)
src/migrations/20260605_053513_add_articles.ts          (gelöscht)
src/migrations/20260605_053513_add_articles.json        (gelöscht)
src/migrations/20260605_053850_add_submissions.ts       (gelöscht)
src/migrations/20260605_053850_add_submissions.json     (gelöscht)
src/app/(frontend)/artikel/[slug]/page.tsx              (Article-Footer-Links auf /einreichen)
docs/HANDOFF-2026-06-05-v1-1.md                         (post-iteration in V1.1-Session geschrieben)
docs/HANDOFF-2026-06-05-public-release.md               (dieses Dokument)
```

## URLs

- https://github.com/shogun160/pflege-atlas — Repo (public)
- https://github.com/shogun160/pflege-atlas/rules/17322358 — Branch-Ruleset
- http://localhost:3000 — Dev-Server
- http://localhost:3000/einreichen — Mitmach-Stub-Page
- http://localhost:3000/artikel/test-dekubitus-1780638316935 — Beispiel-Artikel

---

*Erstellt 2026-06-05, vierte Session. Vorgänger-Handoffs: `docs/HANDOFF-2026-06-05.md`, `docs/HANDOFF-2026-06-05-fixes.md`, `docs/HANDOFF-2026-06-05-v1-1.md`.*
