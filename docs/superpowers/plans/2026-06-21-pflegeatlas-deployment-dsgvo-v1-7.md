# PflegeAtlas V1.7 — Deployment + DSGVO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plattform produktiv live auf Vercel Hobby + Neon Free + Cloudflare R2 mit DSGVO-konformen Pflichttexten (Impressum, Datenschutzerklärung), Aufbewahrungs-Konzept inkl. Cleanup-Cron, Cloudflare Web Analytics, und dokumentiertem Migrations-Pfad zu Phase 2 (Hetzner+Coolify).

**Architecture:** Bundled-Approach aus Brainstorm-Wahl A: alle Komponenten in einem Sprint, ein PR, Go-Live am Ende. Phase 1 = 0 € laufende Kosten. Conditional-Builder-Pattern für Storage (analog `buildEmailConfig`) ermöglicht Local-FS-Fallback in Dev. Cron-Route ist standard Next-API mit Bearer-Auth, Vercel-Cron-spezifisch nur in `vercel.json` (Phase-2-Migration nur Config-Switch).

**Tech Stack:** Next.js 16 + Payload CMS 3.85 + Postgres + Vercel Hobby + Neon Free + Cloudflare R2 (S3-kompatibel) + Cloudflare Web Analytics + Resend + GitHub-App (V1.5-Mirror)

**Spec:** `docs/superpowers/specs/2026-06-21-pflegeatlas-deployment-dsgvo-v1-7-design.md`

**Branch:** `feat/v1-7-deployment-dsgvo` (von main `08e0485` aus)

---

## Workflow-Disziplin

- TDD: jede Code-Änderung beginnt mit RED-Test, dann GREEN, dann REFACTOR.
- Pro Task ein Commit (oder zwei: feat + polish nach Code-Review).
- Frühe Branch-Erstellung: vor T1.
- Subagent-Driven: Implementer + Spec-Reviewer + Code-Quality-Reviewer pro Task (wie V1.6).
- Verifikations-Disziplin: jeden Step lokal ausführen + Output checken, BEVOR „done" gemeldet wird (V1.4-Lesson).
- Tests grün halten: nach jedem Task `pnpm test` laufen lassen, Baseline 334 Tests + Phase-1-Additions.
- Lint clean: `pnpm lint` nach jedem Task, 0 Errors-Schwelle.

---

## Track 0: Setup-Pre-Tasks (manuell via Browser-Dashboards)

Diese Tasks bedürfen Olivers Browser-Klicks. Implementer-Agent kann sie nicht selbst ausführen. Werden außerhalb des TDD-Workflows in einer kurzen Setup-Session erledigt, BEVOR T1 startet. Credentials in 1Password als Eintrag „PflegeAtlas V1.7 Deployment" sammeln.

### P0: Adressen für Impressum bereitstellen

- [ ] Oliver schreibt seine Klar-Wohnadresse auf (Straße, Hausnummer, PLZ, Ort)
- [ ] Christoph schreibt seine Klar-Wohnadresse auf
- [ ] Beide in 1Password-Eintrag „PflegeAtlas V1.7 Deployment" speichern
- [ ] Werte werden beim Implementer-Dispatch von T3 (`/impressum`) als Brief mitgegeben

**Hinweis:** Wenn Privat-Adressen-Sichtbarkeit doch unangenehm ist → kostenpflichtiger Impressum-Service (z.B. impressum-anbieter.de ~5-15 €/Monat) — bricht aber 0-€-Constraint. Hier explizit „A + C → D später"-Wahl aus Brainstorm: Privatadressen jetzt akzeptiert.

### P1: Cloudflare Email Routing — `datenschutz@pflegeatlas.org`

- [ ] Cloudflare-Dashboard → Domain pflegeatlas.org → Email Routing
- [ ] Custom Address → `datenschutz@pflegeatlas.org`
- [ ] Action: Send to Worker → `pflegeatlas-forwarder` (bestehender Worker aus V1.3a Mail-Infra)
- [ ] Verifizieren: Worker-Code routet `datenschutz@` auch — falls Worker-Code hardcoded auf `redaktion@` + `mitmachen@` ist, muss er erweitert werden um `datenschutz@` als dritte Route. Code lebt im Cloudflare-Dashboard (Workers & Pages → pflegeatlas-forwarder → Code).
- [ ] Test-Mail an `datenschutz@pflegeatlas.org` von externer Adresse → Oliver UND Christoph erhalten beide

### P2: Cloudflare R2 — Bucket + Credentials

- [ ] Cloudflare-Dashboard → R2 Object Storage → Create Bucket
- [ ] Bucket-Name: `pflegeatlas-media`
- [ ] Location: `EEUR` (European Union)
- [ ] Default storage class: Standard
- [ ] Create
- [ ] Manage R2 API Tokens → Create API Token
- [ ] Permissions: Object Read & Write
- [ ] Specify Buckets: `pflegeatlas-media` only
- [ ] TTL: Forever (oder begrenzen falls gewünscht)
- [ ] Create API Token
- [ ] Werte in 1Password speichern: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=pflegeatlas-media`, `R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`
- [ ] Public Access (Optional): R2.dev Subdomain aktivieren für Avatare/Article-Images, sodass `<img src="https://pub-xxx.r2.dev/...">` direkt funktioniert. Custom-Domain (z.B. media.pflegeatlas.org) als V1.7.1-Backlog.

### P3: Vercel-Projekt anlegen

- [ ] Vercel.com → Sign up mit GitHub-Account (Oliver, shogun160)
- [ ] Plan: Hobby (gratis)
- [ ] Import Project → wähle `pflege-atlas`-Repo
- [ ] Framework Preset: Next.js (auto-detected)
- [ ] Root Directory: `./`
- [ ] Build Command: leer lassen (wird durch `vercel.json` in T2 gesetzt)
- [ ] Install Command: `pnpm install`
- [ ] Output Directory: `.next` (Default)
- [ ] Node.js Version: 22.x
- [ ] Environment Variables: noch leer (T2 + T10 füllen sie)
- [ ] Region: in Settings → Functions: `fra1` (Frankfurt)
- [ ] **NICHT deployen** — erst ENV-Vars setzen
- [ ] Project-ID + Deployment-Hook in 1Password speichern

### P4: Neon-Projekt anlegen

- [ ] Neon.tech → Sign up mit GitHub-Account
- [ ] Plan: Free
- [ ] Create Project: Name `pflegeatlas-prod`, Region `eu-central-1` (Frankfurt), Postgres Version 16
- [ ] Default branch: `main` (Neon-Branch)
- [ ] DB-Name: `pflegeatlas`
- [ ] Connection-String kopieren (Format: `postgres://user:pass@host.neon.tech/pflegeatlas?sslmode=require`)
- [ ] In 1Password speichern als `DATABASE_URI`
- [ ] **Wichtig:** Neon Free pausiert Compute nach 5min Idle → Cold Start. Akzeptiert.

### P5: Cloudflare Web Analytics

- [ ] Cloudflare-Dashboard → Analytics → Web Analytics
- [ ] Add a site → Hostname: `pflegeatlas.org` (oder erstmal Vercel-Preview-URL für Dev-Test)
- [ ] Automatic Setup: deaktivieren (wir nutzen JavaScript-Snippet manuell, weil pflegeatlas.org noch nicht auf Vercel zeigt während Build-Phase)
- [ ] Beacon Token kopieren (32-Zeichen-Hex)
- [ ] In 1Password speichern als `NEXT_PUBLIC_CF_ANALYTICS_TOKEN`

### P6: Cloudflare DNS Cutover (am Go-Live-Tag, NICHT jetzt)

- [ ] Wird in T10 ausgeführt, nicht jetzt.

---

## Track 1: Branch + Setup

### Task 1: Branch erstellen + initial test baseline

**Files:**
- Create: keine
- Modify: keine

- [ ] **Step 1: Branch von main erstellen**

```bash
cd /Users/oliverwosnitza/pflege-brainstorm
git checkout main
git pull origin main
git checkout -b feat/v1-7-deployment-dsgvo
```

- [ ] **Step 2: Baseline-Tests grün verifizieren**

Run: `pnpm test`
Expected: 334/334 tests pass (V1.6-Baseline + 0 V1.7-Tests)

- [ ] **Step 3: Lint clean verifizieren**

Run: `pnpm lint`
Expected: 0 errors, ≤59 warnings (V1.6-Baseline)

- [ ] **Step 4: Build grün verifizieren**

Run: `pnpm build`
Expected: Build erfolgreich, Route-Manifest enthält alle bekannten Routen.

---

## Track 2: T1 — R2-Storage-Adapter

**Files:**
- Create: `src/lib/storage-config.ts`
- Create: `tests/unit/storage-config.test.ts`
- Modify: `src/payload.config.ts`
- Modify: `.env.example` (R2-Sektion)
- Modify: `package.json` (Dependencies)

### Subtask 1.1: Dependencies installieren

- [ ] **Step 1: `@payloadcms/storage-s3` und Peer installieren**

Run:
```bash
pnpm add @payloadcms/storage-s3@3.85.0 @aws-sdk/client-s3
```

Expected: `package.json` enthält neuen Eintrag, `pnpm-lock.yaml` aktualisiert.

- [ ] **Step 2: Version-Parität verifizieren**

Run: `grep '"@payloadcms/storage-s3"' package.json`
Expected: Version `3.85.0` (passt zu Payload 3.85.0).

### Subtask 1.2: Storage-Config-Builder (TDD)

- [ ] **Step 3: Failing Unit-Test schreiben**

Datei: `tests/unit/storage-config.test.ts`

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { buildStorageConfig } from '@/lib/storage-config';

describe('buildStorageConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns null when R2_ACCESS_KEY_ID is missing', () => {
    delete process.env.R2_ACCESS_KEY_ID;
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'bucket';
    process.env.R2_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    expect(buildStorageConfig()).toBeNull();
  });

  it('returns null when R2_SECRET_ACCESS_KEY is missing', () => {
    process.env.R2_ACCESS_KEY_ID = 'key';
    delete process.env.R2_SECRET_ACCESS_KEY;
    process.env.R2_BUCKET = 'bucket';
    process.env.R2_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    expect(buildStorageConfig()).toBeNull();
  });

  it('returns null when R2_BUCKET is missing', () => {
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    delete process.env.R2_BUCKET;
    process.env.R2_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    expect(buildStorageConfig()).toBeNull();
  });

  it('returns null when R2_ENDPOINT is missing', () => {
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'bucket';
    delete process.env.R2_ENDPOINT;
    expect(buildStorageConfig()).toBeNull();
  });

  it('returns config object when all 4 R2 envs are set', () => {
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'pflegeatlas-media';
    process.env.R2_ENDPOINT = 'https://abc.r2.cloudflarestorage.com';
    const config = buildStorageConfig();
    expect(config).not.toBeNull();
    expect(config?.bucket).toBe('pflegeatlas-media');
    expect(config?.config.endpoint).toBe('https://abc.r2.cloudflarestorage.com');
    expect(config?.config.region).toBe('auto');
    expect(config?.config.credentials.accessKeyId).toBe('key');
    expect(config?.config.credentials.secretAccessKey).toBe('secret');
  });
});
```

- [ ] **Step 4: Test laufen lassen — RED erwarten**

Run: `pnpm test -- tests/unit/storage-config.test.ts`
Expected: FAIL mit „Cannot find module '@/lib/storage-config'"

- [ ] **Step 5: Implementation**

Datei: `src/lib/storage-config.ts`

```typescript
/**
 * Builds an R2/S3-Storage-Config-Object for the @payloadcms/storage-s3 plugin.
 *
 * Returns null in dev when no R2_* envs are set, letting Payload fall back to
 * its default local-filesystem storage. Production must set all four envs.
 *
 * Cloudflare R2 is S3-compatible; we use region 'auto' as recommended by
 * Cloudflare R2 docs (https://developers.cloudflare.com/r2/api/s3/api/).
 */
export interface StorageConfig {
  bucket: string;
  config: {
    endpoint: string;
    region: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
}

export function buildStorageConfig(): StorageConfig | null {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const endpoint = process.env.R2_ENDPOINT;

  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    return null;
  }

  return {
    bucket,
    config: {
      endpoint,
      region: 'auto',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    },
  };
}
```

- [ ] **Step 6: Test laufen lassen — GREEN erwarten**

Run: `pnpm test -- tests/unit/storage-config.test.ts`
Expected: PASS (5 tests).

### Subtask 1.3: Storage-Plugin in payload.config wiring

- [ ] **Step 7: Modify `src/payload.config.ts`**

Imports oben ergänzen:
```typescript
import { s3Storage } from '@payloadcms/storage-s3'
import { buildStorageConfig } from './lib/storage-config'
```

In `buildConfig({ ... })` den `plugins`-Array befüllen:

Ersetze:
```typescript
plugins: [],
```

Mit:
```typescript
plugins: (() => {
  const storage = buildStorageConfig()
  if (!storage) return []
  return [
    s3Storage({
      collections: {
        media: true,
      },
      bucket: storage.bucket,
      config: storage.config,
    }),
  ]
})(),
```

- [ ] **Step 8: TypeCheck**

Run: `pnpm tsc --noEmit`
Expected: 0 errors. (Falls Payload-Plugin-Typing strikt, ggf. mit `as any` casten — analog Code-Quality-Backlog `as Where`-Pattern.)

- [ ] **Step 9: Full test suite**

Run: `pnpm test`
Expected: 334 + 5 = 339 tests pass.

- [ ] **Step 10: Lint**

Run: `pnpm lint`
Expected: 0 errors.

### Subtask 1.4: .env.example erweitern

- [ ] **Step 11: Modify `.env.example`**

Am Ende der Datei anhängen:

```
# ---------------------------------------------------------------
# V1.7 — Cloudflare R2 (Media-Storage)
# Pflicht in Production. In Dev leer lassen → Payload fällt auf
# Local-Filesystem zurück.
# Werte aus 1Password "PflegeAtlas V1.7 Deployment".
# ---------------------------------------------------------------
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=pflegeatlas-media
R2_ENDPOINT=
```

### Subtask 1.5: Commit

- [ ] **Step 12: Commit**

```bash
git add src/lib/storage-config.ts tests/unit/storage-config.test.ts src/payload.config.ts .env.example package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(storage): cloudflare R2 adapter with local-FS fallback (T1)

Conditional buildStorageConfig() returns null when any R2_* env is missing,
letting Payload's default local filesystem handle uploads in dev. Production
requires all four: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
R2_ENDPOINT. Cloudflare R2 is S3-compatible via region='auto'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 3: T2 — Vercel-Build-Config

**Files:**
- Create: `vercel.json`
- Modify: `.env.example` (Vercel/Cron-Sektion)

### Subtask 2.1: vercel.json schreiben

- [ ] **Step 1: Create `vercel.json`**

Inhalt:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "pnpm install && pnpm build && pnpm payload migrate",
  "installCommand": "pnpm install",
  "outputDirectory": ".next",
  "regions": ["fra1"],
  "crons": [
    {
      "path": "/api/cron/cleanup-submissions",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Begründung der Config-Wahl:**
- `buildCommand` führt Migration NACH Build aus, damit ein gescheiterter Migration-Step den fertigen Build hat (Build-Output wird verworfen, alte Deploy bleibt live).
- `regions: ["fra1"]` = Frankfurt für Serverless Functions (Hobby Plan erlaubt 1 Region, Default `iad1`/US-East).
- `crons` läuft täglich 03:00 UTC = 04:00 oder 05:00 lokale Zeit je nach DST.

- [ ] **Step 2: `.env.example` Vercel + Cron-Sektion ergänzen**

Am Ende anhängen:
```
# ---------------------------------------------------------------
# V1.7 — Cron Job Secret
# Pflicht in Production. Beliebige lange Zufallszeichenkette.
# Vercel-Cron sendet dies als Bearer-Header an
# /api/cron/cleanup-submissions.
# Generieren: `openssl rand -hex 32`
# ---------------------------------------------------------------
CRON_SECRET=

# ---------------------------------------------------------------
# V1.7 — Cloudflare Web Analytics (cookieless)
# Optional in Dev. Pflicht in Production für PV-Tracking.
# Token aus Cloudflare-Dashboard → Web Analytics → Site → Details.
# ---------------------------------------------------------------
NEXT_PUBLIC_CF_ANALYTICS_TOKEN=
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json .env.example
git commit -m "$(cat <<'EOF'
feat(deploy): vercel.json with fra1 region + daily cleanup cron (T2)

buildCommand runs migrations AFTER build so a failed migration leaves
the previous deploy live. Cron job at 03:00 UTC triggers
/api/cron/cleanup-submissions for the rejected-submissions 30-day
auto-delete policy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 4: T3 — `/impressum`-Page

**Files:**
- Create: `src/app/(frontend)/impressum/page.tsx`
- Create: `tests/component/Impressum.test.tsx`

**Voraussetzung:** P0 abgeschlossen. Oliver liefert beide Adressen als Brief mit dem Implementer-Dispatch.

### Subtask 3.1: Failing Component-Test schreiben

- [ ] **Step 1: Failing Test schreiben**

Datei: `tests/component/Impressum.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Impressum from '@/app/(frontend)/impressum/page';

describe('Impressum', () => {
  it('shows § 5 DDG-Pflichtangaben for joint controllers', () => {
    render(<Impressum />);
    expect(screen.getByRole('heading', { name: /Impressum/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Oliver Wosnitza/i)).toBeInTheDocument();
    expect(screen.getByText(/Christoph/i)).toBeInTheDocument();
  });

  it('shows DSGVO contact email', () => {
    render(<Impressum />);
    const link = screen.getByRole('link', { name: /datenschutz@pflegeatlas\.org/i });
    expect(link).toHaveAttribute('href', 'mailto:datenschutz@pflegeatlas.org');
  });

  it('shows MStV § 18(2) verantwortlich-für-Inhalte', () => {
    render(<Impressum />);
    expect(screen.getByText(/Verantwortlich für den Inhalt nach.*MStV/i)).toBeInTheDocument();
  });

  it('shows EU-OS-Streitschlichtung-Hinweis', () => {
    render(<Impressum />);
    expect(screen.getByText(/Online-Streitbeilegung|OS-Plattform|ec\.europa\.eu/i)).toBeInTheDocument();
  });

  it('shows Verbraucherstreitbeilegung opt-out', () => {
    render(<Impressum />);
    expect(screen.getByText(/Verbraucherstreitbeilegung|nicht teilnahmebereit|nicht verpflichtet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test laufen lassen — RED erwarten**

Run: `pnpm test -- tests/component/Impressum.test.tsx`
Expected: FAIL mit „Cannot find module '@/app/(frontend)/impressum/page'"

### Subtask 3.2: Implementation

- [ ] **Step 3: Page erstellen**

Datei: `src/app/(frontend)/impressum/page.tsx`

**Adressen-Platzhalter:** Implementer-Brief enthält die echten Adressen aus 1Password.

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum — PflegeAtlas',
  description: 'Pflichtangaben nach § 5 DDG und § 18 MStV.',
};

export default function Impressum() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose prose-pflege">
      <h1>Impressum</h1>

      <h2>Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)</h2>
      <p>
        PflegeAtlas wird gemeinsam betrieben von:
      </p>
      <p>
        <strong>Oliver Wosnitza</strong>
        <br />
        {/* IMPLEMENTER: hier Olivers Adresse aus 1Password einsetzen */}
        [Olivers Adresse Zeile 1]
        <br />
        [Olivers Adresse Zeile 2]
      </p>
      <p>
        <strong>Christoph Brück</strong>
        <br />
        {/* IMPLEMENTER: hier Christophs Adresse aus 1Password einsetzen */}
        [Christophs Adresse Zeile 1]
        <br />
        [Christophs Adresse Zeile 2]
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail (allgemein):{' '}
        <a href="mailto:redaktion@pflegeatlas.org">redaktion@pflegeatlas.org</a>
        <br />
        E-Mail (Datenschutz):{' '}
        <a href="mailto:datenschutz@pflegeatlas.org">datenschutz@pflegeatlas.org</a>
      </p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>
        Oliver Wosnitza
        <br />
        [Olivers Adresse Zeile 1]
        <br />
        [Olivers Adresse Zeile 2]
      </p>

      <h2>EU-Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung
        (OS) bereit:{' '}
        <a
          href="https://ec.europa.eu/consumers/odr/"
          target="_blank"
          rel="noreferrer noopener"
        >
          https://ec.europa.eu/consumers/odr/
        </a>
        . Unsere E-Mail-Adresse finden Sie oben.
      </p>

      <h2>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
        vor einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <h2>Haftungsausschluss</h2>
      <p>
        Die Inhalte dieser Plattform ersetzen keine ärztliche oder pflegerische
        Beurteilung im Einzelfall. Im Zweifel ist immer eine Fachkraft, ein
        Arzt oder der Notruf zu konsultieren. Eine Haftung für Schäden, die
        aus der Anwendung der hier dargestellten Informationen entstehen, ist
        ausgeschlossen.
      </p>
    </article>
  );
}
```

- [ ] **Step 4: Test laufen lassen — GREEN erwarten**

Run: `pnpm test -- tests/component/Impressum.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Full Suite + Lint**

Run: `pnpm test && pnpm lint`
Expected: alle grün, 0 lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(frontend\)/impressum/page.tsx tests/component/Impressum.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): impressum page with joint-controller details (T3)

§ 5 DDG-Pflichtangaben für Oliver Wosnitza + Christoph Brück (Art. 26 DSGVO
joint controllers). MStV § 18(2) verantwortlich-für-Inhalte: Oliver. Plus
EU-OS-Hinweis, Verbraucherstreitbeilegung-Opt-out, Haftungsausschluss.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 5: T4 — `/datenschutz`-Page

**Files:**
- Create: `src/app/(frontend)/datenschutz/page.tsx`
- Create: `src/components/DatenschutzSections.tsx` (Custom-Sections als separate Komponente)
- Create: `tests/component/Datenschutz.test.tsx`

**Voraussetzung:** Generator-Output von datenschutz-generator.de gespeichert. Oliver führt den Generator-Workflow durch (siehe Subtask 4.1).

### Subtask 4.1: Generator-Output erzeugen (manuell durch Oliver)

- [ ] **Step 1: datenschutz-generator.de aufrufen**

Manuell:
- https://datenschutz-generator.de/
- Profil-Setup:
  - Verantwortliche: Privatperson(en), gemeinsam (Joint-Controller)
  - Name: „Oliver Wosnitza und Christoph Brück (gemeinsam)"
  - Adresse, E-Mail: aus 1Password
  - Plattform-Art: Wiki/Wissensplattform (Web-App)
  - Eingesetzte Dienste: Auswählen wenn vorhanden — Vercel (Hosting), Resend (E-Mail), Cloudflare (CDN/Spam-Schutz)
  - **WICHTIG:** Generator hat möglicherweise KEINE Voreinstellungen für Neon (US-Postgres), Cloudflare R2, Cloudflare Web Analytics, GitHub-Mirror — die kommen als Custom-Sections.
- HTML-Output generieren
- Lokal abspeichern als `/tmp/datenschutz-generator-output.html`

### Subtask 4.2: Custom-Sections als Komponente (TDD)

- [ ] **Step 2: Failing Component-Test schreiben**

Datei: `tests/component/Datenschutz.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Datenschutz from '@/app/(frontend)/datenschutz/page';

describe('Datenschutzerklärung', () => {
  it('shows main heading', () => {
    render(<Datenschutz />);
    expect(screen.getByRole('heading', { name: /Datenschutzerklärung/i, level: 1 })).toBeInTheDocument();
  });

  it('lists all five auftragsverarbeiter providers', () => {
    render(<Datenschutz />);
    expect(screen.getByText(/Vercel/i)).toBeInTheDocument();
    expect(screen.getByText(/Neon/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloudflare/i)).toBeInTheDocument();
    expect(screen.getByText(/Resend/i)).toBeInTheDocument();
    expect(screen.getByText(/GitHub/i)).toBeInTheDocument();
  });

  it('explains EU-US Data Privacy Framework for US providers', () => {
    render(<Datenschutz />);
    expect(screen.getByText(/EU-US Data Privacy Framework|Data Privacy Framework|DPF/i)).toBeInTheDocument();
  });

  it('shows V1.5 GitHub-PR-Mirror-section with irreversibility-notice', () => {
    render(<Datenschutz />);
    expect(screen.getByText(/öffentlicher GitHub.*PR|GitHub-Pull-Request/i)).toBeInTheDocument();
    expect(screen.getByText(/unwiderruflich|nicht löschbar|nicht widerrufen/i)).toBeInTheDocument();
  });

  it('shows V1.6 editorial workflow PII-disclosure', () => {
    render(<Datenschutz />);
    expect(screen.getByText(/Redakteur|Editor|Reviewer/i)).toBeInTheDocument();
    expect(screen.getByText(/E-Mail.*sichtbar|sehen.*E-Mail/i)).toBeInTheDocument();
  });

  it('lists soft-delete and CC-BY-SA-rationale', () => {
    render(<Datenschutz />);
    expect(screen.getByText(/anonymisier/i)).toBeInTheDocument();
    expect(screen.getByText(/CC BY-SA|Creative Commons/i)).toBeInTheDocument();
  });

  it('shows retention table with key values', () => {
    render(<Datenschutz />);
    expect(screen.getByText(/30 Tage/i)).toBeInTheDocument();
    expect(screen.getByText(/abgelehnt|rejected/i)).toBeInTheDocument();
  });

  it('shows joint-controller-hint (Art. 26)', () => {
    render(<Datenschutz />);
    expect(screen.getByText(/gemeinsam Verantwortliche|Joint.Controller|Art\.\s?26/i)).toBeInTheDocument();
  });

  it('shows betroffenenrechte with datenschutz@-mail', () => {
    render(<Datenschutz />);
    expect(screen.getByText(/Auskunft|Berichtigung|Löschung/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /datenschutz@pflegeatlas\.org/i })).toBeInTheDocument();
  });

  it('mentions Cloudflare Web Analytics as cookieless', () => {
    render(<Datenschutz />);
    expect(screen.getByText(/Cloudflare Web Analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/cookielos|ohne Cookies|cookieless/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Test laufen lassen — RED erwarten**

Run: `pnpm test -- tests/component/Datenschutz.test.tsx`
Expected: FAIL mit „Cannot find module '@/app/(frontend)/datenschutz/page'"

### Subtask 4.3: DatenschutzSections-Komponente

- [ ] **Step 4: Create `src/components/DatenschutzSections.tsx`**

Diese Komponente enthält die 8-9 Custom-Sections. Wird in der Page importiert + nach Generator-Output gerendert.

```tsx
export function DatenschutzSections() {
  return (
    <>
      <section>
        <h2>Hosting und Datenverarbeitung (Auftragsverarbeiter)</h2>
        <p>
          Wir nutzen folgende Anbieter zur Verarbeitung personenbezogener Daten.
          Mit allen Anbietern bestehen Auftragsverarbeitungsverträge (AVV) bzw.
          Data Processing Agreements (DPA). Übermittlungen in die USA stützen
          sich auf den EU-US Data Privacy Framework (DPF, angemessenheitsbeschluss
          der EU-Kommission vom 10. Juli 2023) und Standardvertragsklauseln (SCC).
        </p>
        <ul>
          <li>
            <strong>Vercel Inc.</strong> (San Francisco, USA, EU-DPF zertifiziert) —
            Hosting der Webanwendung in Frankfurt (Region <code>fra1</code>).
            Server-Logs werden für 1 Stunde aufbewahrt. Rechtsgrundlage:
            Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am Betrieb).
          </li>
          <li>
            <strong>Neon, Inc.</strong> (San Francisco, USA, EU-DPF zertifiziert) —
            Postgres-Datenbank in Region eu-central-1 (Frankfurt). Sicherungs-
            kopien werden für 7 Tage aufbewahrt (Point-in-Time-Recovery).
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
          </li>
          <li>
            <strong>Cloudflare, Inc.</strong> (San Francisco, USA, EU-DPF
            zertifiziert) — DNS und CDN-Edge-Schicht; eingehende E-Mails über
            Cloudflare Email Routing (nicht gespeichert, nur weitergeleitet);
            R2 Object Storage für Profilbilder (EU-Region); Turnstile als
            cookielose Spam-Schutz-Lösung im Beitrags-Formular; Cloudflare Web
            Analytics als <em>cookielose</em>, datenschutzfreundliche Reichweitenmessung.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Schutz und Funktion).
          </li>
          <li>
            <strong>Resend, Inc.</strong> (San Francisco, USA, EU-DPF zertifiziert) —
            Versand transaktionaler E-Mails (Einladungen, Passwort-Reset,
            Benachrichtigungen). Mail-Logs werden für 30 Tage aufbewahrt.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragsdurchführung).
          </li>
          <li>
            <strong>GitHub, Inc.</strong> (Tochter der Microsoft Corporation,
            USA, EU-DPF zertifiziert über Microsoft) — Quellcode-Repository und
            Veröffentlichungsplattform für angenommene Beiträge (siehe nächster
            Abschnitt). GitHub ist hier <em>Empfänger</em> nach Art. 13 Abs. 1
            lit. e DSGVO, nicht klassischer Auftragsverarbeiter. Rechtsgrundlage:
            Art. 6 Abs. 1 lit. f DSGVO (Open-Source-Zweck) und Einwilligung
            beim Einreichen.
          </li>
        </ul>
      </section>

      <section>
        <h2>Veröffentlichung angenommener Beiträge auf GitHub (V1.5)</h2>
        <p>
          Wenn ein eingereichter Beitrag von der Redaktion angenommen wird,
          spiegeln wir den Inhalt als öffentlichen Pull-Request in unserem
          GitHub-Repository{' '}
          <a
            href="https://github.com/shogun160/pflege-atlas"
            target="_blank"
            rel="noreferrer noopener"
          >
            shogun160/pflege-atlas
          </a>
          . Der Inhalt ist ab diesem Zeitpunkt öffentlich einsehbar und Teil
          des unveränderlichen Versionsverlaufs des Repositorys.
        </p>
        <p>
          <strong>Wichtig:</strong> Eine Löschung des Inhalts aus diesem
          Versionsverlauf ist <em>unwiderruflich nicht möglich</em>. Der Inhalt
          steht außerdem unter der Lizenz Creative Commons BY-SA 4.0 und kann
          von Dritten kopiert und weiterverwendet werden. Beim Einreichen
          weisen wir hierauf in einem Hinweis-Banner („Datenschutz: Bitte
          schreib generisch — keine Namen, Initialen oder Personen-Bezüge…")
          explizit hin.
        </p>
      </section>

      <section>
        <h2>Editorial-Workflow und Sichtbarkeit für Redakteur:innen (V1.6)</h2>
        <p>
          Beiträge durchlaufen einen redaktionellen Review. Redakteur:innen,
          Reviewer:innen und Administrator:innen sehen im Admin-Backend:
          den Beitragstitel, den Inhalt, die optionale Kontakt-E-Mail-Adresse
          der einreichenden Person sowie den Bearbeitungs-Status. Diese
          Daten werden bis zur abschließenden Bearbeitung (Annahme oder
          Ablehnung) verarbeitet.
        </p>
        <p>
          Bei angemeldeten Beiträger:innen sind außerdem Name und Profil
          für Redakteur:innen sichtbar.
        </p>
      </section>

      <section>
        <h2>Anonymisierung gelöschter Konten</h2>
        <p>
          Beim Löschen eines Beiträger:innen-Kontos werden die personenbezogenen
          Daten (Name, E-Mail, Profilbild) entfernt bzw. anonymisiert. Die
          Verknüpfung zwischen Konto und veröffentlichten Beiträgen bleibt
          erhalten, da die Beiträge unter Creative Commons BY-SA 4.0 stehen
          und der Lizenzhinweis Bestand haben muss. Der Eintrag in unserer
          Datenbank zeigt nach Löschung „Gelöschte:r Beitragende:r" statt
          des Klarnamens.
        </p>
      </section>

      <section>
        <h2>Aufbewahrungsfristen</h2>
        <table>
          <thead>
            <tr><th>Daten</th><th>Aufbewahrung</th></tr>
          </thead>
          <tbody>
            <tr><td>Angenommene Beiträge</td><td>dauerhaft (Audit-Trail; Inhalt zusätzlich öffentlich auf GitHub)</td></tr>
            <tr><td>Beiträge im Review</td><td>bis Review-Entscheidung</td></tr>
            <tr><td>Abgelehnte Beiträge</td><td><strong>30 Tage</strong>, danach automatische Löschung</td></tr>
            <tr><td>Aktive Konten</td><td>bis zur Konto-Löschung durch Nutzer:in</td></tr>
            <tr><td>Gelöschte Konten (anonymisiert)</td><td>dauerhaft (Lizenz-Hinweis)</td></tr>
            <tr><td>Vercel-Server-Logs</td><td>1 Stunde</td></tr>
            <tr><td>Neon-Datenbank-Sicherungen</td><td>7 Tage Point-in-Time</td></tr>
            <tr><td>Resend-Mail-Logs</td><td>30 Tage</td></tr>
            <tr><td>Cloudflare Web Analytics</td><td>6 Monate (aggregiert, ohne PII)</td></tr>
            <tr><td>GitHub-Veröffentlichungen</td><td>dauerhaft, öffentlich, unwiderruflich</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Gemeinsam Verantwortliche (Art. 26 DSGVO)</h2>
        <p>
          PflegeAtlas wird von Oliver Wosnitza und Christoph Brück als
          <em> gemeinsam Verantwortliche</em> nach Art. 26 DSGVO betrieben.
          Eine entsprechende Vereinbarung regelt die Aufgaben-Verteilung
          intern. Der wesentliche Inhalt: Oliver Wosnitza ist primärer
          Ansprechpartner für Hosting, Sicherheit, Datenschutz-Anfragen
          und technische Pannen; beide sind als Editor:innen/Reviewer:innen
          gemeinsam für die inhaltliche Qualitätssicherung verantwortlich.
          Sie können Ihre Rechte gegenüber jedem von uns geltend machen.
        </p>
      </section>

      <section>
        <h2>Ihre Rechte als betroffene Person</h2>
        <p>
          Sie haben jederzeit das Recht auf Auskunft (Art. 15 DSGVO),
          Berichtigung (Art. 16), Löschung (Art. 17, soweit nicht
          ausgeschlossen durch öffentliche Veröffentlichung auf GitHub),
          Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit
          (Art. 20) und Widerspruch (Art. 21).
        </p>
        <p>
          Außerdem haben Sie das Recht, sich bei einer Datenschutz-Aufsichts-
          behörde zu beschweren (Art. 77 DSGVO).
        </p>
        <p>
          Anfragen richten Sie bitte an:{' '}
          <a href="mailto:datenschutz@pflegeatlas.org">
            datenschutz@pflegeatlas.org
          </a>
          . Wir antworten in der Regel innerhalb von 14 Tagen, spätestens
          innerhalb der gesetzlichen Frist von einem Monat.
        </p>
        <p>
          Eingeloggte Beitragende können außerdem über{' '}
          <a href="/mein-bereich">Mein Bereich</a> eigenständig ihre Daten
          herunterladen (Selbst-Service-Export) und ihr Konto löschen.
        </p>
      </section>
    </>
  );
}
```

- [ ] **Step 5: Page erstellen**

Datei: `src/app/(frontend)/datenschutz/page.tsx`

```tsx
import type { Metadata } from 'next';
import { DatenschutzSections } from '@/components/DatenschutzSections';

export const metadata: Metadata = {
  title: 'Datenschutz — PflegeAtlas',
  description: 'Datenschutzerklärung gemäß DSGVO.',
};

export default function Datenschutz() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose prose-pflege">
      <h1>Datenschutzerklärung</h1>

      <p>
        Diese Datenschutzerklärung erläutert, welche personenbezogenen Daten
        wir verarbeiten, wenn Sie PflegeAtlas nutzen, und welche Rechte Sie
        in Bezug auf diese Daten haben. Stand: {new Date().toLocaleDateString('de-DE')}.
      </p>

      {/* IMPLEMENTER: Hier den Generator-Output aus /tmp/datenschutz-generator-output.html
          als JSX-konformes Markup einsetzen. Generator-Standard-Sections:
          - Einleitung und Verantwortlichkeit
          - Rechtsgrundlagen
          - Sicherheitsmaßnahmen
          - Übermittlung von personenbezogenen Daten
          - Internationale Datentransfers
          - Cookies / Browserspeicher (falls aktiv — hier: nur technisch notwendig)
          - Bereitstellung des Online-Angebots und Webhosting (Vercel)
          - Kontaktanfragen (Resend)
          - Generator setzt die Boilerplate, Custom-Sections unten ergänzen die Eigenheiten.
      */}

      <DatenschutzSections />
    </article>
  );
}
```

- [ ] **Step 6: Test laufen lassen — GREEN erwarten**

Run: `pnpm test -- tests/component/Datenschutz.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 7: Full Suite + Lint**

Run: `pnpm test && pnpm lint`
Expected: alle grün, 0 lint errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(frontend\)/datenschutz/page.tsx src/components/DatenschutzSections.tsx tests/component/Datenschutz.test.tsx
git commit -m "$(cat <<'EOF'
feat(frontend): datenschutzerklärung with custom sections (T4)

Custom sections cover the V1.5/V1.6-specific items the schwenke-generator
doesn't know about: GitHub PR-mirror with irreversibility-notice, editorial
workflow reviewer-PII, soft-delete + CC BY-SA, retention table (30-day
rejected-submissions-auto-delete), joint-controller-notice (Art. 26),
betroffenenrechte with datenschutz@-mail, EU-US DPF for US providers,
Cloudflare Web Analytics cookieless.

Generator-output insertion is implementation TODO once Oliver runs the
Schwenke-Generator and exports the HTML.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Hinweis:** Generator-HTML-Einfügung erfolgt manuell durch Oliver, NICHT durch Implementer-Agent. Subagent kann Custom-Sections + Page-Wrapper bauen, der Generator-Block bleibt als TODO-Marker im Code.

---

## Track 6: T5 — Cron-Job rejected-Submissions-Cleanup

**Files:**
- Create: `src/lib/cleanup-cutoff.ts`
- Create: `src/app/api/cron/cleanup-submissions/route.ts`
- Create: `tests/unit/cleanup-cutoff.test.ts`
- Create: `tests/integration/cleanup-cron.test.ts`

### Subtask 5.1: cleanup-cutoff Utility (TDD)

- [ ] **Step 1: Failing Unit-Test**

Datei: `tests/unit/cleanup-cutoff.test.ts`

```typescript
import { describe, expect, it } from 'vitest';
import { computeCutoffISO, REJECTED_RETENTION_DAYS } from '@/lib/cleanup-cutoff';

describe('cleanup-cutoff', () => {
  it('exports retention period of 30 days', () => {
    expect(REJECTED_RETENTION_DAYS).toBe(30);
  });

  it('returns ISO 30 days before given now', () => {
    const now = new Date('2026-07-01T03:00:00.000Z');
    const cutoff = computeCutoffISO(now);
    expect(cutoff).toBe('2026-06-01T03:00:00.000Z');
  });

  it('returns ISO for current time when called without arg', () => {
    const before = Date.now();
    const result = computeCutoffISO();
    const expectedMs = before - 30 * 24 * 60 * 60 * 1000;
    const resultMs = new Date(result).getTime();
    expect(resultMs).toBeGreaterThanOrEqual(expectedMs - 100);
    expect(resultMs).toBeLessThanOrEqual(expectedMs + 100);
  });
});
```

- [ ] **Step 2: Test RED**

Run: `pnpm test -- tests/unit/cleanup-cutoff.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementation**

Datei: `src/lib/cleanup-cutoff.ts`

```typescript
/**
 * Retention period for submissions with reviewStatus='rejected'.
 * After this many days, the daily cron job auto-deletes them.
 *
 * V1.7 Brainstorm-Decision: 30 days (down from initial 90-day suggestion).
 * Reason: Art. 5(1)(c) DSGVO data minimization — rejected submissions
 * have no audit-trail value.
 */
export const REJECTED_RETENTION_DAYS = 30;

/**
 * Returns the ISO timestamp `REJECTED_RETENTION_DAYS` days before `now`.
 * Submissions with `updatedAt` older than this should be auto-deleted.
 */
export function computeCutoffISO(now: Date = new Date()): string {
  const ms = now.getTime() - REJECTED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}
```

- [ ] **Step 4: Test GREEN**

Run: `pnpm test -- tests/unit/cleanup-cutoff.test.ts`
Expected: PASS (3 tests).

### Subtask 5.2: Cron-Route mit Bearer-Auth (TDD)

- [ ] **Step 5: Failing Integration-Test schreiben**

Datei: `tests/integration/cleanup-cron.test.ts`

```typescript
import 'dotenv/config';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { getPayload } from 'payload';
import configPromise from '@payload-config';
import { sql } from 'drizzle-orm';
import { GET } from '@/app/api/cron/cleanup-submissions/route';
import type { Payload } from 'payload';

const CRON_SECRET = 'test-cron-secret-12345';

describe('cleanup-cron route', () => {
  let payload: Payload;

  beforeAll(async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    payload = await getPayload({ config: configPromise });
  });

  beforeEach(async () => {
    // Clear submissions table before each test
    const all = await payload.find({
      collection: 'submissions',
      limit: 1000,
    });
    for (const sub of all.docs) {
      await payload.delete({ collection: 'submissions', id: sub.id });
    }
  });

  it('returns 401 without Authorization header', async () => {
    const req = new Request('http://test/api/cron/cleanup-submissions');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong Bearer token', async () => {
    const req = new Request('http://test/api/cron/cleanup-submissions', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct Bearer token', async () => {
    const req = new Request('http://test/api/cron/cleanup-submissions', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('deletedCount');
  });

  it('deletes rejected submissions older than 30 days, keeps others', async () => {
    const now = new Date();
    const longAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
    const recent = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    // 1) rejected, >30 days old → SHOULD be deleted
    const oldRejected = await payload.create({
      collection: 'submissions',
      data: {
        type: 'new_article',
        proposedTitle: 'Old rejected submission',
        reviewStatus: 'rejected',
      } as never,
    });
    // Manually set updatedAt to longAgo. Payload doesn't expose this directly,
    // so use a raw DB update through payload.db.
    // For SQL-Postgres adapter:
    await payload.db.drizzle.execute(
      sql`UPDATE submissions SET updated_at = ${longAgo.toISOString()} WHERE id = ${oldRejected.id}`,
    );

    // 2) rejected, <30 days old → SHOULD survive
    const recentRejected = await payload.create({
      collection: 'submissions',
      data: {
        type: 'new_article',
        proposedTitle: 'Recent rejected submission',
        reviewStatus: 'rejected',
      } as never,
    });
    await payload.db.drizzle.execute(
      sql`UPDATE submissions SET updated_at = ${recent.toISOString()} WHERE id = ${recentRejected.id}`,
    );

    // 3) accepted, >30 days old → SHOULD survive (acceptance protects)
    const oldAccepted = await payload.create({
      collection: 'submissions',
      data: {
        type: 'new_article',
        proposedTitle: 'Old accepted submission',
        reviewStatus: 'accepted',
      } as never,
    });
    await payload.db.drizzle.execute(
      sql`UPDATE submissions SET updated_at = ${longAgo.toISOString()} WHERE id = ${oldAccepted.id}`,
    );

    const req = new Request('http://test/api/cron/cleanup-submissions', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deletedCount).toBe(1);

    // Verify the right ones survived
    const survivors = await payload.find({ collection: 'submissions', limit: 100 });
    const survivorIds = survivors.docs.map((s) => s.id);
    expect(survivorIds).not.toContain(oldRejected.id);
    expect(survivorIds).toContain(recentRejected.id);
    expect(survivorIds).toContain(oldAccepted.id);
  });

  it('is idempotent — running twice yields no errors and 0 deletions on second run', async () => {
    const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const oldRejected = await payload.create({
      collection: 'submissions',
      data: {
        type: 'new_article',
        proposedTitle: 'Idempotency test',
        reviewStatus: 'rejected',
      } as never,
    });
    await payload.db.drizzle.execute(
      sql`UPDATE submissions SET updated_at = ${longAgo.toISOString()} WHERE id = ${oldRejected.id}`,
    );

    const req = new Request('http://test/api/cron/cleanup-submissions', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res1 = await GET(req);
    expect(res1.status).toBe(200);
    expect((await res1.json()).deletedCount).toBe(1);

    const res2 = await GET(req);
    expect(res2.status).toBe(200);
    expect((await res2.json()).deletedCount).toBe(0);
  });
});
```

- [ ] **Step 6: Test RED**

Run: `pnpm test -- tests/integration/cleanup-cron.test.ts`
Expected: FAIL (Modul fehlt).

### Subtask 5.3: Cron-Route Implementation

- [ ] **Step 7: Create Route**

Datei: `src/app/api/cron/cleanup-submissions/route.ts`

```typescript
import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { computeCutoffISO } from '@/lib/cleanup-cutoff';

export const dynamic = 'force-dynamic';

/**
 * Daily cron job that auto-deletes submissions with reviewStatus='rejected'
 * older than 30 days (REJECTED_RETENTION_DAYS).
 *
 * Triggered by Vercel Cron (configured in vercel.json). Vercel sends a
 * GET request with Authorization: Bearer ${CRON_SECRET} header.
 *
 * In Phase 2 (Hetzner+Coolify), the same route is triggered via curl from a
 * Coolify scheduled task — no code change needed, only the trigger mechanism.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await getPayload({ config: configPromise });
  const cutoff = computeCutoffISO();

  const { docs } = await payload.find({
    collection: 'submissions',
    where: {
      and: [
        { reviewStatus: { equals: 'rejected' } },
        { updatedAt: { less_than: cutoff } },
      ],
    },
    limit: 1000,
    depth: 0,
  });

  let deletedCount = 0;
  const errors: string[] = [];
  for (const doc of docs) {
    try {
      await payload.delete({
        collection: 'submissions',
        id: doc.id,
      });
      deletedCount++;
    } catch (e) {
      errors.push(`Submission ${doc.id}: ${(e as Error).message}`);
    }
  }

  console.log(
    `[cleanup-submissions] Cutoff ${cutoff}, found ${docs.length}, deleted ${deletedCount}, errors ${errors.length}`,
  );

  return Response.json({ deletedCount, errors });
}
```

- [ ] **Step 8: Test GREEN**

Run: `pnpm test -- tests/integration/cleanup-cron.test.ts`
Expected: PASS (5 tests).

**Mögliche Klippe:** `payload.db.drizzle.execute(...)` ist die Drizzle-API für Raw-SQL. Wenn das nicht funktioniert (Adapter-Methoden-Drift), als Fallback: `payload.update({ collection: 'submissions', id, data: { updatedAt: longAgo } })` — auch wenn Payload den `updatedAt`-Wert normalerweise selbst setzt, lässt es sich oft via `data.updatedAt` overriden. Falls auch das nicht greift, im Subagent-Brief notieren.

- [ ] **Step 9: Full Suite + Lint**

Run: `pnpm test && pnpm lint`
Expected: 334 + ~13 = ~347 grün, 0 lint errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/cleanup-cutoff.ts src/app/api/cron/cleanup-submissions/route.ts tests/unit/cleanup-cutoff.test.ts tests/integration/cleanup-cron.test.ts
git commit -m "$(cat <<'EOF'
feat(cron): daily cleanup of rejected submissions >30 days (T5)

Bearer-auth-protected GET endpoint at /api/cron/cleanup-submissions.
Triggered by Vercel Cron (vercel.json) at 03:00 UTC daily. Deletes all
submissions with reviewStatus='rejected' AND updatedAt < now - 30d.
Idempotent (re-runs find nothing). Phase-2-ready: same endpoint can be
triggered by a Coolify scheduled curl-task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 7: T6 — Cloudflare Web Analytics Script

**Files:**
- Create: `src/components/CloudflareAnalytics.tsx`
- Create: `tests/component/CloudflareAnalytics.test.tsx`
- Modify: `src/app/(frontend)/layout.tsx`

### Subtask 6.1: Failing Component-Test

- [ ] **Step 1: Failing Test schreiben**

Datei: `tests/component/CloudflareAnalytics.test.tsx`

```typescript
import { render } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { CloudflareAnalytics } from '@/components/CloudflareAnalytics';

describe('CloudflareAnalytics', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('renders nothing when NEXT_PUBLIC_CF_ANALYTICS_TOKEN is missing', () => {
    delete process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;
    process.env.NODE_ENV = 'production';
    const { container } = render(<CloudflareAnalytics />);
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders nothing in non-production environments even with token', () => {
    process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN = 'abc123token';
    process.env.NODE_ENV = 'development';
    const { container } = render(<CloudflareAnalytics />);
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders Cloudflare beacon script when token is set and NODE_ENV is production', () => {
    process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN = 'abc123token';
    process.env.NODE_ENV = 'production';
    const { container } = render(<CloudflareAnalytics />);
    const script = container.querySelector('script');
    expect(script).not.toBeNull();
    expect(script?.getAttribute('src')).toBe(
      'https://static.cloudflareinsights.com/beacon.min.js',
    );
    expect(script?.getAttribute('data-cf-beacon')).toContain('abc123token');
    expect(script?.hasAttribute('defer')).toBe(true);
  });
});
```

- [ ] **Step 2: Test RED**

Run: `pnpm test -- tests/component/CloudflareAnalytics.test.tsx`
Expected: FAIL.

### Subtask 6.2: Implementation

- [ ] **Step 3: Create `src/components/CloudflareAnalytics.tsx`**

```tsx
/**
 * Cookieless Cloudflare Web Analytics beacon.
 *
 * Renders only in production with a token set. The beacon is loaded via
 * Cloudflare's static CDN; no PII, no cookies, only aggregated metrics
 * (PV, country, device-class). No cookie banner needed (TTDSG § 25(2)
 * Nr. 2 — strictly necessary is N/A here, but cookieless means no consent
 * required).
 */
export function CloudflareAnalytics() {
  const token = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;
  if (!token || process.env.NODE_ENV !== 'production') {
    return null;
  }
  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
```

- [ ] **Step 4: Test GREEN**

Run: `pnpm test -- tests/component/CloudflareAnalytics.test.tsx`
Expected: PASS (3 tests).

### Subtask 6.3: Layout-Integration

- [ ] **Step 5: Modify `src/app/(frontend)/layout.tsx`**

Import oben ergänzen:
```tsx
import { CloudflareAnalytics } from '@/components/CloudflareAnalytics'
```

In `<body>` ganz am Ende vor `</body>` ergänzen (nach `<Footer />`):
```tsx
        <Footer />
        <CloudflareAnalytics />
      </body>
```

- [ ] **Step 6: Full Suite + Lint**

Run: `pnpm test && pnpm lint`
Expected: alle grün, 0 lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/CloudflareAnalytics.tsx tests/component/CloudflareAnalytics.test.tsx src/app/\(frontend\)/layout.tsx
git commit -m "$(cat <<'EOF'
feat(analytics): cookieless cloudflare web analytics beacon (T6)

Renders only in production with NEXT_PUBLIC_CF_ANALYTICS_TOKEN set.
Cookieless, no PII, no consent banner required. Wired into the frontend
layout at the end of body. Dev/test render null.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 8: T7 — Joint-Controller-Agreement (Art. 26 DSGVO)

**Files:**
- Create: `docs/legal/joint-controller-agreement-2026.md`

### Subtask 7.1: JCA-Dokument

- [ ] **Step 1: Create `docs/legal/joint-controller-agreement-2026.md`**

```markdown
# Vereinbarung über gemeinsame Verantwortlichkeit nach Art. 26 DSGVO

**Stand:** 2026-06-21
**Parteien:** Oliver Wosnitza und Christoph Brück
**Plattform:** PflegeAtlas (https://pflegeatlas.org)
**Gilt für:** alle personenbezogenen Daten, die im Rahmen des Betriebs der Plattform PflegeAtlas verarbeitet werden.

---

## 1. Gegenstand

Diese Vereinbarung regelt die Verteilung der Pflichten nach der EU-Datenschutz-Grundverordnung (DSGVO) zwischen Oliver Wosnitza und Christoph Brück als gemeinsam Verantwortliche im Sinne von Art. 26 DSGVO. Sie ist Voraussetzung für die rechtmäßige Verarbeitung personenbezogener Daten im Rahmen des Plattform-Betriebs.

## 2. Verarbeitungstätigkeiten

Im Rahmen von PflegeAtlas verarbeiten die Parteien gemeinsam:

- Konto-Daten registrierter Beitragender (Name, E-Mail, optional Profilbild, Rolle, Profil-Felder)
- Inhalte eingereichter Beiträge inklusive optionaler Kontakt-E-Mail-Adressen
- Editorial-Workflow-Metadaten (Reviewer-Zuordnung, Status-Übergänge, Annahme-/Ablehnungs-Entscheidungen)
- Server-, Datenbank- und Mail-Logs (über Auftragsverarbeiter Vercel, Neon, Resend)
- Aggregierte Reichweitenmessung (Cloudflare Web Analytics, cookieless)

## 3. Aufgaben-Verteilung

| Bereich | Hauptverantwortlich | Beteiligt |
|---|---|---|
| Plattform-Code, Hosting, Datenbank-Sicherheit | Oliver Wosnitza | Christoph Brück (informiert) |
| Inhalts-Reviews und Editorial-Annahme/Ablehnung | beide als Editor:in/Reviewer:in | – |
| Beantwortung von Datenschutz-Anfragen (Art. 15-22 DSGVO) | Oliver Wosnitza | Christoph Brück bei inhalts-bezogenen Aspekten |
| Sicherheits-Vorfälle, Daten-Pannen-Meldung an Aufsichtsbehörde | Oliver Wosnitza | Christoph Brück (informiert) |
| Pflege der Datenschutzerklärung und des Impressums | Oliver Wosnitza | Christoph Brück (Review) |
| Verträge mit Auftragsverarbeitern (AVV) | Oliver Wosnitza | – |

## 4. Anlaufstelle für Betroffene

Anfragen betroffener Personen sind an `datenschutz@pflegeatlas.org` zu richten. Beide Parteien erhalten diese E-Mails über das Cloudflare Email Routing. Beide sind verpflichtet, einander auf eingegangene Anfragen aufmerksam zu machen, falls die jeweils andere Partei sie zuerst sieht. Beantwortet wird primär durch Oliver Wosnitza; bei inhalts-bezogenen Anfragen mit Beteiligung von Christoph Brück.

Die Parteien können ihre Rechte gegenüber jeder von uns gemäß Art. 26 Abs. 3 DSGVO geltend machen.

## 5. Wesentlicher Inhalt für Betroffene

Der wesentliche Inhalt dieser Vereinbarung wird betroffenen Personen in der Datenschutzerklärung unter dem Abschnitt „Gemeinsam Verantwortliche (Art. 26 DSGVO)" mitgeteilt.

## 6. Geltungsdauer

Diese Vereinbarung gilt ab Inkrafttreten bis zur Auflösung der Plattform-Trägerschaft oder bis zur Übernahme durch eine juristische Person (z.B. UG/GmbH/Verein). Im letzteren Fall geht die Verantwortlichkeit auf die juristische Person über; diese Vereinbarung erlischt.

## 7. Unterzeichnung

Diese Vereinbarung wird durch Einchecken im Repository (Commit) gemeinsam abgesegnet. Beide Parteien bestätigen ihre Zustimmung durch Akzeptanz des entsprechenden Pull-Requests.

---

**Oliver Wosnitza** — Commit-Signatur via GitHub Account `shogun160`
**Christoph Brück** — Commit-Signatur via GitHub Account `primus-homeassistant`

*Letzte Aktualisierung: 2026-06-21*
```

- [ ] **Step 2: Verzeichnis anlegen + Commit**

```bash
mkdir -p docs/legal
git add docs/legal/joint-controller-agreement-2026.md
git commit -m "$(cat <<'EOF'
docs(legal): joint-controller agreement Art. 26 DSGVO (T7)

Internal document regulating responsibilities between Oliver Wosnitza
and Christoph Brück as joint controllers. The "wesentlicher Inhalt" is
publicly summarized in the Datenschutzerklärung (T4). Expires when the
platform is transferred to a legal entity (UG/Verein/GmbH).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 9: T8 — README + DEPLOYMENT-Runbook

**Files:**
- Create: `docs/DEPLOYMENT.md`
- Modify: `README.md`

### Subtask 8.1: DEPLOYMENT.md schreiben

- [ ] **Step 1: Create `docs/DEPLOYMENT.md`**

```markdown
# PflegeAtlas Deployment Runbook (V1.7+)

Diese Anleitung beschreibt den Phase-1-Deployment-Pfad (Vercel Hobby + Neon Free + Cloudflare R2) und skizziert die spätere Phase-2-Migration zu Hetzner+Coolify.

---

## Phase 1: Vercel Hobby + Neon Free + Cloudflare R2

### Voraussetzungen
- Pre-Tasks P0-P5 ausgeführt (siehe `docs/superpowers/plans/2026-06-21-pflegeatlas-deployment-dsgvo-v1-7.md`)
- Credentials in 1Password-Eintrag „PflegeAtlas V1.7 Deployment"
- main-Branch enthält den V1.7-Code (PR gemerged)

### Schritt 1 — Environment-Variablen in Vercel setzen

Im Vercel-Dashboard → Project → Settings → Environment Variables die folgenden Werte für „Production" eintragen:

| Variable | Wert |
|---|---|
| `DATABASE_URI` | Neon Connection-String aus P4 |
| `PAYLOAD_SECRET` | `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_URL` | `https://pflegeatlas.org` |
| `RESEND_API_KEY` | aus 1Password V1.3a |
| `RESEND_FROM_ADDRESS` | `noreply@pflegeatlas.org` |
| `RESEND_FROM_NAME` | `PflegeAtlas` |
| `TURNSTILE_SITE_KEY` | aus 1Password V1.3b |
| `TURNSTILE_SECRET_KEY` | aus 1Password V1.3b |
| `GITHUB_APP_ID` | aus 1Password V1.5 |
| `GITHUB_APP_INSTALLATION_ID` | aus 1Password V1.5 |
| `GITHUB_APP_PRIVATE_KEY` | Base64, aus 1Password V1.5 |
| `R2_ACCESS_KEY_ID` | aus P2 |
| `R2_SECRET_ACCESS_KEY` | aus P2 |
| `R2_BUCKET` | `pflegeatlas-media` |
| `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` | aus P5 |

### Schritt 2 — Erstes Deployment auf Vercel-Subdomain

- Vercel-Dashboard → Deployments → Redeploy oder push auf main triggert auto-deploy
- Erstes Deployment dauert ~2-4 min (Install + Build + Migrate)
- Verify Logs: Migration-Output zeigt alle bekannten Migrations als „[done]" markiert
- Verify URL: `https://<project>.vercel.app` lädt Homepage

### Schritt 3 — Smoke-Test auf Vercel-Subdomain

Folge der Checkliste in `docs/V1.7-DEPLOYMENT-SMOKE.md`.

### Schritt 4 — DNS Cutover (P6)

- Cloudflare-Dashboard → DNS → pflegeatlas.org
- CNAME-Record `pflegeatlas.org` → `cname.vercel-dns.com`
- CNAME-Record `www` → `cname.vercel-dns.com`
- TTL: Auto (1 min Default)
- Proxy-Status: DNS only (graue Wolke) — Vercel handelt SSL+CDN selbst
- Warten ~1-2 min für TTL-Propagation
- Verify: `dig pflegeatlas.org` zeigt Vercel-Edge-IPs

### Schritt 5 — Production-Smoke

- `https://pflegeatlas.org` → lädt
- HTTPS-Zertifikat (auto via Vercel) → Browser zeigt grünes Schloss
- `/impressum` + `/datenschutz` → 200 OK
- Login + Submission + Cron manuell triggern (siehe Smoke-Checkliste)

### Rollback

Falls etwas schiefgeht:
- Vercel-Dashboard → Deployments → vorigen Deployment → „Promote to Production"
- DNS bleibt unverändert
- Bei DB-Schema-Problem: Neon Free hat 7-Tage Point-in-Time-Recovery; im Neon-Dashboard wiederherstellen

---

## Phase 2: Hetzner+Coolify-Migration (späterer Sub-Plan)

Wird ausgelöst durch eines der folgenden Ereignisse:
- Neon Free DB > 0.5 GB (forced)
- Vercel Bandwidth > 100 GB/Monat (forced)
- Verein/UG-Gründung (Verantwortlichkeit ändert sich)
- Wunsch nach „deutsches Rechenzentrum" in Datenschutzerklärung

### Vorbereitende Schritte (vor Migrations-Tag)

- Hetzner-Account anlegen, Cloud-Projekt erstellen
- CX22-VPS bestellen (Nürnberg oder Falkenstein), Ubuntu 24.04 LTS
- SSH-Key hinterlegen, UFW konfigurieren, Coolify installieren (`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`)
- In Coolify: GitHub-Repo verbinden, automatisches Deploy auf push aktivieren
- Coolify-managed Postgres-Service anlegen (Version 16)
- ENV-Vars aus Vercel-Dashboard ins Coolify-Dashboard kopieren

### Migrations-Tag

1. `pg_dump` aus Neon: `pg_dump $NEON_URI > pflegeatlas-backup.sql`
2. `pg_restore` in Coolify-Postgres: `psql $COOLIFY_DB_URI < pflegeatlas-backup.sql`
3. Erstes Coolify-Deploy auf einer temporären Subdomain (z.B. `coolify-staging.pflegeatlas.org`)
4. Smoke-Test auf der Subdomain
5. DNS-Cutover Cloudflare A-Record `pflegeatlas.org` → Hetzner-IP
6. Smoke-Test Production-Domain
7. Vercel-Project pausieren (oder löschen), Neon-Project löschen
8. Datenschutzerklärung aktualisieren: Vercel + Neon raus, Hetzner als Anbieter rein
9. AVV-Sammlung aktualisieren (Hetzner-DPA hinzufügen, Vercel+Neon archivieren)

Geschätzte Dauer Phase-2-Migration: 4-6 Stunden in einer Session.

---

## Notfall-Kontakte

- **Vercel-Support:** https://vercel.com/help (Hobby keine SLA)
- **Neon-Support:** https://neon.tech/docs/introduction/support (Free keine SLA)
- **Cloudflare-Support:** Dashboard → Help (Free-Tier-Tickets)
- **Resend-Support:** https://resend.com/help
- **GitHub-App-Support:** https://github.com/settings/apps/pflegeatlas-bot

## Häufige Fehler

### „Function timed out"
- Vercel-Hobby Function-Timeout = 10s. Bei Build-Step-Hang: Migration-Hänger (z.B. interaktiver Prompt). Lösung: NODE_ENV=production für Migration setzen, oder Migration lokal applien und manuell `payload_migrations`-Row eintragen.

### „R2 PutObject 403 Forbidden"
- API-Token-Permissions checken (Object Read & Write, bucket-spezifisch)
- Endpoint-URL: muss `https://<account-id>.r2.cloudflarestorage.com` sein, nicht der Bucket-URL

### „Neon connection refused"
- Connection-String muss `?sslmode=require` enthalten
- Cold-Start: erste Request nach Idle 3-5s langsam — kein Bug

### „Cron-Job not running"
- Vercel Hobby unterstützt max 2 Cron-Jobs, 1x/Tag — daily.schedule muss passen
- Logs in Vercel-Dashboard → Project → Functions → Cron → Logs
- Manuell triggern: `curl -H "Authorization: Bearer $CRON_SECRET" https://pflegeatlas.org/api/cron/cleanup-submissions`
```

### Subtask 8.2: README-Update

- [ ] **Step 2: Modify `README.md`**

Status-Sektion aktualisieren (suche aktuelle Status-Zeile, ersetze sie):

Suche:
```markdown
> **Status:** in aktiver Entwicklung. V1.5 ist live (Visual Identity + Submission-PR-Sync). V1.6 (Editorial-Workflow + Auth) ist in Review auf `feat/v1-6-editorial-auth`. Suche bleibt die nächste Iteration.
```

Ersetze mit:
```markdown
> **Status:** in aktiver Entwicklung. V1.6 (Editorial-Workflow + Auth) auf main. V1.7 (Deployment auf Vercel/Neon + DSGVO-Texte) in Review auf `feat/v1-7-deployment-dsgvo`. Nach Live-Gang: DSGVO-Code-Härtung (Articles-Export-Pagination, Audit-Log, Hard-Delete) + Phase-2-Migration zu Hetzner+Coolify.
```

Nach dem „## Auth & Accounts (V1.6)"-Abschnitt eine neue Sektion vor „## Projektstruktur" einfügen:

```markdown
## Deployment (V1.7)

Phase 1 läuft auf Vercel Hobby (Frankfurt) + Neon Free (eu-central-1) + Cloudflare R2 (EU) zu 0 € laufenden Kosten. Phase 2 (Hetzner CX22 + Coolify, ~4.51 €/Monat) ist als spätere Migration vorgesehen.

- **Hosting:** Vercel Hobby, Region `fra1`
- **Datenbank:** Neon Postgres (Free Tier, eu-central-1, 0.5 GB)
- **Media-Storage:** Cloudflare R2 (10 GB free, EU-Bucket)
- **Mail:** Resend
- **Spam-Schutz:** Cloudflare Turnstile (cookieless)
- **Reichweitenmessung:** Cloudflare Web Analytics (cookieless, kein Banner)
- **Cron:** Vercel Cron daily 03:00 UTC für rejected-Submissions-Auto-Delete (30 Tage Retention)

Deploy-Runbook + Migration-Notes: siehe `docs/DEPLOYMENT.md`.

Datenschutzerklärung + Impressum: `/datenschutz` und `/impressum` öffentlich.
```

- [ ] **Step 3: Commit**

```bash
git add docs/DEPLOYMENT.md README.md
git commit -m "$(cat <<'EOF'
docs(v1-7): deployment runbook + readme update (T8)

docs/DEPLOYMENT.md walks through phase-1 deploy (Vercel/Neon/R2) and
sketches phase-2 migration (Hetzner+Coolify). README status + new
Deployment section.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 10: T9 — Smoke-Test-Checkliste

**Files:**
- Create: `docs/V1.7-DEPLOYMENT-SMOKE.md`

### Subtask 9.1: Smoke-Checkliste schreiben

- [ ] **Step 1: Create `docs/V1.7-DEPLOYMENT-SMOKE.md`**

```markdown
# V1.7 Deployment Smoke-Test Checkliste

Manuelle Verifikation vor und nach dem DNS-Cutover. Reihenfolge:
1. Tests A-G auf Vercel-Preview-URL (z.B. `https://pflege-atlas.vercel.app`)
2. DNS-Cutover (DEPLOYMENT.md Schritt 4)
3. Tests A-G erneut auf Production-Domain `https://pflegeatlas.org`

---

## Test A: Login-Magic-Link-Roundtrip

- [ ] Browser inkognito → `https://<URL>/admin`
- [ ] Erwartung: Redirect auf `/login?next=/admin`
- [ ] Login-Form lädt mit korrekten Tailwind-Styles
- [ ] Bestehender Admin-User-E-Mail eingeben + Passwort
- [ ] Login klick → Redirect auf `/admin` mit Session
- [ ] Auswertung: PASS / FAIL

## Test B: Anonyme Submission inkl. Mail-Versand

- [ ] Browser inkognito → `https://<URL>/einreichen`
- [ ] Form ausfüllen (Test-Beitrag, irgendein Pflege-Thema)
- [ ] Turnstile-Widget lädt (Cloudflare-Logo) und wird abgehakt
- [ ] Submit → Redirect auf `/einreichen/danke`
- [ ] Mail in `redaktion@pflegeatlas.org` (= Gmail Oliver+Christoph) erhalten
- [ ] DB-Eintrag in `submissions`-Collection (via Admin-UI sichtbar)
- [ ] Auswertung: PASS / FAIL

## Test C: Avatar-Upload auf R2

- [ ] Als Contributor einloggen
- [ ] `/mein-bereich` → Profil bearbeiten → Avatar-Upload (V1.7-Version, V1.6.1-Feature)
- [ ] **HINWEIS:** Avatar-Upload-UI ist V1.6.1-Backlog. Wenn nicht implementiert: über Admin → Media → Upload-Test
- [ ] Upload eines kleinen JPG
- [ ] Cloudflare R2 Dashboard → Bucket → File ist vorhanden
- [ ] Auswertung: PASS / FAIL / SKIPPED (UI nicht implementiert)

## Test D: Forgot-Password-Roundtrip

- [ ] Browser inkognito → `https://<URL>/passwort-vergessen`
- [ ] E-Mail eingeben → Submit
- [ ] Anti-Enumeration-Success-Message angezeigt
- [ ] Mail in Inbox des entsprechenden Users (über Resend zugestellt)
- [ ] Link in Mail klick → `https://<URL>/passwort-setzen?token=...`
- [ ] Neues Passwort setzen → Login
- [ ] Auswertung: PASS / FAIL

## Test E: Cron-Job manuell triggern

- [ ] Vercel-Dashboard → Project → Crons → cleanup-submissions → „Run Now"
- [ ] Alternative: `curl -H "Authorization: Bearer $CRON_SECRET" https://<URL>/api/cron/cleanup-submissions`
- [ ] Erwartung: HTTP 200 mit `{deletedCount: 0, errors: []}` (DB ist frisch, keine alten rejected)
- [ ] Vercel-Logs → Funktion-Run-Output zeigt `[cleanup-submissions] Cutoff <ISO>, found 0, deleted 0, errors 0`
- [ ] Auswertung: PASS / FAIL

## Test F: Cloudflare Web Analytics

- [ ] Browser-Tab auf `https://<URL>/` öffnen
- [ ] DevTools Network → `beacon.min.js` Request zu cloudflareinsights.com sichtbar
- [ ] DevTools Console: keine Errors
- [ ] Cloudflare-Dashboard → Web Analytics → pflegeatlas.org → letzte 30 Min: PV zählt hoch (kann 1-2 Min Verzögerung haben)
- [ ] Auswertung: PASS / FAIL

## Test G: datenschutz@-Mail-Forwarder

- [ ] Externe E-Mail-Adresse (z.B. Privat-Account) → Mail an `datenschutz@pflegeatlas.org`
- [ ] Subject: „V1.7 Smoke Test"
- [ ] Erwartung: Mail kommt bei BEIDEN an — Oliver Gmail UND Christoph Gmail
- [ ] Auswertung: PASS / FAIL

## Test H: DSGVO-Pflichtseiten

- [ ] Browser inkognito → `https://<URL>/impressum`
- [ ] Pflichtangaben sichtbar: beide Namen, beide Adressen, datenschutz@-Mail
- [ ] Browser inkognito → `https://<URL>/datenschutz`
- [ ] Alle 5 Auftragsverarbeiter gelistet (Vercel, Neon, Cloudflare, Resend, GitHub)
- [ ] Aufbewahrungs-Tabelle sichtbar
- [ ] Joint-Controller-Hinweis sichtbar
- [ ] Footer-Links auf `/impressum` und `/datenschutz` führen jeweils zur Seite
- [ ] Auswertung: PASS / FAIL

## Test I: V1.5 GitHub-Sync (smoke)

- [ ] Als Admin/Editor einloggen
- [ ] Admin → Submissions → Test-Submission von Test B
- [ ] Status auf „In Review" setzen → PR sollte auf shogun160/pflege-atlas erstellt werden
- [ ] Verifikation: GitHub-PR-URL sichtbar in der UI
- [ ] **NICHT mergen** während Smoke-Phase, einfach den PR wieder closen + Submission deleten zum Aufräumen
- [ ] Auswertung: PASS / FAIL

---

## Ergebnis-Schablone

```
V1.7 Smoke-Test — <Vercel-Preview | Production>
Datum: YYYY-MM-DD
Tester: Oliver

Test A (Login):              [ ] PASS [ ] FAIL — Notiz: ...
Test B (Submission):         [ ] PASS [ ] FAIL — Notiz: ...
Test C (Avatar/R2):          [ ] PASS [ ] FAIL [ ] SKIPPED — Notiz: ...
Test D (Forgot-Password):    [ ] PASS [ ] FAIL — Notiz: ...
Test E (Cron):               [ ] PASS [ ] FAIL — Notiz: ...
Test F (CF Web Analytics):   [ ] PASS [ ] FAIL — Notiz: ...
Test G (datenschutz@-Mail):  [ ] PASS [ ] FAIL — Notiz: ...
Test H (DSGVO-Seiten):       [ ] PASS [ ] FAIL — Notiz: ...
Test I (V1.5 GitHub-Sync):   [ ] PASS [ ] FAIL — Notiz: ...

Gesamt: [ ] GO   [ ] NO-GO

Findings:
- ...

Action Items:
- ...
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/V1.7-DEPLOYMENT-SMOKE.md
git commit -m "$(cat <<'EOF'
docs(v1-7): smoke-test checklist 9 flows A-I (T9)

Manual verification checklist for pre-DNS-cutover (Vercel-preview-URL)
and post-DNS-cutover (production-domain). Covers login, submission,
avatar/R2, forgot-password, cron, CF Analytics, datenschutz@-forwarder,
DSGVO-pages, and V1.5 GitHub sync. Sketch result-form at end.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Track 11: T10 — PR + Go-Live

**Files:**
- keine neuen — alles aus T1-T9 wird zusammengefasst

### Subtask 10.1: Final Local Verification

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: 334 + ~18 V1.7-Tests = ~352 Tests grün.

- [ ] **Step 2: Lint clean**

Run: `pnpm lint`
Expected: 0 errors, ≤61 warnings (≤59 baseline + ≤2 für neue `<a href="/admin">`-Warnings falls neue Admin-Links).

- [ ] **Step 3: Build grün**

Run: `pnpm build`
Expected: Build erfolgreich, neue Routes `/impressum`, `/datenschutz`, `/api/cron/cleanup-submissions` im Route-Manifest.

### Subtask 10.2: Push + PR erstellen

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/v1-7-deployment-dsgvo
```

- [ ] **Step 5: PR erstellen**

```bash
gh pr create --title "feat(v1-7): Deployment + DSGVO (Vercel/Neon Phase 1)" --body "$(cat <<'EOF'
## Summary

Implements V1.7 — Phase 1 deployment on Vercel Hobby + Neon Free + Cloudflare R2 + DSGVO-Pflichttexte. Brings the platform from V1.6 (auth + editorial workflow, on main) to production-ready.

**Spec:** `docs/superpowers/specs/2026-06-21-pflegeatlas-deployment-dsgvo-v1-7-design.md`
**Plan:** `docs/superpowers/plans/2026-06-21-pflegeatlas-deployment-dsgvo-v1-7.md`

## What's in this PR

- **T1**: Cloudflare R2 Media-Storage-Adapter (`@payloadcms/storage-s3`) with conditional Local-FS fallback
- **T2**: `vercel.json` mit fra1 region + daily cleanup-Cron 03:00 UTC
- **T3**: `/impressum`-Page mit Joint-Controller-Pflichtangaben
- **T4**: `/datenschutz`-Page mit Schwenke-Generator-Output + 8 Custom-Sections (V1.5 GitHub-Mirror, V1.6 Editorial-Workflow, Soft-Delete, CF-Stack, Vercel+Neon Schrems-II/EU-DPF, Retention-Table, Joint-Controller, Betroffenenrechte)
- **T5**: Cron-Route `/api/cron/cleanup-submissions` mit Bearer-Auth, 30-Tage-Retention für rejected-Submissions
- **T6**: Cloudflare Web Analytics (cookieless, kein Cookie-Banner)
- **T7**: Joint-Controller-Agreement nach Art. 26 DSGVO (`docs/legal/`)
- **T8**: Deployment-Runbook + README-Update
- **T9**: Smoke-Test-Checkliste (`docs/V1.7-DEPLOYMENT-SMOKE.md`)

## Pre-Tasks (manuell)

- [ ] P0: Adressen für Impressum in 1Password
- [ ] P1: `datenschutz@pflegeatlas.org` CF-Route + Worker-Update + Test-Mail
- [ ] P2: CF R2 Bucket `pflegeatlas-media` (EU) + S3-API-Token
- [ ] P3: Vercel-Projekt verbunden mit Repo
- [ ] P4: Neon-Project `pflegeatlas-prod` in eu-central-1
- [ ] P5: CF Web Analytics Site + Token
- [ ] P6: DNS-Cutover Cloudflare → Vercel (am Go-Live-Tag nach Smoke-Tests)

## Test Plan

- [x] Full Vitest suite green (~352 tests)
- [x] Lint clean (0 errors)
- [x] Build successful
- [ ] Smoke-Test-Checkliste auf Vercel-Preview-URL (siehe `docs/V1.7-DEPLOYMENT-SMOKE.md`, Tests A-I)
- [ ] DNS-Cutover (P6)
- [ ] Smoke-Test-Checkliste auf Production-Domain `https://pflegeatlas.org`

## Plan-Deviations

(Implementer dokumentiert Deviations hier während Implementation.)

## Release-Gate gehoben

V1.7 hebt das V1.6-DSGVO-Release-Gate auf. Sub-C (Articles-Export-Pagination, Audit-Log, Hard-Delete-Policy) bleibt separater späterer Track.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Subtask 10.3: Review + Smoke-Test auf Preview

- [ ] **Step 6: Vercel-Preview-Deployment abwarten**

Vercel-Dashboard → Deployments → neuer Preview-Build läuft. Wenn fertig: Preview-URL in PR-Body als Comment auto-postiert.

- [ ] **Step 7: Smoke-Test auf Preview-URL**

Folge `docs/V1.7-DEPLOYMENT-SMOKE.md` Tests A-I auf der Vercel-Preview-URL.

- [ ] **Step 8: Findings dokumentieren**

Falls Findings: separate Polish-Commits auf dem Branch, neues Preview-Deploy, erneuter Smoke-Lauf.

### Subtask 10.4: Merge + Production-Deploy + DNS-Cutover

- [ ] **Step 9: PR mergen**

```bash
gh pr merge <PR-Number> --squash
```

Merge triggert Vercel-Production-Deployment auf `pflege-atlas.vercel.app` (Default-Production-Domain solange noch kein Custom-Domain konfiguriert).

- [ ] **Step 10: Vercel Custom-Domain konfigurieren**

Vercel-Dashboard → Project → Domains → Add Domain → `pflegeatlas.org` + `www.pflegeatlas.org`. Vercel zeigt benötigte DNS-Konfiguration an.

- [ ] **Step 11: DNS-Cutover (P6)**

Cloudflare-Dashboard → DNS → pflegeatlas.org:
- Bestehende A/AAAA-Records für Root + www: entfernen oder ändern
- Neuer CNAME `@` (oder Root als A → Vercel-IP, je nach Cloudflare-CNAME-Flattening): auf `cname.vercel-dns.com`
- Neuer CNAME `www`: auf `cname.vercel-dns.com`
- Proxy-Status: DNS only (graue Wolke) — Vercel handelt SSL
- TTL: Auto

- [ ] **Step 12: DNS-Propagation abwarten + verifizieren**

```bash
dig pflegeatlas.org
dig www.pflegeatlas.org
```

Beide sollten Vercel-Edge-IPs zurückgeben (Range bekannt aus Vercel-Doku).

- [ ] **Step 13: HTTPS-Cert-Provisionierung abwarten**

Vercel automatisches Let's-Encrypt-Cert via DNS-Challenge. Dauert ~2-5 min. Status sichtbar im Vercel-Dashboard.

- [ ] **Step 14: Production-Smoke-Test**

Folge `docs/V1.7-DEPLOYMENT-SMOKE.md` Tests A-I auf `https://pflegeatlas.org`.

- [ ] **Step 15: Memory-Update**

Memory-Eintrag „PflegeAtlas Projekt" updaten: V1.7 auf main, Production live, Phase-2-Migration als Backlog.

- [ ] **Step 16: Handoff-Doc**

`docs/HANDOFF-2026-06-21-v1-7-live.md` mit:
- Was wurde gemacht
- Smoke-Ergebnisse
- Bekannte Findings für Phase-2 / Sub-C
- Phase-2-Trigger (Quota-Watch)

---

## Akzeptanz-Kriterien (Release-Gate)

V1.7 ist done wenn:

- [x] T1-T9 alle Code-Tasks merged via PR auf main
- [ ] Alle 6 Pre-Tasks ausgeführt (P1-P5 vor PR-Merge, P6 am Go-Live-Tag)
- [ ] Smoke-Test-Checkliste vollständig auf Production-Domain durchgelaufen
- [ ] `/impressum` + `/datenschutz` öffentlich erreichbar
- [ ] AVV/DPA von Vercel + Neon + Cloudflare + Resend + GitHub archiviert (PDF in 1Password)
- [ ] JCA-Dokument committed
- [ ] Cron-Job mindestens einmal erfolgreich gelaufen (Vercel-Logs verifiziert)
- [ ] DNS-Cutover abgeschlossen, `https://pflegeatlas.org` zeigt Vercel-Deploy

---

## Backlog post-V1.7

- **Sub-C** (DSGVO-Code-Härtung): Articles-Export-Pagination + Audit-Log + Hard-Delete-Policy für Right-to-Erasure
- **Phase-2-Migration**: Hetzner+Coolify (siehe DEPLOYMENT.md)
- **V1.6.1**: Avatar-Upload-UI im `/mein-bereich`
- **Sentry-Integration** (mit Phase 2 oder bei erstem Silent-Failure-Incident)
- **Custom-R2-Subdomain**: `media.pflegeatlas.org` statt `pub-xxx.r2.dev` (Branding)
- **Anwaltliche Validierung Datenschutzerklärung** vor V2 QM-Tool
- **Verein/UG-Gründung** → Impressum + JCA-Update
