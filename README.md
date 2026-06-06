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

## Mail-Setup

PflegeAtlas verwendet [Cloudflare Email Routing](https://www.cloudflare.com/products/email-routing/) für eingehende Mails (`redaktion@pflegeatlas.org`, `mitmachen@pflegeatlas.org`) und [Resend](https://resend.com) für ausgehende Mails über `noreply@pflegeatlas.org`.

**Lokal entwickeln:** Du brauchst kein Mail-Setup. Wenn `RESEND_API_KEY` in deiner `.env` nicht gesetzt ist (Default), schreibt Payload alle Mails in die Server-Console — wie bisher.

**Mail manuell testen:** Siehe `scripts/send-test-mail.ts`. Mit gesetztem API-Key:

```bash
RESEND_API_KEY=re_xxx \
RESEND_FROM_ADDRESS=noreply@pflegeatlas.org \
pnpm tsx scripts/send-test-mail.ts redaktion@pflegeatlas.org
```

**Volle Setup-Anleitung** (Cloudflare Email Routing, Resend-Account, DNS-Records): siehe `docs/superpowers/specs/2026-06-05-pflegeatlas-mail-infra-v1-3a-design.md` §6.

### Turnstile (Spam-Schutz Submission-Formular)

Das öffentliche Submission-Formular unter `/einreichen` verwendet [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) als Spam-Schutz. Setup: Cloudflare-Dashboard → Turnstile → Site erstellen → Site Key und Secret Key in die ENV-Vars `TURNSTILE_SITE_KEY` und `TURNSTILE_SECRET_KEY` legen.

Lokal ohne diese Vars läuft Turnstile im Bypass — das Formular akzeptiert jeden Submit. Production muss die Keys gesetzt haben.

**V1.4 strukturierte Submissions:** Das Formular ist seit V1.4 typ-abhängig. Ein Vorschlag für einen neuen Artikel sammelt Titel, optional Intent und Summary, sowie vier strukturierte RichText-Sektionen (Definition / Praxis / Risiken / Quellen) analog zur `Articles`-Collection. Eine Korrektur lädt die Sektionen des bezogenen Artikels vor; per Checkboxes wählt der Einreichende, welche Sektionen er editieren möchte. Der reduzierte Lexical-Editor bietet eine 5-Button-Toolbar (Bold, Italic, Bullet-List, Numbered-List, Link).

## Beiträge

Beiträge — Code wie Inhalt — sind willkommen. Bitte vorher kurz in [CONTRIBUTING.md](./CONTRIBUTING.md) lesen.

Du willst einen Artikel oder eine Korrektur einreichen? Das geht direkt auf der laufenden Plattform unter [`/einreichen`](./src/app/(frontend)/einreichen/page.tsx) (Formular im Aufbau, vorerst per Mail an `mitmachen@pflegeatlas.org`).

## Lizenz

| Was | Lizenz |
|---|---|
| **Quellcode** (alles in `src/`, `tests/`, Config-Files) | [MIT](./LICENSE) |
| **Inhalte** (Artikel, Glossar, Illustrationen) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de) |

Mit dem Einreichen von Code stimmst du der MIT-Lizenz, mit dem Einreichen von Inhalten der CC BY-SA 4.0 zu.
