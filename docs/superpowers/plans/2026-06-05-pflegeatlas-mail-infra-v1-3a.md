# V1.3a Mail-Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mail-Infrastruktur für PflegeAtlas einrichten — Cloudflare Email Routing für Empfang, Resend für Senden, Payload-Adapter conditional registriert, ein CLI-Sanity-Check-Skript, Tests + Doku.

**Architecture:** Zwei voneinander unabhängige Pfade. Empfangen läuft komplett über Cloudflare-Dashboard (kein Code), Senden über `@payloadcms/email-resend`-Adapter. Der Adapter wird in `payload.config.ts` nur registriert wenn `RESEND_API_KEY` in ENV existiert — sonst nutzt Payload seinen Default-Console-Logger. Dadurch funktioniert lokales Dev ohne Mail-Setup, CI ist grün ohne API-Key, und die Production-Konfiguration zieht den Key aus dem Hosting-Dashboard.

**Tech Stack:** Next.js 16, Payload CMS 3.85, Vitest 4.1, pnpm 10, TypeScript 5.7. Neue Dependency: `@payloadcms/email-resend` (zieht `resend` als Peer-Dep mit).

**Branch:** `feat/v1-3a-mail-infra` (existiert bereits, Spec ist drauf als Commit `1030470`).

**Spec-Referenz:** `docs/superpowers/specs/2026-06-05-pflegeatlas-mail-infra-v1-3a-design.md`

---

## File Structure

Welche Files diese Implementation berührt und wofür sie zuständig sind.

| Pfad | Typ | Zuständigkeit |
|---|---|---|
| `src/lib/email-config.ts` | **NEU** | Pure Helper-Funktion `buildEmailConfig()`, gibt `resendAdapter`-Instance zurück wenn `RESEND_API_KEY` gesetzt ist, sonst `undefined`. Isoliert, testbar ohne Payload-Boot. |
| `src/payload.config.ts` | MODIFIZIERT | `email`-Property ergänzt, ruft `buildEmailConfig()` auf. Sonst unverändert. |
| `scripts/send-test-mail.ts` | **NEU** | CLI-Skript, ruft `payload.sendEmail()` mit Argument-Empfänger. Logik in exportierte Funktion ausgelagert, damit Argument-Pfad testbar bleibt. |
| `.env.example` | **NEU** | Checked-in. Dokumentiert alle ENV-Vars inkl. der optionalen Mail-Vars mit Leerwerten + Kommentaren. |
| `README.md` | MODIFIZIERT | Neuer Abschnitt „Mail-Setup" mit Verweis auf Spec §6 für Setup-Reihenfolge. |
| `CONTRIBUTING.md` | MODIFIZIERT | Hinweis dass Dev ohne `RESEND_API_KEY` läuft, Mails in Console landen, und `scripts/send-test-mail.ts` für manuelle Verifikation existiert. |
| `tests/unit/email-config.test.ts` | **NEU** | Unit-Tests gegen `buildEmailConfig()`. Conditional-Logic mit/ohne API-Key. |
| `tests/unit/send-test-mail.test.ts` | **NEU** | Unit-Test gegen die exportierte Funktion in `scripts/send-test-mail.ts`. Argument-Fehler-Pfad. |
| `package.json` | MODIFIZIERT (automatisch) | `@payloadcms/email-resend` durch `pnpm add` |

**Helper-Auslagerung Begründung:** Spec §7 verlangt Unit-Tests für die conditional Adapter-Registration. `payload.config.ts` ist als Module-Default-Export schwer in Isolation testbar (lädt Postgres-Adapter, Collections, etc.). Eine pure Helper-Funktion in `src/lib/email-config.ts` ist isoliert testbar mit ENV-Stub, ohne Payload zu booten. Die Spec-Verhaltens-Aussagen werden dadurch nicht verletzt, nur sauberer implementiert.

---

## Setup-Tracks parallel

Die acht Tasks sind in zwei Tracks geteilt, die parallel laufen können:

- **Setup-Track** (Pre-Tasks A + B): manuelle Cloudflare- und Resend-Dashboard-Klicks. Oliver führt die Klicks, Claude führt Schritt für Schritt durch.
- **Code-Track** (Tasks 1–6): reine Repo-Arbeit. Funktioniert komplett ohne den Setup-Track, weil alle Tests den Console-Default-Pfad nutzen.
- **Sync-Punkt** (Task 7): manuelle Verifikation. Braucht **beide** Tracks abgeschlossen — Cloudflare-Routing aktiv, Resend-Domain `verified`, Code committet.
- **Abschluss** (Task 8): PR, CI, Merge.

Empfehlung für die Ausführung: Pre-Task A + B starten, Repo-Arbeit parallel ziehen. DNS-Propagation in Pre-Task B braucht oft 5–30 Min — gute Wartezeit für Code-Tasks 1–6.

---

## Pre-Task A: Cloudflare Email Routing aktivieren

**Wer:** Oliver klickt, Claude führt durch.

**Voraussetzung:** Cloudflare-Account mit `pflegeatlas.org` als Zone (existiert laut Memory).

- [ ] **Schritt 1:** Cloudflare-Dashboard öffnen → Account auswählen → Zone `pflegeatlas.org` anklicken → linke Sidebar „Email" → „Email Routing"

- [ ] **Schritt 2:** Button „Enable Email Routing" drücken. Cloudflare fragt, ob die nötigen MX- und SPF-Records automatisch gesetzt werden sollen → bestätigen. (Diese MX-Records sind getrennt von Resends SPF-Record in Pre-Task B — beide koexistieren.)

- [ ] **Schritt 3:** Tab „Routes" → „Create address" → Custom address `redaktion` (Domain `pflegeatlas.org` wird automatisch angehängt) → Action: „Send to an email" → Olivers persönliche Mailbox eintragen (z.B. `oliver.wosnitza@gmail.com`) → Save

- [ ] **Schritt 4:** Cloudflare schickt eine Verifikations-Mail an die eingetragene Olivers-Mailbox. In Gmail öffnen → Bestätigungslink klicken. Status muss in Cloudflare auf „verified" springen.

- [ ] **Schritt 5:** Wiederholen für `mitmachen@pflegeatlas.org` → gleiche Forward-Destination. (Christophs Mailbox kann nachgereicht werden, sobald er seine Wunsch-Adresse nennt — bis dahin reicht Oliver allein.)

- [ ] **Schritt 6:** Smoketest. Von externer Adresse (z.B. Olivers Privat-Mail von einem anderen Provider oder Christoph) eine Mail an `redaktion@pflegeatlas.org` schicken → muss innerhalb von 1–2 Min in Olivers Gmail-Inbox auftauchen.

- [ ] **Schritt 7:** Wenn Mail nicht ankommt: DNS-Propagation prüfen (`dig MX pflegeatlas.org` muss Cloudflare-MX zeigen), Spam-Ordner checken, Cloudflare-Routing-Logs in „Activity" prüfen.

**Erfolgs-Kriterium:** Externe Test-Mail an `redaktion@pflegeatlas.org` kommt in Olivers Gmail an, sichtbar im Inbox-Ordner (nicht im Spam).

---

## Pre-Task B: Resend-Account + Domain-Verifikation

**Wer:** Oliver klickt, Claude führt durch.

**Voraussetzung:** Pre-Task A nicht zwingend — kann parallel laufen.

- [ ] **Schritt 1:** resend.com öffnen → „Sign Up" → Account mit Olivers Mail erstellen. Mail-Verifikations-Mail bestätigen.

- [ ] **Schritt 2:** Im Resend-Dashboard → linke Sidebar „Domains" → „Add Domain" → `pflegeatlas.org` eintragen → Region auswählen (EU empfohlen für DSGVO-Hinweis im Datenschutz später).

- [ ] **Schritt 3:** Resend zeigt jetzt eine Tabelle mit DNS-Records die für die Domain-Verifikation gesetzt werden müssen — typisch drei:
  - **SPF** (TXT-Record, Wert ergänzt evtl. Cloudflares Default-SPF — Resend zeigt den finalen Wert)
  - **DKIM** (mehrere CNAME- oder TXT-Records, Resend gibt exakte Selectors)
  - **DMARC** (TXT-Record bei `_dmarc.pflegeatlas.org`)

- [ ] **Schritt 4:** In neuem Browser-Tab Cloudflare-Dashboard öffnen → Zone `pflegeatlas.org` → linke Sidebar „DNS" → „Records" → für jeden Resend-Record einen neuen DNS-Eintrag anlegen:
  - **Wichtig:** Proxy-Status muss auf „DNS only" (graue Wolke) stehen, nicht „Proxied" (orange Wolke). Resend-Verifikation funktioniert nicht durch den Proxy.
  - SPF zuerst — falls schon ein `v=spf1`-TXT-Record existiert (Cloudflare Email Routing hat einen gesetzt), den **um Resends Eintrag erweitern**, nicht zweiten anlegen. Resend zeigt den kombinierten Wert.

- [ ] **Schritt 5:** Im Resend-Dashboard auf „Verify Domain" klicken. Status springt von „pending" auf „verified", sobald DNS propagiert ist. Typisch 5–30 Min, manchmal länger.

- [ ] **Schritt 6:** Sobald „verified": linke Sidebar „API Keys" → „Create API Key" → Name `pflegeatlas-prod`, Permission `Sending access` → Key kopieren und sofort in 1Password/Bitwarden ablegen. **Resend zeigt den Key nur einmal an.**

- [ ] **Schritt 7:** Optional: zweiten API-Key `pflegeatlas-dev-testmail` für lokale Verifikations-Tests anlegen, gleiche Permission. Trennt Test-Sends vom Production-Verbrauch.

**Erfolgs-Kriterium:** Resend-Domain `pflegeatlas.org` hat Status `verified`, mindestens ein API-Key existiert und ist in 1Password/Bitwarden gespeichert.

---

## Task 1: Dependency installieren

**Files:**
- Modify: `package.json` (automatisch durch `pnpm add`)
- Modify: `pnpm-lock.yaml` (automatisch)

- [ ] **Step 1:** Auf Branch `feat/v1-3a-mail-infra` sicherstellen (sollte aktiv sein).

```bash
git status
```

Expected: `On branch feat/v1-3a-mail-infra`, working tree clean (außer evtl. unstaged spec).

- [ ] **Step 2:** Resend-Adapter-Paket installieren.

```bash
pnpm add @payloadcms/email-resend
```

Expected: `package.json` enthält neuen Eintrag in `dependencies`, `pnpm-lock.yaml` ist aktualisiert, `resend` als Peer-Dep mit reingezogen.

- [ ] **Step 3:** Verify install — Paket sollte in `node_modules` liegen.

```bash
ls node_modules/@payloadcms/email-resend/package.json
```

Expected: Datei existiert.

- [ ] **Step 4:** Sanity-Check, dass nichts kaputt ist.

```bash
pnpm test
```

Expected: 27/27 grün (Baseline V1.2).

- [ ] **Step 5:** Commit.

```bash
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(v1.3a): add @payloadcms/email-resend dependency

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Email-Config-Helper mit TDD

**Files:**
- Create: `src/lib/email-config.ts`
- Test: `tests/unit/email-config.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/email-config.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildEmailConfig } from '@/lib/email-config';

describe('buildEmailConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns undefined when RESEND_API_KEY is missing', () => {
    vi.stubEnv('RESEND_API_KEY', '');
    expect(buildEmailConfig()).toBeUndefined();
  });

  it('returns undefined when RESEND_API_KEY is the literal string "undefined"', () => {
    vi.stubEnv('RESEND_API_KEY', 'undefined');
    expect(buildEmailConfig()).toBeUndefined();
  });

  it('returns a resend adapter factory when RESEND_API_KEY is set', () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_xxx');
    vi.stubEnv('RESEND_FROM_ADDRESS', 'noreply@pflegeatlas.org');
    const factory = buildEmailConfig();
    expect(factory).toBeDefined();
    expect(typeof factory).toBe('function');
    const adapter = factory!();
    expect(adapter).toHaveProperty('name', 'resend-rest');
    expect(adapter).toHaveProperty('defaultFromAddress', 'noreply@pflegeatlas.org');
  });

  it('falls back to "PflegeAtlas" when RESEND_FROM_NAME is not set', () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_xxx');
    vi.stubEnv('RESEND_FROM_ADDRESS', 'noreply@pflegeatlas.org');
    vi.stubEnv('RESEND_FROM_NAME', '');
    const factory = buildEmailConfig();
    const adapter = factory!();
    expect(adapter).toHaveProperty('defaultFromName', 'PflegeAtlas');
  });
});
```

**Erratum:** `resendAdapter()` aus `@payloadcms/email-resend@3.85` gibt eine **Factory-Funktion** zurück, kein Adapter-Object. Die Properties `name`/`defaultFromAddress`/`defaultFromName` existieren erst nach Aufruf der Factory (`factory!()`). Erste Plan-Version hatte Properties direkt am Factory-Return geprüft → 2 Tests failed. Korrigiert während Ausführung.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/email-config.test.ts
```

Expected: FAIL with `Cannot find module '@/lib/email-config'` or similar import error.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/email-config.ts`:

```typescript
import { resendAdapter } from '@payloadcms/email-resend';

export function buildEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'undefined') {
    return undefined;
  }

  const defaultFromAddress = process.env.RESEND_FROM_ADDRESS;
  if (!defaultFromAddress) {
    throw new Error(
      'RESEND_API_KEY is set but RESEND_FROM_ADDRESS is missing. ' +
        'Set both env vars or unset RESEND_API_KEY to fall back to console logging.',
    );
  }

  return resendAdapter({
    apiKey,
    defaultFromAddress,
    defaultFromName: process.env.RESEND_FROM_NAME || 'PflegeAtlas',
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/unit/email-config.test.ts
```

Expected: 4 tests passing.

- [ ] **Step 5: Run full test suite to confirm nothing regressed**

```bash
pnpm test
```

Expected: 31/31 grün (27 alt + 4 neu).

- [ ] **Step 6: Lint**

```bash
pnpm lint
```

Expected: 0 errors. Warnings dürfen nicht steigen (Baseline 24).

- [ ] **Step 7: Commit**

```bash
git add src/lib/email-config.ts tests/unit/email-config.test.ts
git commit -m "$(cat <<'EOF'
feat(v1.3a): conditional email-config helper

buildEmailConfig() returns resendAdapter when RESEND_API_KEY is set,
otherwise undefined (so Payload falls back to its console logger).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Email-Adapter in payload.config.ts verdrahten

**Files:**
- Modify: `src/payload.config.ts`

- [ ] **Step 1:** Aktuelle `payload.config.ts` öffnen, Import-Block und `buildConfig`-Aufruf anschauen.

- [ ] **Step 2:** Import für Helper ergänzen.

Edit `src/payload.config.ts` — nach den Collection-Imports, vor dem `filename`-const:

```typescript
import { Media } from './collections/Media'
import { buildEmailConfig } from './lib/email-config'
```

- [ ] **Step 3:** `email`-Property in `buildConfig`-Aufruf einfügen, direkt nach der bestehenden `sharp`-Property:

```typescript
  sharp,
  email: buildEmailConfig(),
  plugins: [],
```

- [ ] **Step 4:** Build verifizieren — keine TypeScript-Errors.

```bash
pnpm build
```

Expected: `✓ Compiled successfully`, alle 9 Static-Pages werden generiert.

- [ ] **Step 5:** Tests laufen lassen.

```bash
pnpm test
```

Expected: 31/31 grün.

- [ ] **Step 6:** Smoketest — dev-Server kurz starten und sicherstellen dass die „No email adapter provided"-Warnung **immer noch** kommt (weil lokal kein API-Key gesetzt ist).

```bash
pnpm dev &
sleep 5
curl -s http://localhost:3000 > /dev/null
kill %1 2>/dev/null
```

Expected im Dev-Server-Log: weiterhin `WARN: No email adapter provided. Email will be written to console.` Genauso wie vorher — bestätigt dass `buildEmailConfig()` ohne Key wirklich `undefined` zurückgibt.

- [ ] **Step 7: Commit**

```bash
git add src/payload.config.ts
git commit -m "$(cat <<'EOF'
feat(v1.3a): wire conditional email config into payload.config

email property uses buildEmailConfig(); without RESEND_API_KEY Payload
falls back to console logger as before.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Test-Mail-Skript mit TDD

**Files:**
- Create: `scripts/send-test-mail.ts`
- Test: `tests/unit/send-test-mail.test.ts`

- [ ] **Step 1:** `scripts/`-Verzeichnis prüfen (existiert es schon?).

```bash
ls scripts/ 2>/dev/null || mkdir scripts
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/send-test-mail.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { parseRecipient } from '../../scripts/send-test-mail';

describe('parseRecipient', () => {
  it('returns the first CLI argument when given', () => {
    expect(parseRecipient(['node', 'script', 'a@b.de'], {})).toBe('a@b.de');
  });

  it('falls back to TEST_MAIL_TO env when no arg given', () => {
    expect(parseRecipient(['node', 'script'], { TEST_MAIL_TO: 'fallback@x.de' })).toBe(
      'fallback@x.de',
    );
  });

  it('prefers CLI arg over env var when both are present', () => {
    expect(
      parseRecipient(['node', 'script', 'cli@x.de'], { TEST_MAIL_TO: 'env@x.de' }),
    ).toBe('cli@x.de');
  });

  it('throws when neither arg nor env var is provided', () => {
    expect(() => parseRecipient(['node', 'script'], {})).toThrowError(
      /recipient/i,
    );
  });

  it('throws when recipient is not a valid email', () => {
    expect(() => parseRecipient(['node', 'script', 'not-an-email'], {})).toThrowError(
      /email/i,
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/send-test-mail.test.ts
```

Expected: FAIL with `Cannot find module '../../scripts/send-test-mail'`.

- [ ] **Step 4: Write minimal implementation**

Create `scripts/send-test-mail.ts`:

```typescript
import 'dotenv/config';

export function parseRecipient(argv: string[], env: Record<string, string | undefined>): string {
  const candidate = argv[2] ?? env.TEST_MAIL_TO;
  if (!candidate) {
    throw new Error(
      'No recipient provided. Usage: pnpm tsx scripts/send-test-mail.ts <recipient@example.com> ' +
        'or set TEST_MAIL_TO env var.',
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
    throw new Error(`Recipient "${candidate}" is not a valid email address.`);
  }
  return candidate;
}

async function main(): Promise<void> {
  const recipient = parseRecipient(process.argv, process.env);

  if (!process.env.RESEND_API_KEY) {
    console.error(
      'RESEND_API_KEY is not set. Without it the Payload adapter falls back to ' +
        'console logging — set the key (and RESEND_FROM_ADDRESS) before running this script.',
    );
    process.exit(1);
  }

  const { getPayload } = await import('payload');
  const configModule = await import('../src/payload.config');
  const payload = await getPayload({ config: configModule.default });

  const result = await payload.sendEmail({
    to: recipient,
    subject: 'PflegeAtlas Mail-Test',
    html: '<p>Wenn du das liest, funktioniert das Mail-Setup.</p>',
  });

  console.log('Sent:', JSON.stringify(result, null, 2));
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm vitest run tests/unit/send-test-mail.test.ts
```

Expected: 5 tests passing.

- [ ] **Step 6:** Full suite check.

```bash
pnpm test
```

Expected: 36/36 grün.

- [ ] **Step 7:** Lint check.

```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add scripts/send-test-mail.ts tests/unit/send-test-mail.test.ts
git commit -m "$(cat <<'EOF'
feat(v1.3a): CLI sanity-check script send-test-mail.ts

Exports parseRecipient() for testable arg handling, plus a CLI entry
that boots Payload, calls payload.sendEmail() once, and exits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: .env.example dokumentieren

**Files:**
- Create: `.env.example`

- [ ] **Step 1:** Prüfen ob `.env.example` schon existiert.

```bash
test -f .env.example && echo "exists — review first" || echo "does not exist — create new"
```

- [ ] **Step 2: Write file**

Create `.env.example`:

```bash
# PflegeAtlas — Beispiel-Environment.
# Kopiere als .env und passe Werte an. .env ist gitignored.
# Die Mail-Vars sind optional in Dev — leer lassen, dann läuft Payload mit Console-Logger.

# --- Datenbank ---
DATABASE_URI=postgres://postgres:postgres@localhost:5432/pflegeatlas

# --- Payload ---
# Beliebige lange Zufallszeichenkette für Dev; rotieren für Production.
PAYLOAD_SECRET=

# --- Public URL ---
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# --- Mail (optional in Dev, Pflicht in Production) ---
# Wenn RESEND_API_KEY leer ist, fällt Payload auf Console-Logging zurück.
# In Production werden diese Werte aus dem Hosting-Dashboard gesetzt, nicht hier.
RESEND_API_KEY=
RESEND_FROM_ADDRESS=noreply@pflegeatlas.org
RESEND_FROM_NAME=PflegeAtlas

# --- Test-Mail-Skript (optional) ---
# Default-Empfänger für `pnpm tsx scripts/send-test-mail.ts`, wenn kein CLI-Arg gegeben.
TEST_MAIL_TO=
```

- [ ] **Step 3:** Sicherstellen, dass `.env` (lokal, gitignored) **nicht** aus Versehen Mail-Vars enthält die das Verhalten ändern.

```bash
grep -E '^(RESEND_|TEST_MAIL_)' .env 2>/dev/null && echo "WARN: mail vars in .env — review" || echo ".env clean of mail vars"
```

Expected: `.env clean of mail vars` (oder Reviewing wenn Oliver für manuelle Test-Sessions schon was reingeschrieben hat — dann lassen).

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
docs(v1.3a): add .env.example documenting mail vars

Mail vars are optional in dev — empty values trigger console fallback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: README + CONTRIBUTING aktualisieren

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1:** Aktuelles README ansehen — welche Abschnitte gibt es, wo passt „Mail-Setup" rein? Standard wäre nach „Setup" und vor „Mitmachen/Beitragen".

```bash
grep -n "^##" README.md
```

- [ ] **Step 2: Edit README.md**

Neuen Abschnitt einfügen, sinnvoller Platz: nach dem Setup-Abschnitt, vor Lizenz/Beitragen. Genauer Wortlaut:

```markdown
## Mail-Setup

PflegeAtlas verwendet [Cloudflare Email Routing](https://www.cloudflare.com/products/email-routing/) für eingehende Mails (`redaktion@pflegeatlas.org`, `mitmachen@pflegeatlas.org`) und [Resend](https://resend.com) für ausgehende Mails über `noreply@pflegeatlas.org`.

**Lokal entwickeln:** Du brauchst kein Mail-Setup. Wenn `RESEND_API_KEY` in deiner `.env` nicht gesetzt ist (Default), schreibt Payload alle Mails in die Server-Console — wie bisher.

**Mail manuell testen:** Siehe `scripts/send-test-mail.ts`. Mit gesetztem API-Key:

\`\`\`bash
RESEND_API_KEY=re_xxx \
RESEND_FROM_ADDRESS=noreply@pflegeatlas.org \
pnpm tsx scripts/send-test-mail.ts redaktion@pflegeatlas.org
\`\`\`

**Volle Setup-Anleitung** (Cloudflare Email Routing, Resend-Account, DNS-Records): siehe `docs/superpowers/specs/2026-06-05-pflegeatlas-mail-infra-v1-3a-design.md` §6.
```

**Wichtig:** Die Backslash-Codeblock-Marker oben (`\`\`\``) sind in dieser Plan-Datei escaped, damit das Plan-Markdown intakt bleibt. Beim Einfügen in `README.md` werden sie zu normalen `` ``` `` Markern.

- [ ] **Step 3: Edit CONTRIBUTING.md**

Einen kurzen Hinweis im Setup-Abschnitt von CONTRIBUTING einfügen — direkt nach den Dev-Server-Start-Befehlen:

```markdown
### Mail-Verhalten in Dev

Ohne `RESEND_API_KEY` in `.env` schreibt Payload alle Mails in die Console — kein Setup nötig. Für die manuelle Verifikation des Resend-Pfads gibt es `scripts/send-test-mail.ts`; Details in `README.md#mail-setup`.
```

- [ ] **Step 4:** Beide Files lokal in Vorschau anschauen (z.B. `cat README.md | head -80`) — visuell prüfen dass Markdown intakt ist (keine Inline-Code-Marker offen, keine kaputten Listen).

- [ ] **Step 5:** Lint + Test (Sanity).

```bash
pnpm lint && pnpm test
```

Expected: 0 errors, 36/36 grün.

- [ ] **Step 6: Commit**

```bash
git add README.md CONTRIBUTING.md
git commit -m "$(cat <<'EOF'
docs(v1.3a): document mail setup in README and CONTRIBUTING

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Lokale Verifikation (Sync-Punkt)

**Voraussetzung:** Pre-Task A **und** Pre-Task B sind abgeschlossen. Code-Tasks 1–6 sind committed.

**Wer:** Oliver führt das Skript aus, Claude verifiziert Output.

- [ ] **Step 1:** API-Key in Olivers Shell verfügbar machen (z.B. via 1Password CLI, copy-paste aus Vault, oder temporär als ENV-Var). Keinen Persist in `.env`.

- [ ] **Step 2:** Test-Skript ausführen.

```bash
RESEND_API_KEY=re_xxx \
RESEND_FROM_ADDRESS=noreply@pflegeatlas.org \
pnpm tsx scripts/send-test-mail.ts redaktion@pflegeatlas.org
```

Expected: Output endet mit `Sent: { ... id: "..." }` und Exit-Code 0.

- [ ] **Step 3:** Resend-Dashboard prüfen — gibt's einen Send-Eintrag?

URL: `https://resend.com/emails`

Expected: Eintrag mit `to: redaktion@pflegeatlas.org`, Status `delivered` (oder `sent`, wechselt schnell).

- [ ] **Step 4:** Olivers Gmail-Inbox prüfen.

Expected: Mail mit Subject „PflegeAtlas Mail-Test" ist angekommen. **Auch im Spam-Ordner schauen** — DMARC/SPF-Konflikte beim ersten Setup sind häufig.

- [ ] **Step 5:** Wenn nicht angekommen — Diagnose:
  - Spam-Ordner: ist sie dort → SPF/DKIM-Records prüfen (manchmal verzögerte Propagation, 24h abwarten)
  - Resend zeigt `delivered`: Cloudflare Routing fehlt oder Forward-Mailbox ist verkehrt → Pre-Task A Schritt 3–4 wiederholen
  - Resend zeigt `bounced`: DMARC-Reject → DMARC-Record in Cloudflare auf `p=none` setzen während Setup-Phase
  - `Error: ...` im Skript-Output: API-Key ungültig oder FROM_ADDRESS gehört nicht zur verifizierten Domain → ENV-Vars prüfen

- [ ] **Step 6:** Sobald Mail in Olivers Inbox liegt: **Erfolg.** V1.3a-Funktionalität ist bestätigt.

**Kein Commit hier** — Task 7 ist reine Verifikation, kein Code-Change.

---

## Task 8: PR erstellen, CI durch, Merge

**Files:** keine — reine Git-/GitHub-Operationen.

- [ ] **Step 1:** Sicherstellen, dass alles committed ist.

```bash
git status
```

Expected: `On branch feat/v1-3a-mail-infra`, working tree clean.

- [ ] **Step 2:** Lokal alles grün?

```bash
pnpm test && pnpm lint && pnpm build
```

Expected: 36/36 Tests, 0 Lint-Errors, Build grün.

- [ ] **Step 3:** Push.

```bash
git push -u origin feat/v1-3a-mail-infra
```

- [ ] **Step 4:** PR erstellen via gh CLI.

```bash
gh pr create --title "V1.3a: Mail-Infrastruktur (Cloudflare Routing + Resend Adapter)" --body "$(cat <<'EOF'
## Summary

V1.3a stellt die Mail-Plumbing für PflegeAtlas bereit, **bevor** sie V1.3b (Submission-Formular) tatsächlich braucht. Eigenständiger Plan, weil dieselbe Infrastruktur später von Auth-Verification-Mails und Editor-Einladungen verwendet wird.

- **Empfangen:** Cloudflare Email Routing leitet `redaktion@pflegeatlas.org` und `mitmachen@pflegeatlas.org` an Mailboxen der Redaktion. Reines Dashboard-Setup, kein Code.
- **Senden:** `@payloadcms/email-resend` als Adapter, conditional in `src/payload.config.ts` registriert. Lokal ohne `RESEND_API_KEY` → Console-Logger (unverändertes Dev-Verhalten). Production mit Key → echtes Resend.
- **Helper:** `src/lib/email-config.ts` kapselt die Conditional-Logic, voll unit-testbar.
- **Sanity-Check:** `scripts/send-test-mail.ts` sendet einmalig eine Test-Mail mit angegebenem API-Key.
- **Doku:** `README.md`, `CONTRIBUTING.md`, `.env.example` aktualisiert.

## Spec + Plan

- Spec: \`docs/superpowers/specs/2026-06-05-pflegeatlas-mail-infra-v1-3a-design.md\`
- Plan: \`docs/superpowers/plans/2026-06-05-pflegeatlas-mail-infra-v1-3a.md\`

## Verification

- \`pnpm test\`: 36/36 grün
- \`pnpm lint\`: 0 Errors
- \`pnpm build\`: grün
- Manuell verifiziert: Test-Mail an \`redaktion@pflegeatlas.org\` gesendet, Resend-Dashboard zeigt \`delivered\`, in Empfangs-Mailbox angekommen.

## Test plan

- [ ] CI grün warten
- [ ] Dev-Server kurz starten (\`pnpm dev\`), Warning „No email adapter provided" sollte unverändert kommen
- [ ] Branch nach Merge gelöscht

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR-URL wird ausgegeben.

- [ ] **Step 5:** CI-Status pollen (Background-Bash mit until-loop).

```bash
until s=$(gh pr checks --json bucket --jq '.[0].bucket' 2>/dev/null) && [ "$s" != "pending" ] && [ -n "$s" ]; do sleep 15; done; echo "CI: $s"
```

Expected: `CI: pass`.

- [ ] **Step 6:** Mergen.

```bash
gh pr merge --merge --delete-branch
```

Expected: Merge-Commit auf `main`, Branch lokal und remote entfernt.

- [ ] **Step 7:** Lokal sync.

```bash
git checkout main && git pull && git log --oneline -3
```

Expected: Letzter Commit ist Merge-Commit von V1.3a.

- [ ] **Step 8:** Memory-Update.

Update `memory/project_pflegeatlas.md` — vermerken dass V1.3a fertig auf main ist, V1.3b kann starten. (Diesen Schritt führt Claude im Anschluss durch.)

---

## Self-Review

Am Ende der Plan-Schreibphase: Plan gegen Spec abgeglichen.

**Spec-Coverage:**

- Spec §1 (Zweck + Scope) → durch Plan-Header + File-Structure-Tabelle abgedeckt
- Spec §2 (Architektur, zwei Pfade) → Pre-Task A (Empfang), Tasks 1–4 (Senden)
- Spec §3 (Adress-Layout) → Pre-Task A Schritt 3+5 (Routing-Adressen), Task 5 (.env.example mit FROM_ADDRESS)
- Spec §4 (Dev/Prod-Verhalten, conditional Adapter) → Task 2 (Helper) + Task 3 (Wire-up) + Task 5 (.env.example dokumentiert das Verhalten) + Task 3 Schritt 6 (Smoketest bestätigt Dev-Fallback)
- Spec §5 (Repo-Änderungen + Dateiliste) → 1:1 in File-Structure und Tasks 1–6
- Spec §6 (Setup-Reihenfolge) → Pre-Task A + B + Tasks 1–8 als Umsetzung
- Spec §7 (Test-Strategie: Unit + manuelle Verifikation, keine E2E) → Tasks 2 + 4 (Unit), Task 7 (manuell)
- Spec §8 (Verifikations-Kriterien) → Checkliste in Task 7 + Task 8 prüft jeden Punkt ab
- Spec §9 (Out-of-Scope) → Plan berührt keine der Out-of-Scope-Items

**Placeholder-Scan:** Keine TBDs, alle Tests haben vollständigen Code, alle Commands haben Expected-Output.

**Type-Consistency:** `buildEmailConfig()` heißt in Task 2 (Definition), Task 3 (Verwendung), und in den Tests (Import) identisch. `parseRecipient()` ditto in Task 4. Keine Drift.

Plan ist ready.
