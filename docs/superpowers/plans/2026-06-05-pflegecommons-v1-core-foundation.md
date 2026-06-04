# PflegeCommons V1 – Core Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lokal lauffähige Next.js + Payload CMS Anwendung mit Artikel-Datenmodell, Artikel-Detail-Seite (Sidebar-Layout / Mobile-TOC), Intent-basierter Startseite, Footer mit Vertrauenselementen und Basis-SEO (Sitemap, schema.org MedicalArticle).

**Architecture:** Next.js 15 (App Router) und Payload CMS 3 leben im selben Codebase und teilen sich die Postgres-Datenbank. Payload liefert Admin-UI und Collections-API, Next.js rendert die öffentlichen Seiten via React Server Components. Lokale Postgres-Instanz via Docker. TDD mit Vitest + React Testing Library für Komponenten und Utilities; Integrations-Tests für Collections über die Payload Local API.

**Tech Stack:** Node.js 22 LTS, pnpm 9, Next.js 15, Payload CMS 3, PostgreSQL 16 (Docker), TypeScript (strict), Tailwind CSS v4, Vitest 2, @testing-library/react, Docker Compose.

---

## Scope

**In scope (dieser Plan):**
- Projekt-Bootstrap (Next.js + Payload + DB)
- Datenmodell: Articles, Users, Submissions (Collections + Migrations)
- Payload Admin-UI funktionsfähig zum Anlegen/Editieren von Artikeln
- Öffentliche Artikel-Detail-Seite (Desktop-Sidebar, Mobile-kollabierbares TOC)
- Intent-basierte Startseite (4 Karten + Suchfeld als Stub)
- A-Z-Stichwort-Index
- Footer mit CC-BY-SA-Lizenzhinweis, Disclaimer, Impressum-Link-Stub
- Sitemap.xml, Open-Graph-Metatags, schema.org MedicalArticle JSON-LD
- Basis-CI (GitHub Actions: lint + test + build)

**Out of scope (eigene Pläne danach):**
- Externe Authentifizierung (Better-Auth Magic Link via Resend)
- Submission-Workflow für externe Beiträge (Form, Anti-Spam, Reviewer-Mails)
- Meilisearch-Integration (Suche ist in diesem Plan nur ein Stub-Input)
- GitHub-Mirror Cron-Job
- Deployment (Vercel + Hetzner)
- Plausible Analytics
- Stripe / V2 QM-Tool

---

## File Structure

Diese Dateien werden in diesem Plan angelegt oder modifiziert:

```
pflege-brainstorm/
├── src/
│   ├── app/
│   │   ├── (admin)/admin/[[...segments]]/page.tsx     [von create-payload-app]
│   │   ├── (public)/
│   │   │   ├── layout.tsx                              [Public layout + Footer]
│   │   │   ├── page.tsx                                [Intent-Homepage]
│   │   │   ├── artikel/[slug]/page.tsx                 [Artikel-Detail]
│   │   │   └── index/page.tsx                          [A-Z Index]
│   │   ├── sitemap.ts                                  [Sitemap Generator]
│   │   └── layout.tsx                                  [Root Layout]
│   ├── collections/
│   │   ├── Articles.ts                                 [Article Collection]
│   │   ├── Users.ts                                    [Users Collection]
│   │   └── Submissions.ts                              [Submission Pool]
│   ├── components/
│   │   ├── ArticleLayout.tsx                           [Sidebar Layout]
│   │   ├── ArticleTOC.tsx                              [Responsive TOC]
│   │   ├── IntentCards.tsx                             [Homepage Cards]
│   │   ├── Footer.tsx                                  [License/Disclaimer Footer]
│   │   └── ArticleDisclaimer.tsx                       [Per-article Disclaimer]
│   ├── lib/
│   │   ├── slugify.ts                                  [URL Slug Utility]
│   │   └── schema-org.ts                               [JSON-LD Generator]
│   └── payload.config.ts                               [Payload CMS Config]
├── tests/
│   ├── unit/
│   │   ├── slugify.test.ts
│   │   └── schema-org.test.ts
│   ├── component/
│   │   ├── ArticleTOC.test.tsx
│   │   ├── IntentCards.test.tsx
│   │   ├── Footer.test.tsx
│   │   └── ArticleDisclaimer.test.tsx
│   └── integration/
│       └── articles.test.ts                            [Payload Local API Tests]
├── .github/workflows/ci.yml                            [GitHub Actions CI]
├── docker-compose.yml                                  [Local Postgres]
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
├── tailwind.config.ts (oder Tailwind v4 inline in CSS)
├── postcss.config.mjs
├── package.json
└── .env.example
```

---

## Prerequisites

Vor Task 1 lokal vorhanden:
- **Node.js 22 LTS** (Check: `node -v` → v22.x)
- **pnpm 9+** (Check: `pnpm -v` → 9.x; install via `npm i -g pnpm` falls fehlt)
- **Docker** + Docker Compose (Check: `docker compose version`)
- **Git** und ein GitHub-Account
- Repo bereits initialisiert in `/Users/oliverwosnitza/pflege-brainstorm/`

---

## Task 1: Projekt mit create-payload-app bootstrappen

**Files:**
- Create: `package.json`, `tsconfig.json`, `src/payload.config.ts`, `src/app/...` (durch CLI generiert)
- Modify: `.gitignore` (falls Payload zusätzliche Einträge braucht)

- [ ] **Step 1.1: Aktuelles Verzeichnis prüfen**

```bash
cd /Users/oliverwosnitza/pflege-brainstorm
pwd
ls -la
```

Erwartet: `.git/`, `.gitignore`, `docs/` vorhanden, keine `package.json`.

- [ ] **Step 1.2: Payload-App in das aktuelle Verzeichnis scaffolden**

Payload 3 wird **inside** Next.js 15 installiert. Wir nutzen die offizielle CLI:

```bash
pnpm create payload-app@latest . --name pflegecommons --template blank --db postgres
```

CLI-Fragen so beantworten:
- Verwende dieses (nicht-leeres) Verzeichnis? **Ja**
- Name: `pflegecommons`
- Template: **blank**
- Database: **PostgreSQL**

Expected: erzeugt `package.json`, `next.config.ts`, `tsconfig.json`, `src/payload.config.ts`, `src/app/(payload)/...`, `src/app/(frontend)/...`.

Bei abweichendem Verhalten in aktueller Payload-Version → README in https://payloadcms.com/docs/getting-started/installation befolgen.

- [ ] **Step 1.3: Generierte Dateien sichten**

```bash
ls -la src/
cat package.json
```

Expected: `src/payload.config.ts` vorhanden, in `package.json` stehen Dependencies `payload`, `@payloadcms/next`, `@payloadcms/db-postgres`, `next` (15.x), `react` (19.x).

- [ ] **Step 1.4: Bootstrap committen**

```bash
git add -A
git status
git commit -m "chore: bootstrap Next.js 15 + Payload CMS 3 via create-payload-app"
```

---

## Task 2: Lokale Postgres-Datenbank via Docker

**Files:**
- Create: `docker-compose.yml`
- Modify: `.env`, `.env.example`

- [ ] **Step 2.1: docker-compose.yml schreiben**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: pflegecommons-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: pflege
      POSTGRES_PASSWORD: pflege_dev
      POSTGRES_DB: pflegecommons
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 2.2: .env.example schreiben**

Create `.env.example`:

```bash
# Local Postgres (matches docker-compose.yml)
DATABASE_URI=postgres://pflege:pflege_dev@localhost:5432/pflegecommons

# Payload secret (any long random string for dev; rotate for prod)
PAYLOAD_SECRET=change-me-to-a-long-random-string

# Public site URL (dev)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Dann `.env` aus `.env.example` kopieren und PAYLOAD_SECRET ersetzen:

```bash
cp .env.example .env
# In .env: PAYLOAD_SECRET durch `openssl rand -base64 48`-Ausgabe ersetzen
```

- [ ] **Step 2.3: Postgres starten**

```bash
docker compose up -d
docker compose ps
```

Expected: Container `pflegecommons-postgres` `running`. Port `5432` exposed.

- [ ] **Step 2.4: Dev-Server starten und Verbindung testen**

```bash
pnpm install
pnpm dev
```

Expected: Server läuft auf `http://localhost:3000`. Beim ersten Aufruf von `http://localhost:3000/admin` öffnet Payload die User-Anlegen-Maske. Anlegen mit z. B. `admin@local.dev` / starkes Passwort.

- [ ] **Step 2.5: Erfolg verifizieren und committen**

Im Browser einloggen können, leeres Admin-Panel sehen. Dann:

```bash
git add docker-compose.yml .env.example
git status
git commit -m "chore: add local Postgres via Docker Compose and env example"
```

⚠ `.env` bleibt ungetrackt (steht in `.gitignore`).

---

## Task 3: Tailwind CSS v4 einrichten

**Files:**
- Modify: `package.json`, `postcss.config.mjs`, `src/app/(frontend)/styles.css` (oder Äquivalent)

- [ ] **Step 3.1: Tailwind v4 installieren**

```bash
pnpm add -D tailwindcss @tailwindcss/postcss postcss
```

- [ ] **Step 3.2: postcss.config.mjs erstellen**

Create or update `postcss.config.mjs`:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 3.3: Globales CSS um Tailwind erweitern**

Modify `src/app/(frontend)/styles.css` (Datei vom Bootstrap vorhanden; ansonsten erstellen) — Inhalt ersetzen durch:

```css
@import "tailwindcss";

:root {
  --color-brand: #2563eb;
}

body {
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  background: #fff;
  color: #1f2937;
}
```

- [ ] **Step 3.4: In Root-Layout importieren**

`src/app/(frontend)/layout.tsx` öffnen, sicherstellen dass `import './styles.css'` ganz oben steht. Falls nicht vorhanden, hinzufügen.

- [ ] **Step 3.5: Smoke-Test**

```bash
pnpm dev
```

`http://localhost:3000` öffnen. Eine Test-Klasse einbauen, z. B. in `src/app/(frontend)/page.tsx`:

```tsx
<div className="bg-blue-600 text-white p-4">Tailwind v4 läuft</div>
```

Erwartet: blauer Hintergrund, weiße Schrift. Danach Test-Element entfernen.

- [ ] **Step 3.6: Commit**

```bash
git add -A
git commit -m "chore: configure Tailwind CSS v4"
```

---

## Task 4: Vitest + Testing Library einrichten

**Files:**
- Create: `vitest.config.ts`, `tests/setup.ts`
- Modify: `package.json` (test scripts)

- [ ] **Step 4.1: Dev-Dependencies installieren**

```bash
pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom
```

- [ ] **Step 4.2: vitest.config.ts schreiben**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4.3: tests/setup.ts schreiben**

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 4.4: Test-Scripts in package.json**

`package.json` `scripts` ergänzen:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4.5: Smoke-Test mit Trivial-Test**

Create `tests/unit/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('läuft', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run:

```bash
pnpm test
```

Expected: 1 passing test.

Danach `tests/unit/smoke.test.ts` wieder löschen.

- [ ] **Step 4.6: Commit**

```bash
git add -A
git commit -m "chore: configure Vitest + Testing Library"
```

---

## Task 5: slugify-Utility (TDD)

**Files:**
- Create: `src/lib/slugify.ts`
- Create: `tests/unit/slugify.test.ts`

Diese Utility wandelt Artikel-Titel in URL-Slugs („Dekubitusprophylaxe" → „dekubitusprophylaxe", „Demenz & Aggression" → „demenz-aggression").

- [ ] **Step 5.1: Failing Test schreiben**

Create `tests/unit/slugify.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/slugify';

describe('slugify', () => {
  it('macht einfache Titel kleingeschrieben', () => {
    expect(slugify('Dekubitus')).toBe('dekubitus');
  });

  it('ersetzt Leerzeichen durch Bindestriche', () => {
    expect(slugify('Akute Pflegesituation')).toBe('akute-pflegesituation');
  });

  it('behandelt deutsche Umlaute', () => {
    expect(slugify('Übergabegespräch')).toBe('uebergabegespraech');
    expect(slugify('Ärztliche Anordnung')).toBe('aerztliche-anordnung');
    expect(slugify('Öffentlich')).toBe('oeffentlich');
    expect(slugify('Straße')).toBe('strasse');
  });

  it('entfernt Sonderzeichen', () => {
    expect(slugify('Demenz & Aggression')).toBe('demenz-aggression');
    expect(slugify('SIS / AEDL')).toBe('sis-aedl');
  });

  it('kollabiert mehrfache Bindestriche', () => {
    expect(slugify('Foo  —  Bar')).toBe('foo-bar');
  });

  it('trimmt führende und trailing Bindestriche', () => {
    expect(slugify('  -Dekubitus-  ')).toBe('dekubitus');
  });

  it('wirft bei leerer Eingabe nicht, gibt leeren String', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
  });
});
```

- [ ] **Step 5.2: Test laufen lassen → muss fehlschlagen**

```bash
pnpm test tests/unit/slugify.test.ts
```

Expected: FAIL mit „Cannot find module '@/lib/slugify'".

- [ ] **Step 5.3: Minimale Implementierung schreiben**

Create `src/lib/slugify.ts`:

```ts
const UMLAUT_MAP: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
};

export function slugify(input: string): string {
  if (!input) return '';

  const transliterated = input.replace(/[äöüÄÖÜß]/g, (c) => UMLAUT_MAP[c] ?? c);

  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 5.4: Tests laufen lassen → müssen passen**

```bash
pnpm test tests/unit/slugify.test.ts
```

Expected: alle 7 Tests grün.

- [ ] **Step 5.5: Commit**

```bash
git add src/lib/slugify.ts tests/unit/slugify.test.ts
git commit -m "feat: add slugify utility for German article URLs"
```

---

## Task 6: Users Collection (Editor / Reviewer / Contributor)

**Files:**
- Create: `src/collections/Users.ts`
- Modify: `src/payload.config.ts` (Collection registrieren)

Payload hat Users standardmäßig schon vom Bootstrap. Wir erweitern um Rollen.

- [ ] **Step 6.1: Users.ts schreiben**

Create `src/collections/Users.ts`:

```ts
import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'displayName'],
  },
  fields: [
    {
      name: 'displayName',
      type: 'text',
      label: 'Anzeigename',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      label: 'Rolle',
      required: true,
      defaultValue: 'contributor',
      options: [
        { label: 'Redakteur:in', value: 'editor' },
        { label: 'Reviewer:in', value: 'reviewer' },
        { label: 'Beitragende:r', value: 'contributor' },
      ],
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Kurzprofil (sichtbar auf Autorenseite)',
    },
  ],
};
```

- [ ] **Step 6.2: Collection in payload.config.ts registrieren**

`src/payload.config.ts` öffnen, im `collections`-Array `Users` referenzieren. Falls vom Bootstrap schon ein anderer Users-Eintrag existiert: durch `Users` aus `src/collections/Users.ts` ersetzen. Beispiel-Schnipsel:

```ts
import { Users } from './collections/Users';

// im buildConfig({...})
collections: [Users],
```

- [ ] **Step 6.3: Migration generieren und ausführen**

Payload mit Postgres benötigt eine Migration:

```bash
pnpm payload migrate:create users-extended
pnpm payload migrate
```

Expected: Migration läuft ohne Fehler.

- [ ] **Step 6.4: Manuell in Admin verifizieren**

```bash
pnpm dev
```

Im Admin (`/admin`) → Users → Eintrag öffnen. Felder `displayName`, `role`, `bio` müssen erscheinen.

- [ ] **Step 6.5: Commit**

```bash
git add src/collections/Users.ts src/payload.config.ts src/migrations/
git commit -m "feat: extend Users collection with role and displayName"
```

---

## Task 7: Articles Collection (mit struktureller Sektion)

**Files:**
- Create: `src/collections/Articles.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 7.1: Articles.ts schreiben**

Create `src/collections/Articles.ts`:

```ts
import type { CollectionConfig } from 'payload';
import { slugify } from '../lib/slugify';

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'lastReviewedAt', 'standardsBound'],
  },
  versions: {
    drafts: true,
    maxPerDoc: 50,
  },
  access: {
    read: ({ req: { user } }) => {
      if (user) return true;
      return {
        status: { equals: 'published' },
      };
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Titel',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'URL-Slug',
      required: true,
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [
          ({ data, value }) => {
            if (value) return value;
            if (data?.title) return slugify(data.title);
            return value;
          },
        ],
      },
      admin: {
        description: 'Wird aus dem Titel generiert, kann überschrieben werden.',
      },
    },
    {
      name: 'intent',
      type: 'select',
      label: 'Intent (Startseiten-Kategorie)',
      required: true,
      options: [
        { label: 'Schnelle Hilfe am Bett', value: 'bedside' },
        { label: 'Hintergrundwissen', value: 'background' },
        { label: 'Etwas zum Lernen', value: 'learning' },
      ],
    },
    {
      name: 'summary',
      type: 'textarea',
      label: 'Kurzbeschreibung (für Listen & Open Graph)',
      required: true,
      maxLength: 280,
    },
    {
      name: 'definition',
      type: 'richText',
      label: '1. Definition / Kurzantwort',
      required: true,
    },
    {
      name: 'praxis',
      type: 'richText',
      label: '2. Praxis (inkl. eingewobenem Erfahrungswissen)',
      required: true,
    },
    {
      name: 'risiken',
      type: 'richText',
      label: '3. Risiken & Fallstricke',
      required: true,
    },
    {
      name: 'quellen',
      type: 'richText',
      label: '4. Quellen & Weiterführendes',
      required: true,
    },
    {
      name: 'authors',
      type: 'relationship',
      label: 'Autor:innen',
      relationTo: 'users',
      hasMany: true,
      required: true,
    },
    {
      name: 'reviewedBy',
      type: 'relationship',
      label: 'Geprüft von',
      relationTo: 'users',
      hasMany: true,
    },
    {
      name: 'lastReviewedAt',
      type: 'date',
      label: 'Zuletzt geprüft am',
    },
    {
      name: 'standardsBound',
      type: 'checkbox',
      label: 'Standardgebunden (automatische Review-Erinnerung nach 18 Monaten)',
      defaultValue: false,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      defaultValue: 'draft',
      options: [
        { label: 'Entwurf', value: 'draft' },
        { label: 'In Review', value: 'in_review' },
        { label: 'Veröffentlicht', value: 'published' },
        { label: 'Archiviert', value: 'archived' },
      ],
    },
  ],
};
```

- [ ] **Step 7.2: Collection registrieren**

`src/payload.config.ts` `collections`-Array erweitern:

```ts
import { Articles } from './collections/Articles';

collections: [Users, Articles],
```

- [ ] **Step 7.3: Migration generieren und ausführen**

```bash
pnpm payload migrate:create add-articles
pnpm payload migrate
```

- [ ] **Step 7.4: Verifizieren im Admin**

```bash
pnpm dev
```

Im Admin: Articles → „Add new" → einen Testartikel anlegen, z. B. Titel „Dekubitusprophylaxe", Intent „Schnelle Hilfe am Bett", alle vier Sektionen mit Lorem-Ipsum-Text füllen, Status „Veröffentlicht". Speichern.

Slug muss automatisch zu `dekubitusprophylaxe` werden.

- [ ] **Step 7.5: Commit**

```bash
git add src/collections/Articles.ts src/payload.config.ts src/migrations/
git commit -m "feat: add Articles collection with structured sections and versioning"
```

---

## Task 8: Submissions Collection (Pool für externe Beiträge)

**Files:**
- Create: `src/collections/Submissions.ts`
- Modify: `src/payload.config.ts`

Dieser Pool nimmt externe Vorschläge auf (sowohl Korrekturen als auch komplett neue Artikel). Der eigentliche Submission-Formular-Flow kommt in einem späteren Plan; jetzt nur das Schema, damit Redakteure manuell Test-Einträge sehen können.

- [ ] **Step 8.1: Submissions.ts schreiben**

Create `src/collections/Submissions.ts`:

```ts
import type { CollectionConfig } from 'payload';

export const Submissions: CollectionConfig = {
  slug: 'submissions',
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'type', 'reviewStatus', 'createdAt'],
  },
  access: {
    // Nur eingeloggte Redakteure / Reviewer sehen Submissions
    read: ({ req: { user } }) => Boolean(user),
    create: () => true, // Öffentliche Form kann später unauthenticated submitten
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) =>
      user?.role === 'editor',
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      label: 'Art',
      required: true,
      options: [
        { label: 'Neuer Artikel-Vorschlag', value: 'new_article' },
        { label: 'Korrekturvorschlag', value: 'correction' },
      ],
    },
    {
      name: 'subject',
      type: 'text',
      label: 'Betreff / Artikel',
      required: true,
    },
    {
      name: 'relatedArticle',
      type: 'relationship',
      label: 'Bezogen auf Artikel (nur bei Korrektur)',
      relationTo: 'articles',
      admin: {
        condition: (data) => data?.type === 'correction',
      },
    },
    {
      name: 'body',
      type: 'textarea',
      label: 'Inhalt / Vorschlag',
      required: true,
    },
    {
      name: 'submitterName',
      type: 'text',
      label: 'Name (optional)',
    },
    {
      name: 'submitterEmail',
      type: 'email',
      label: 'E-Mail (für Rückfragen)',
    },
    {
      name: 'reviewStatus',
      type: 'select',
      label: 'Review-Status',
      defaultValue: 'pending',
      options: [
        { label: 'Eingegangen', value: 'pending' },
        { label: 'In Review', value: 'in_review' },
        { label: 'Übernommen', value: 'accepted' },
        { label: 'Abgelehnt', value: 'rejected' },
      ],
    },
    {
      name: 'reviewerNotes',
      type: 'textarea',
      label: 'Interne Notizen der Redaktion',
    },
  ],
};
```

- [ ] **Step 8.2: Registrieren**

`src/payload.config.ts`:

```ts
import { Submissions } from './collections/Submissions';

collections: [Users, Articles, Submissions],
```

- [ ] **Step 8.3: Migration**

```bash
pnpm payload migrate:create add-submissions
pnpm payload migrate
```

- [ ] **Step 8.4: Manuelles Verifizieren**

Im Admin: Submissions → „Add new" → Test-Eintrag (z. B. „Neuer Artikel-Vorschlag: Sturzprophylaxe"). Felder müssen alle erscheinen, `relatedArticle` nur bei Typ „Korrektur".

- [ ] **Step 8.5: Commit**

```bash
git add src/collections/Submissions.ts src/payload.config.ts src/migrations/
git commit -m "feat: add Submissions collection for external contributions"
```

---

## Task 9: Articles Integration-Test via Payload Local API

**Files:**
- Create: `tests/integration/articles.test.ts`
- Modify: `vitest.config.ts` (separate config für Node-Tests)

Wir testen, dass die Articles-Collection sich aus Test-Code via Payload Local API füttern und abfragen lässt. Das ist Voraussetzung, um spätere Workflows zu testen.

- [ ] **Step 9.1: Vitest-Workspace für getrennte Environments**

Modify `vitest.config.ts` — Workspace-Setup:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    workspace: [
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          testTimeout: 30000,
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 9.2: Failing Test schreiben**

Create `tests/integration/articles.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('Articles Collection', () => {
  it('legt einen Artikel an und liest ihn über den Slug', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: `test-${Date.now()}@example.com`,
        password: 'test-pw-12345!',
        displayName: 'Test Autor',
        role: 'editor',
      },
    });

    const created = await payload.create({
      collection: 'articles',
      data: {
        title: 'Test-Dekubitus',
        intent: 'bedside',
        summary: 'Kurzbeschreibung für Test',
        definition: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'def' }] }] } } as any,
        praxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'pr' }] }] } } as any,
        risiken: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'ri' }] }] } } as any,
        quellen: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'qu' }] }] } } as any,
        authors: [user.id],
        status: 'published',
      },
    });

    expect(created.slug).toBe('test-dekubitus');

    const found = await payload.find({
      collection: 'articles',
      where: { slug: { equals: 'test-dekubitus' } },
      limit: 1,
    });

    expect(found.docs.length).toBe(1);
    expect(found.docs[0]!.title).toBe('Test-Dekubitus');
  });
});
```

- [ ] **Step 9.3: Test laufen lassen**

Voraussetzung: Postgres läuft (`docker compose up -d`). Dann:

```bash
pnpm test tests/integration/articles.test.ts
```

Expected: 1 Test grün. Falls Verbindungsfehler → `.env` prüfen.

Falls Payload die Lexical-RichText-Fixture strikt validiert und der Test deshalb fehlschlägt: die vereinfachte Struktur `{ root: { type: 'root', children: [...] } }` durch eine vollständige Lexical-Editor-State-Struktur ersetzen (mit `version`, `format`, `indent`, `direction`, `mode` etc. auf jedem Node). Referenz: https://lexical.dev/docs/concepts/editor-state

- [ ] **Step 9.4: Commit**

```bash
git add tests/integration/articles.test.ts vitest.config.ts
git commit -m "test: integration test for Articles via Payload Local API"
```

---

## Task 10: Footer-Komponente (TDD)

**Files:**
- Create: `src/components/Footer.tsx`
- Create: `tests/component/Footer.test.tsx`

- [ ] **Step 10.1: Failing Test**

Create `tests/component/Footer.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/Footer';

describe('Footer', () => {
  it('zeigt CC-BY-SA-Lizenzhinweis', () => {
    render(<Footer />);
    expect(screen.getByText(/CC BY-SA 4\.0/i)).toBeInTheDocument();
  });

  it('zeigt einen Disclaimer-Hinweis', () => {
    render(<Footer />);
    expect(
      screen.getByText(/ersetzt keine ärztliche oder pflegerische Beurteilung/i),
    ).toBeInTheDocument();
  });

  it('hat Links zu Impressum, Datenschutz, GitHub-Mirror', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: /Impressum/i })).toHaveAttribute('href', '/impressum');
    expect(screen.getByRole('link', { name: /Datenschutz/i })).toHaveAttribute('href', '/datenschutz');
    expect(screen.getByRole('link', { name: /Open Source/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 10.2: Test fehlschlagen lassen**

```bash
pnpm test tests/component/Footer.test.tsx
```

Expected: FAIL „Cannot find module '@/components/Footer'".

- [ ] **Step 10.3: Implementieren**

Create `src/components/Footer.tsx`:

```tsx
export function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-gray-50 py-10">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-sm text-gray-700">
          <strong>Hinweis:</strong> Inhalte ersetzen keine ärztliche oder pflegerische
          Beurteilung im Einzelfall. Im Zweifel immer Fachkraft, Arzt oder Notruf
          konsultieren.
        </p>
        <p className="mt-4 text-sm text-gray-600">
          Inhalte unter{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
            className="underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-SA 4.0
          </a>
          . Quellcode der Plattform ist Open Source.
        </p>
        <nav className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600">
          <a href="/impressum" className="hover:text-gray-900">
            Impressum
          </a>
          <a href="/datenschutz" className="hover:text-gray-900">
            Datenschutz
          </a>
          <a
            href="https://github.com/"
            className="hover:text-gray-900"
            target="_blank"
            rel="noreferrer noopener"
          >
            Open Source auf GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
```

- [ ] **Step 10.4: Test grün**

```bash
pnpm test tests/component/Footer.test.tsx
```

Expected: 3 Tests grün.

- [ ] **Step 10.5: Commit**

```bash
git add src/components/Footer.tsx tests/component/Footer.test.tsx
git commit -m "feat: add Footer with license, disclaimer, and legal links"
```

---

## Task 11: ArticleDisclaimer-Komponente (TDD)

**Files:**
- Create: `src/components/ArticleDisclaimer.tsx`
- Create: `tests/component/ArticleDisclaimer.test.tsx`

- [ ] **Step 11.1: Failing Test**

Create `tests/component/ArticleDisclaimer.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArticleDisclaimer } from '@/components/ArticleDisclaimer';

describe('ArticleDisclaimer', () => {
  it('zeigt Sicherheits-Disclaimer', () => {
    render(<ArticleDisclaimer />);
    expect(
      screen.getByText(/keine ärztliche oder pflegerische Beurteilung/i),
    ).toBeInTheDocument();
  });

  it('hat role=note für Screenreader', () => {
    render(<ArticleDisclaimer />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});
```

- [ ] **Step 11.2: FAIL**

```bash
pnpm test tests/component/ArticleDisclaimer.test.tsx
```

- [ ] **Step 11.3: Implementieren**

Create `src/components/ArticleDisclaimer.tsx`:

```tsx
export function ArticleDisclaimer() {
  return (
    <aside
      role="note"
      className="my-6 rounded border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900"
    >
      Dieser Artikel ersetzt keine ärztliche oder pflegerische Beurteilung im
      Einzelfall. Im akuten Notfall: 112.
    </aside>
  );
}
```

- [ ] **Step 11.4: PASS**

```bash
pnpm test tests/component/ArticleDisclaimer.test.tsx
```

Expected: 2 Tests grün.

- [ ] **Step 11.5: Commit**

```bash
git add src/components/ArticleDisclaimer.tsx tests/component/ArticleDisclaimer.test.tsx
git commit -m "feat: add ArticleDisclaimer component"
```

---

## Task 12: IntentCards-Komponente (TDD)

**Files:**
- Create: `src/components/IntentCards.tsx`
- Create: `tests/component/IntentCards.test.tsx`

Die 4 Karten der Startseite (Schnelle Hilfe / Hintergrundwissen / Lernen / QM-Tools).

- [ ] **Step 12.1: Failing Test**

Create `tests/component/IntentCards.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntentCards } from '@/components/IntentCards';

describe('IntentCards', () => {
  it('rendert vier Karten', () => {
    render(<IntentCards />);
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });

  it('enthält alle vier Intent-Texte', () => {
    render(<IntentCards />);
    expect(screen.getByText(/schnelle Hilfe am Bett/i)).toBeInTheDocument();
    expect(screen.getByText(/Hintergrundwissen/i)).toBeInTheDocument();
    expect(screen.getByText(/etwas zum Lernen/i)).toBeInTheDocument();
    expect(screen.getByText(/QM- & Pflegedienst-Tools/i)).toBeInTheDocument();
  });

  it('markiert QM-Tools sichtbar als bezahlt', () => {
    render(<IntentCards />);
    const qm = screen.getByText(/QM- & Pflegedienst-Tools/i).closest('a');
    expect(qm).not.toBeNull();
    expect(qm).toHaveTextContent(/🔒|bezahlt|kostenpflichtig/i);
  });
});
```

- [ ] **Step 12.2: FAIL**

```bash
pnpm test tests/component/IntentCards.test.tsx
```

- [ ] **Step 12.3: Implementieren**

Create `src/components/IntentCards.tsx`:

```tsx
type Intent = {
  href: string;
  title: string;
  subtitle: string;
  accent: string;
  paid?: boolean;
};

const INTENTS: Intent[] = [
  {
    href: '/intent/bedside',
    title: '…schnelle Hilfe am Bett',
    subtitle: 'Pflegetechniken, Notfälle, Checklisten',
    accent: 'border-blue-500',
  },
  {
    href: '/intent/background',
    title: '…Hintergrundwissen',
    subtitle: 'Krankheitsbilder, Erklärungen, Pflegeprozess',
    accent: 'border-emerald-500',
  },
  {
    href: '/intent/learning',
    title: '…etwas zum Lernen',
    subtitle: 'Ausbildungsthemen, Quizze',
    accent: 'border-amber-500',
  },
  {
    href: '/qm',
    title: '…QM- & Pflegedienst-Tools 🔒',
    subtitle: 'Vorlagen, SIS, Audit-Hilfen (für Pflegedienste, kostenpflichtig)',
    accent: 'border-violet-500',
    paid: true,
  },
];

export function IntentCards() {
  return (
    <section aria-label="Ich brauche…" className="mx-auto max-w-3xl">
      <p className="mb-4 text-sm uppercase tracking-wider text-gray-500">
        Ich brauche…
      </p>
      <ul className="grid gap-3">
        {INTENTS.map((intent) => (
          <li key={intent.href}>
            <a
              href={intent.href}
              className={`block rounded border-l-4 bg-gray-50 p-4 hover:bg-gray-100 ${intent.accent}`}
            >
              <div className="font-semibold text-gray-900">{intent.title}</div>
              <div className="mt-1 text-sm text-gray-600">{intent.subtitle}</div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 12.4: PASS**

```bash
pnpm test tests/component/IntentCards.test.tsx
```

Expected: 3 Tests grün.

- [ ] **Step 12.5: Commit**

```bash
git add src/components/IntentCards.tsx tests/component/IntentCards.test.tsx
git commit -m "feat: add IntentCards component for homepage"
```

---

## Task 13: Intent-basierte Startseite

**Files:**
- Modify: `src/app/(frontend)/page.tsx`
- Create or update: `src/app/(frontend)/layout.tsx` (Footer einbauen)

- [ ] **Step 13.1: Public Layout mit Footer**

`src/app/(frontend)/layout.tsx` öffnen, sicherstellen dass es ungefähr so aussieht:

```tsx
import './styles.css';
import { Footer } from '@/components/Footer';

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-gray-200 py-4">
          <div className="mx-auto max-w-6xl px-4">
            <a href="/" className="font-bold text-lg">
              PflegeCommons
            </a>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 13.2: Startseite implementieren**

Modify `src/app/(frontend)/page.tsx`:

```tsx
import { IntentCards } from '@/components/IntentCards';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">
        PflegeCommons
      </h1>
      <p className="mb-10 text-center text-gray-600">
        Wissen für die professionelle Pflege. Frei. Geprüft. Praxisnah.
      </p>

      <form action="/suche" method="get" className="mb-10">
        <label htmlFor="q" className="sr-only">
          Suche
        </label>
        <input
          type="search"
          id="q"
          name="q"
          placeholder="🔍 Suche nach „Dekubitus", „SIS", „MD-Prüfung"…"
          className="w-full rounded-lg border-2 border-blue-600 px-4 py-3 text-base"
        />
      </form>

      <IntentCards />
    </div>
  );
}
```

- [ ] **Step 13.3: Visuell verifizieren**

```bash
pnpm dev
```

`http://localhost:3000` öffnen. Erwartet: Titel, Suchfeld, 4 Intent-Karten, Footer mit Disclaimer und Lizenz.

- [ ] **Step 13.4: Commit**

```bash
git add src/app/(frontend)/page.tsx src/app/(frontend)/layout.tsx
git commit -m "feat: intent-based homepage with search stub and Footer"
```

---

## Task 14: ArticleTOC-Komponente (responsive, TDD)

**Files:**
- Create: `src/components/ArticleTOC.tsx`
- Create: `tests/component/ArticleTOC.test.tsx`

Diese Komponente rendert die Sektions-Navigation (Definition / Praxis / Risiken / Quellen). Auf Desktop in Sidebar, auf Mobile aufklappbar.

- [ ] **Step 14.1: Failing Test**

Create `tests/component/ArticleTOC.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArticleTOC } from '@/components/ArticleTOC';

const sections = [
  { id: 'definition', label: 'Definition' },
  { id: 'praxis', label: 'Praxis' },
  { id: 'risiken', label: 'Risiken & Fallstricke' },
  { id: 'quellen', label: 'Quellen' },
];

describe('ArticleTOC', () => {
  it('rendert alle Sektions-Links', () => {
    render(<ArticleTOC sections={sections} />);
    sections.forEach((s) => {
      expect(screen.getByRole('link', { name: s.label })).toHaveAttribute(
        'href',
        `#${s.id}`,
      );
    });
  });

  it('hat den Toggle-Button standardmäßig zugeklappt (aria-expanded=false)', () => {
    render(<ArticleTOC sections={sections} />);
    const toggle = screen.getByRole('button', { name: /Inhalt/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('klappt auf Klick auf', async () => {
    render(<ArticleTOC sections={sections} />);
    const toggle = screen.getByRole('button', { name: /Inhalt/i });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
```

- [ ] **Step 14.2: FAIL**

```bash
pnpm test tests/component/ArticleTOC.test.tsx
```

- [ ] **Step 14.3: Implementieren**

Create `src/components/ArticleTOC.tsx`:

```tsx
'use client';

import { useState } from 'react';

type Section = { id: string; label: string };

type Props = {
  sections: Section[];
  related?: { slug: string; title: string }[];
  reviewedAt?: string;
  reviewerName?: string;
};

export function ArticleTOC({ sections, related = [], reviewedAt, reviewerName }: Props) {
  const [open, setOpen] = useState(false);

  const inner = (
    <>
      <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">
        Auf dieser Seite
      </p>
      <ul className="mb-6 space-y-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="text-sm text-gray-800 hover:text-blue-600">
              → {s.label}
            </a>
          </li>
        ))}
      </ul>
      {related.length > 0 && (
        <>
          <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">
            Verwandt
          </p>
          <ul className="mb-6 space-y-1">
            {related.map((r) => (
              <li key={r.slug}>
                <a
                  href={`/artikel/${r.slug}`}
                  className="text-sm text-gray-700 hover:text-blue-600"
                >
                  → {r.title}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {reviewedAt && (
        <div className="text-xs text-gray-500">
          <p className="font-semibold uppercase tracking-wider">Geprüft</p>
          <p>
            {reviewedAt}
            {reviewerName ? ` · ${reviewerName}` : ''}
          </p>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile: kollabierbar */}
      <div className="md:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-blue-600 px-4 py-3 text-blue-700"
        >
          <span className="font-semibold">📑 Inhalt &amp; Verwandtes</span>
          <span aria-hidden>{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
            {inner}
          </div>
        )}
      </div>

      {/* Desktop: sticky Sidebar */}
      <aside className="hidden md:block md:sticky md:top-6">{inner}</aside>
    </>
  );
}
```

- [ ] **Step 14.4: PASS**

```bash
pnpm test tests/component/ArticleTOC.test.tsx
```

Expected: 3 Tests grün.

- [ ] **Step 14.5: Commit**

```bash
git add src/components/ArticleTOC.tsx tests/component/ArticleTOC.test.tsx
git commit -m "feat: add ArticleTOC with responsive collapsible mobile mode"
```

---

## Task 15: ArticleLayout-Komponente

**Files:**
- Create: `src/components/ArticleLayout.tsx`

Reines Layout-Wrapping (Sidebar links, Content rechts auf Desktop; gestapelt auf Mobile). Keine TDD-Tests nötig — wird in Task 16 über die echte Artikel-Seite getestet.

- [ ] **Step 15.1: Komponente schreiben**

Create `src/components/ArticleLayout.tsx`:

```tsx
import type { ReactNode } from 'react';

type Props = {
  toc: ReactNode;
  children: ReactNode;
};

export function ArticleLayout({ toc, children }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        <div>{toc}</div>
        <article className="prose prose-gray max-w-none">{children}</article>
      </div>
    </div>
  );
}
```

- [ ] **Step 15.2: Tailwind Typography Plugin installieren**

`prose`-Klassen erfordern das Plugin in Tailwind v4 als CSS-Import:

```bash
pnpm add -D @tailwindcss/typography
```

In `src/app/(frontend)/styles.css` direkt unter `@import "tailwindcss";` ergänzen:

```css
@plugin "@tailwindcss/typography";
```

- [ ] **Step 15.3: Commit**

```bash
git add src/components/ArticleLayout.tsx src/app/(frontend)/styles.css package.json
git commit -m "feat: add ArticleLayout grid wrapper with Tailwind Typography"
```

---

## Task 16: Artikel-Detail-Seite mit Sidebar + TOC

**Files:**
- Create: `src/app/(frontend)/artikel/[slug]/page.tsx`
- Create: `src/lib/payload.ts` (Payload-Client-Helper für Server Components)

- [ ] **Step 16.1: Payload-Helper für Server Components**

Create `src/lib/payload.ts`:

```ts
import 'server-only';
import { getPayload } from 'payload';
import config from '@/payload.config';

let cached: Awaited<ReturnType<typeof getPayload>> | null = null;

export async function getPayloadClient() {
  if (cached) return cached;
  cached = await getPayload({ config });
  return cached;
}
```

- [ ] **Step 16.2: Artikel-Detail-Seite**

Create `src/app/(frontend)/artikel/[slug]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { RichText } from '@payloadcms/richtext-lexical/react';
import { getPayloadClient } from '@/lib/payload';
import { ArticleLayout } from '@/components/ArticleLayout';
import { ArticleTOC } from '@/components/ArticleTOC';
import { ArticleDisclaimer } from '@/components/ArticleDisclaimer';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const payload = await getPayloadClient();

  const result = await payload.find({
    collection: 'articles',
    where: { and: [{ slug: { equals: slug } }, { status: { equals: 'published' } }] },
    limit: 1,
    depth: 2,
  });

  const article = result.docs[0];
  if (!article) notFound();

  const sections = [
    { id: 'definition', label: 'Definition' },
    { id: 'praxis', label: 'Praxis' },
    { id: 'risiken', label: 'Risiken & Fallstricke' },
    { id: 'quellen', label: 'Quellen' },
  ];

  const reviewedAt = article.lastReviewedAt
    ? new Date(article.lastReviewedAt).toLocaleDateString('de-DE')
    : undefined;
  const reviewerNames = Array.isArray(article.reviewedBy)
    ? article.reviewedBy
        .map((r: any) => (typeof r === 'object' ? r.displayName : null))
        .filter(Boolean)
        .join(', ')
    : undefined;

  return (
    <ArticleLayout
      toc={
        <ArticleTOC
          sections={sections}
          reviewedAt={reviewedAt}
          reviewerName={reviewerNames}
        />
      }
    >
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-gray-500">
          {article.intent === 'bedside' && 'Schnelle Hilfe am Bett'}
          {article.intent === 'background' && 'Hintergrundwissen'}
          {article.intent === 'learning' && 'Lernen'}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">{article.title}</h1>
        <p className="mt-2 text-gray-600">{article.summary}</p>
      </header>

      <ArticleDisclaimer />

      <section id="definition" className="mb-8">
        <h2 className="text-xl font-semibold">1. Definition</h2>
        <RichText data={article.definition as any} />
      </section>

      <section id="praxis" className="mb-8">
        <h2 className="text-xl font-semibold">2. Praxis</h2>
        <RichText data={article.praxis as any} />
      </section>

      <section id="risiken" className="mb-8">
        <h2 className="text-xl font-semibold">3. Risiken &amp; Fallstricke</h2>
        <RichText data={article.risiken as any} />
      </section>

      <section id="quellen" className="mb-8">
        <h2 className="text-xl font-semibold">4. Quellen &amp; Weiterführendes</h2>
        <RichText data={article.quellen as any} />
      </section>

      <footer className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-600">
        <a href="#" className="underline">
          Korrektur vorschlagen
        </a>{' '}
        ·{' '}
        <a href="#" className="underline">
          Neuen Artikel zu verwandtem Thema schreiben
        </a>
      </footer>
    </ArticleLayout>
  );
}
```

- [ ] **Step 16.3: Manuell verifizieren**

Im Browser `http://localhost:3000/artikel/dekubitusprophylaxe` (oder Slug des in Task 7 angelegten Test-Artikels) öffnen.

Erwartet:
- Artikel-Header mit Intent + Titel + Summary
- Disclaimer-Box gelb
- Vier Sektionen mit den Lorem-Texten
- Auf Desktop: links Sidebar mit TOC-Links
- Auf Mobile (DevTools): TOC zugeklappt mit Button „📑 Inhalt …"
- Footer mit Lizenz und Disclaimer

- [ ] **Step 16.4: 404-Test**

`http://localhost:3000/artikel/gibt-es-nicht` → Next-404-Seite.

- [ ] **Step 16.5: Commit**

```bash
git add src/app/(frontend)/artikel src/lib/payload.ts
git commit -m "feat: article detail page with sidebar TOC and structured sections"
```

---

## Task 17: A-Z-Stichwort-Index

**Files:**
- Create: `src/app/(frontend)/index/page.tsx`

- [ ] **Step 17.1: Index-Seite schreiben**

Create `src/app/(frontend)/index/page.tsx`:

```tsx
import { getPayloadClient } from '@/lib/payload';

export const dynamic = 'force-dynamic';

export default async function IndexPage() {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'articles',
    where: { status: { equals: 'published' } },
    limit: 500,
    sort: 'title',
    depth: 0,
  });

  const grouped = new Map<string, typeof result.docs>();
  for (const doc of result.docs) {
    const letter = doc.title.charAt(0).toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';
    const arr = grouped.get(key) ?? [];
    arr.push(doc);
    grouped.set(key, arr);
  }

  const letters = Array.from(grouped.keys()).sort();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">Alle Artikel A–Z</h1>

      <nav aria-label="A–Z" className="mb-10 flex flex-wrap gap-2">
        {letters.map((l) => (
          <a key={l} href={`#${l}`} className="rounded bg-gray-100 px-3 py-1 text-sm">
            {l}
          </a>
        ))}
      </nav>

      {letters.map((letter) => (
        <section key={letter} id={letter} className="mb-10">
          <h2 className="mb-3 text-xl font-bold text-gray-900">{letter}</h2>
          <ul className="space-y-2">
            {grouped.get(letter)!.map((doc) => (
              <li key={doc.id}>
                <a href={`/artikel/${doc.slug}`} className="text-blue-700 hover:underline">
                  {doc.title}
                </a>
                <span className="ml-2 text-sm text-gray-600">{doc.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 17.2: Verifizieren**

`http://localhost:3000/index` öffnen. Erwartet: Test-Artikel unter passender Buchstaben-Sektion, A-Z-Nav klickbar.

- [ ] **Step 17.3: Commit**

```bash
git add src/app/(frontend)/index/page.tsx
git commit -m "feat: A–Z index page for all published articles"
```

---

## Task 18: schema.org MedicalArticle JSON-LD Utility (TDD)

**Files:**
- Create: `src/lib/schema-org.ts`
- Create: `tests/unit/schema-org.test.ts`

- [ ] **Step 18.1: Failing Test**

Create `tests/unit/schema-org.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildMedicalArticleJsonLd } from '@/lib/schema-org';

describe('buildMedicalArticleJsonLd', () => {
  it('erzeugt valides MedicalArticle JSON-LD', () => {
    const json = buildMedicalArticleJsonLd({
      title: 'Dekubitusprophylaxe',
      slug: 'dekubitusprophylaxe',
      summary: 'Kurzbeschreibung.',
      authors: ['Klaus Müller', 'Jane Doe'],
      datePublished: '2026-01-15',
      dateModified: '2026-04-01',
      siteUrl: 'https://pflegecommons.de',
    });

    expect(json['@context']).toBe('https://schema.org');
    expect(json['@type']).toBe('MedicalWebPage');
    expect(json.headline).toBe('Dekubitusprophylaxe');
    expect(json.url).toBe('https://pflegecommons.de/artikel/dekubitusprophylaxe');
    expect(json.author).toEqual([
      { '@type': 'Person', name: 'Klaus Müller' },
      { '@type': 'Person', name: 'Jane Doe' },
    ]);
    expect(json.datePublished).toBe('2026-01-15');
    expect(json.dateModified).toBe('2026-04-01');
    expect(json.license).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
  });

  it('lässt dateModified weg, wenn nicht gesetzt', () => {
    const json = buildMedicalArticleJsonLd({
      title: 'Demenz',
      slug: 'demenz',
      summary: 's',
      authors: ['A'],
      datePublished: '2026-01-01',
      siteUrl: 'https://x.de',
    });
    expect(json.dateModified).toBeUndefined();
  });
});
```

- [ ] **Step 18.2: FAIL**

```bash
pnpm test tests/unit/schema-org.test.ts
```

- [ ] **Step 18.3: Implementieren**

Create `src/lib/schema-org.ts`:

```ts
export type MedicalArticleInput = {
  title: string;
  slug: string;
  summary: string;
  authors: string[];
  datePublished: string;
  dateModified?: string;
  siteUrl: string;
};

export function buildMedicalArticleJsonLd(input: MedicalArticleInput) {
  const url = `${input.siteUrl.replace(/\/$/, '')}/artikel/${input.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    headline: input.title,
    description: input.summary,
    url,
    author: input.authors.map((name) => ({ '@type': 'Person' as const, name })),
    datePublished: input.datePublished,
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    license: 'https://creativecommons.org/licenses/by-sa/4.0/',
    inLanguage: 'de',
  };
}
```

- [ ] **Step 18.4: PASS**

```bash
pnpm test tests/unit/schema-org.test.ts
```

Expected: 2 Tests grün.

- [ ] **Step 18.5: Commit**

```bash
git add src/lib/schema-org.ts tests/unit/schema-org.test.ts
git commit -m "feat: add MedicalWebPage JSON-LD utility"
```

---

## Task 19: JSON-LD und Open-Graph in Artikel-Seite einbinden

**Files:**
- Modify: `src/app/(frontend)/artikel/[slug]/page.tsx`

- [ ] **Step 19.1: generateMetadata + JSON-LD ergänzen**

`src/app/(frontend)/artikel/[slug]/page.tsx` erweitern. Direkt unter den Imports `import type { Metadata } from 'next';` und `import { buildMedicalArticleJsonLd } from '@/lib/schema-org';` ergänzen. Dann oberhalb der `export default`-Funktion:

```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'articles',
    where: { and: [{ slug: { equals: slug } }, { status: { equals: 'published' } }] },
    limit: 1,
    depth: 0,
  });
  const article = result.docs[0];
  if (!article) return { title: 'Nicht gefunden' };
  return {
    title: `${article.title} – PflegeCommons`,
    description: article.summary,
    openGraph: {
      title: article.title,
      description: article.summary,
      type: 'article',
      locale: 'de_DE',
    },
  };
}
```

Im Render-Block direkt unter `<header>` JSON-LD einfügen:

```tsx
{(() => {
  const authors = (Array.isArray(article.authors) ? article.authors : [])
    .map((a: any) => (typeof a === 'object' ? a.displayName : null))
    .filter(Boolean) as string[];
  const json = buildMedicalArticleJsonLd({
    title: article.title,
    slug: article.slug,
    summary: article.summary,
    authors,
    datePublished: article.createdAt,
    dateModified: article.updatedAt,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  });
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
})()}
```

- [ ] **Step 19.2: Verifizieren**

`http://localhost:3000/artikel/dekubitusprophylaxe` → View Source → `<script type="application/ld+json">` mit `@type: MedicalWebPage`.

`<title>` und Open-Graph-Tags im `<head>`.

- [ ] **Step 19.3: Commit**

```bash
git add src/app/(frontend)/artikel/[slug]/page.tsx
git commit -m "feat: add Open Graph metadata and MedicalWebPage JSON-LD on article page"
```

---

## Task 20: Sitemap.xml

**Files:**
- Create: `src/app/sitemap.ts`

Next.js generiert Sitemap automatisch aus `src/app/sitemap.ts`.

- [ ] **Step 20.1: sitemap.ts schreiben**

Create `src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next';
import { getPayloadClient } from '@/lib/payload';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'articles',
    where: { status: { equals: 'published' } },
    limit: 2000,
    depth: 0,
  });

  const articleEntries = result.docs.map((doc) => ({
    url: `${base}/artikel/${doc.slug}`,
    lastModified: new Date(doc.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const staticEntries = [
    { url: base, changeFrequency: 'daily' as const, priority: 1 },
    { url: `${base}/index`, changeFrequency: 'weekly' as const, priority: 0.6 },
  ];

  return [...staticEntries, ...articleEntries];
}
```

- [ ] **Step 20.2: Verifizieren**

`http://localhost:3000/sitemap.xml` öffnen → XML mit Einträgen.

- [ ] **Step 20.3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat: dynamic sitemap.xml with published articles"
```

---

## Task 21: GitHub Actions CI (lint + test + build)

**Files:**
- Create: `.github/workflows/ci.yml`

Auch wenn das Repo noch nicht auf GitHub liegt — die CI-Datei jetzt schreiben, dann läuft sie ab dem ersten Push.

- [ ] **Step 21.1: CI-Workflow schreiben**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: pflege
          POSTGRES_PASSWORD: pflege_dev
          POSTGRES_DB: pflegecommons
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URI: postgres://pflege:pflege_dev@localhost:5432/pflegecommons
      PAYLOAD_SECRET: ci-secret-not-for-prod-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
      NEXT_PUBLIC_SITE_URL: http://localhost:3000
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm payload migrate
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 21.2: Lokal Build durchlaufen lassen, um keine bösen Überraschungen in CI zu kriegen**

```bash
pnpm test
pnpm build
```

Expected: alle Tests grün, Build erfolgreich.

- [ ] **Step 21.3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for lint/test/build with Postgres service"
```

---

## Definition of Done für diesen Plan

Alle folgenden Punkte funktionieren lokal:

- [ ] `docker compose up -d` startet Postgres
- [ ] `pnpm dev` startet Next.js + Payload
- [ ] `/admin` zeigt Login → nach Login Articles, Users, Submissions sichtbar
- [ ] Im Admin lassen sich Artikel anlegen, slug wird automatisch generiert
- [ ] `/` zeigt die Intent-basierte Startseite mit Suchfeld und 4 Karten
- [ ] `/artikel/<slug>` rendert den Artikel mit Sidebar-TOC (Desktop) und kollabierbarem TOC (Mobile-DevTools)
- [ ] `/index` listet Artikel A–Z
- [ ] `/sitemap.xml` liefert XML mit allen veröffentlichten Artikeln
- [ ] Artikel-Seite enthält `<script type="application/ld+json">` MedicalWebPage
- [ ] Footer mit CC-BY-SA-Hinweis, Disclaimer, Impressum-Link auf jeder öffentlichen Seite
- [ ] `pnpm test` → alle Tests grün
- [ ] `pnpm build` → erfolgreich

## Was als nächstes (Follow-up Pläne)

Nach diesem Plan empfehle ich folgende Pläne in dieser Reihenfolge:

1. **Auth & Editorial Workflow** – Better-Auth Magic Link via Resend, Rollen-basiertes Berechtigungssystem, Workflow-Status-Übergänge
2. **Submission Form** – öffentliches Formular für externe Beiträge, Anti-Spam (Hashcash/Captcha-Light), Reviewer-Benachrichtigung
3. **Suche mit Meilisearch** – lokales Meilisearch via Docker, Index-Sync bei Article-Publish, Search-UI ersetzt den Stub
4. **GitHub Mirror Cron** – Markdown-Export, Push in öffentliches Repo
5. **Plausible Analytics** – self-hosted auf Hetzner-VPS
6. **Deployment** – Vercel für Frontend + Hetzner-VPS Setup mit Docker Compose

---

*Plan erstellt 2026-06-05 · Spec-Referenz: `docs/superpowers/specs/2026-06-04-pflegecommons-design.md` · 21 Tasks · geschätzter Aufwand: 1,5–2 Wochen für einen kundigen TypeScript/Next.js-Entwickler.*
