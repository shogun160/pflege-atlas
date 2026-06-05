# PflegeAtlas

Offene, qualitätsgesicherte Wissensplattform für die professionelle Pflege.

Schwerpunkt Langzeitpflege (stationär und ambulant). Inhalte sind frei nutzbar unter CC BY-SA 4.0; der Plattform-Code ist MIT.

> **Status:** in aktiver Entwicklung. V1.1 ist live (Visual Identity + Frontend Polish). Submission-Formular, Auth-Workflow und Suche sind die nächsten Iterationen.

## Stack

- **Frontend:** Next.js 16 (App Router, Server Components) + Tailwind CSS v4
- **CMS:** Payload CMS 3.85 mit Postgres-Adapter
- **Datenbank:** Postgres 16 (via Docker)
- **Tests:** Vitest 4 + React Testing Library
- **CI:** GitHub Actions (lint + test + build + payload migrate)

## Lokales Setup

Voraussetzungen: Node.js 22+, pnpm 9+, Docker (für Postgres).

```bash
# Repo klonen
git clone https://github.com/shogun160/pflege-atlas.git
cd pflege-atlas

# Env-Datei anlegen (Dev-Defaults)
cp .env.example .env

# Postgres starten
docker compose up -d

# Dependencies installieren
pnpm install

# Schema migrieren
pnpm payload migrate

# Dev-Server starten
pnpm dev
```

Anschließend:

- Frontend → http://localhost:3000
- Payload-Admin → http://localhost:3000/admin (beim ersten Aufruf wird ein Admin-User angelegt)

## Wichtige Befehle

| Befehl | Zweck |
|---|---|
| `pnpm dev` | Dev-Server mit Hot-Reload |
| `pnpm build` | Production-Build |
| `pnpm test` | Vitest-Suite (Unit + Component + Integration) |
| `pnpm lint` | ESLint |
| `pnpm payload migrate` | Datenbank-Migrationen ausführen |
| `pnpm payload migrate:status` | Status der Migrationen anzeigen |
| `pnpm payload migrate:create <name>` | Neue Migration generieren (gegen aktuelles Schema-Diff) |

## Projektstruktur

```
src/
├── app/(frontend)/         Next.js App-Router-Seiten und Layouts
├── app/(payload)/          Payload Admin-Routen
├── collections/            Payload-Collections (Articles, Users, Submissions, Media)
├── components/             React-Komponenten (Logo, Wordmark, ArticleTOC, …)
├── lib/                    Server-Utilities (Payload-Client, Schema.org)
└── migrations/             Datenbank-Migrationen
docs/                       Specs, Pläne, Handoffs
public/                     Statische Assets (Logo)
tests/
├── unit/                   Reine Logik-Tests
├── component/              RTL-Komponententests
└── integration/            End-to-End gegen Postgres
```

## Beiträge

Beiträge — Code wie Inhalt — sind willkommen. Bitte vorher kurz in [CONTRIBUTING.md](./CONTRIBUTING.md) lesen.

Du willst einen Artikel oder eine Korrektur einreichen? Das geht direkt auf der laufenden Plattform unter [`/einreichen`](./src/app/(frontend)/einreichen/page.tsx) (Formular im Aufbau, vorerst per Mail an `mitmachen@pflegeatlas.org`).

## Lizenz

| Was | Lizenz |
|---|---|
| **Quellcode** (alles in `src/`, `tests/`, Config-Files) | [MIT](./LICENSE) |
| **Inhalte** (Artikel, Glossar, Illustrationen) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de) |

Mit dem Einreichen von Code stimmst du der MIT-Lizenz, mit dem Einreichen von Inhalten der CC BY-SA 4.0 zu.
