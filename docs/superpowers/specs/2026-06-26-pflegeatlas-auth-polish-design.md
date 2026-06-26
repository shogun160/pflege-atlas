# PflegeAtlas Auth-Polish-Bundle — Design

**Datum:** 2026-06-26
**Status:** Spec
**Scope:** Sub-C3 Polish-Items I-2 + I-3 + I-4 + Reset-Bug-Fix + T5-M1 Test-Helper-Extraktion
**Branch:** `feat/auth-polish`

## Kontext

Sub-C3 Audit-Log (PR #36) hat 12 User-Lifecycle-Events live geschaltet. Drei Polish-Items aus den Code-Reviews wurden als nicht-blockierend dokumentiert:

- **I-2:** `loginAction` macht 2 DB-Roundtrips auf Success-Path (Pre-Lookup + Payload's interner Lookup)
- **I-3:** `isInvitationAcceptPattern` ist eine Timestamp-Heuristik (60s-Toleranz) für die Audit-Event-Type-Bestimmung, obwohl die Page-Layer-Bestimmung längst authoritativ ist
- **I-4:** `setPasswordFromTokenAction` nimmt keine `requestHeaders` an → keine IP/UA-Capture für `invitation.accept` (spec-konform `-`, aber forensisch wertvoll)

Beim Brainstorm-Code-Walk fiel zusätzlich ein **latenter Production-Bug** auf:

- **Reset-Bug:** `setPasswordFromTokenAction` sucht ausschließlich im V1.6-custom `setPasswordToken`-Feld. Payload-native Reset-Tokens landen aber in `resetPasswordToken`. Beide Pfade laufen durch dasselbe Form/dieselbe Action → Reset-Tokens werden niemals matched → `'Token ungültig.'`. Existierende Tests verdecken den Bug, indem sie Reset-Tokens fälschlich ins `setPasswordToken`-Feld schreiben.

Zusätzlich wird **T5-M1** (Test-Helper-DRY) als Piggyback erledigt: Das `vi.doMock('next/headers', …)`-Pattern ist derzeit **28-mal in `tests/`** dupliziert, und die neuen Tests aus diesem Bundle brauchen es zusätzlich. Helper wird neu angelegt; **migriert werden in diesem PR nur die Test-Dateien, die wir ohnehin anfassen** (~3–5 Dateien). Die verbleibenden Aufrufer bleiben für einen mechanischen Follow-up-PR offen — bewusste Scope-Disziplin.

## Ziele

1. Login-Success-Path von 2 auf 1 DB-Roundtrip reduzieren ohne Bucket-Detection-Verlust auf Failure-Path
2. Mode-Bestimmung (`invitation.accept` vs `password.reset.complete`) authoritativ via DB-Token-Field-Match statt Heuristik oder Client-Hint
3. Reset-Flow funktionstüchtig machen (Production-Bug behoben)
4. IP/UA-Capture für `invitation.accept` UND `password.reset.complete` einheitlich
5. Welcome-Mail nur noch im invitation-Pfad (Verhaltens-Korrektur)
6. Test-Helper-Duplication (`vi.doMock('next/headers')`) eliminieren

## Non-Goals

- Keine API-Boundary-Verschiebung, keine neuen Module
- Keine Payload-Config-/Collection-/Migration-Changes
- Keine UI-Änderungen (`SetPasswordForm` bleibt; `mode`-Hidden-Field bleibt für DSGVO-UI)
- Keine i18n-Infrastruktur für andere Strings (nur die eine deutsche Mapping-Zeile für expired-reset)
- Keine Welcome-Mail-Rework über die invitation-only-Bedingung hinaus
- Keine V1.6.1-UI-Polish-Items (Avatar-Upload, Password-Toggle) — separater Track

## Architektur

Alle Änderungen bleiben in **`src/lib/auth.ts`** und **`src/app/(frontend)/passwort-setzen/actions.ts`**.

**Touch-Map:**

| Datei | Funktion / Abschnitt | Änderung |
|---|---|---|
| `src/lib/auth.ts` | `loginAction` (Z. 116–191) | Pre-Lookup von vor-`payload.login` in den `catch`-Block verschoben |
| `src/lib/auth.ts` | `isInvitationAcceptPattern` + Konstanten (Z. 276–292) | **Komplett entfernt** |
| `src/lib/auth.ts` | `setPasswordFromTokenAction` (Z. 294–365) | Refactor mit zwei privaten Helpers + optionalem `requestHeaders`-Parameter |
| `src/lib/auth.ts` | Neu: `handleInvitationAccept` (private) | V1.6-Custom-Token-Pfad, manueller `update` + `payload.login` + Welcome-Mail |
| `src/lib/auth.ts` | Neu: `handleResetComplete` (private) | Payload-native `payload.resetPassword`-Pfad, kein Welcome-Mail |
| `src/app/(frontend)/passwort-setzen/actions.ts` | `setPasswordFormAction` | `await headers()` lesen + an Action durchreichen |
| `tests/helpers/mock-next-headers.ts` | **NEU** | DRY-Helper für `vi.doMock('next/headers', …)` (T5-M1) |
| `tests/integration/audit-log-triggers.test.ts` | invitation/reset-Tests | Reset-Test umschreiben auf realen `payload.forgotPassword`-Flow |
| `tests/integration/auth-set-password-from-token.test.ts` | Bestehende 5 Tests | Unverändert (selber Flow für invitation-Pfad) |

**Keine** neue Datei außer dem Test-Helper. Keine API-Surface-Expansion außer dem dritten optionalen Parameter an `setPasswordFromTokenAction`.

## Datenfluss

```
Browser → setPasswordFormAction (server)
            ├─ liest token, password, dsgvo, mode (mode nur UI-gating für DSGVO)
            ├─ liest await headers()
            └─ ruft setPasswordFromTokenAction(token, password, headers)
                  ├─ find setPasswordToken-Feld → handleInvitationAccept
                  │     ├─ isTokenValid(setPasswordTokenExpiresAt)
                  │     ├─ payload.update (password + clear V1.6-Token)
                  │     ├─ writeAuditLog 'invitation.accept' (IP/UA via Headers)
                  │     ├─ sendMail welcome
                  │     ├─ payload.login + setAuthCookie
                  │     └─ return { ok, redirectTo }
                  ├─ find resetPasswordToken-Feld → handleResetComplete
                  │     ├─ isTokenValid(resetPasswordExpiration)  (Pre-Check, vermeidet String-Match auf Payload-Error)
                  │     ├─ payload.resetPassword({ data: { token, password }, overrideAccess: true })
                  │     ├─ writeAuditLog 'password.reset.complete' (IP/UA via Headers)
                  │     ├─ setAuthCookie aus result.token
                  │     └─ return { ok, redirectTo }
                  └─ neither matched → return { ok: false, error: 'Token ungültig.' }
```

## I-2: `loginAction` Pre-Lookup-Refactor

Vorher (Z. 131–139): `payload.find` läuft **immer** vor `payload.login`. Auf Success-Path = 2 DB-Roundtrips.

Nachher: `payload.find` läuft **nur im catch-Block** für Bucket-Disambiguation (`unknown` / `disabled` / `locked` / `wrong-password`). Success-Path nutzt `result.user` direkt.

Effekte:

- Success: **1 DB-Roundtrip statt 2**
- Failure: 1 Roundtrip (jetzt in catch statt davor)
- Audit-Semantik unverändert (`actor`, `actorEmail`, `metadata.bucket`)
- Email-Existence-Oracle-Defense unverändert (generic Error-Message zum Client)
- Dead-Branch `if (!result.token)` (Z. 146–155) bleibt drin (TS verlangt's), aber ohne Pre-Lookup-Aufruf. `actor` dort `null` (rare path, best-effort).

## I-3 + Reset-Bug-Fix: `setPasswordFromTokenAction`

**Mode-Quelle = Server-side Token-Field-Match** (nicht Form-`mode`, nicht Heuristik).

**Lookup-Strategie:** Zwei sequenzielle Finds (mirror `passwort-setzen/page.tsx`-Pattern: V1.6-first, dann native). Bewusst kein `or`-Query — die Reihenfolge ist semantisch wichtig (Invitation-gewinnt-Edge-Case bei beidem gleichzeitig).

**Invitation-Pfad (`handleInvitationAccept`):**
- `isTokenValid(setPasswordTokenExpiresAt)` → bei abgelaufen: `'Token abgelaufen.'`
- Manueller `payload.update` (Password + clear `setPasswordToken` + `setPasswordTokenExpiresAt`)
- `writeAuditLog 'invitation.accept'` mit `loginContext` aus Headers
- `renderWelcomeMail` + `sendMail` (failure → `console.warn`)
- Manueller `payload.login` für Auto-Cookie; `if (loginResult.token)`-Guard bleibt (Disabled-Hook-Throw wird silent geschluckt, User wird redirected ohne Cookie — bestehendes Verhalten)

**Reset-Pfad (`handleResetComplete`):**
- `isTokenValid(resetPasswordExpiration)` — **Pre-Check**, vermeidet String-Match auf Payload-internem Error-Text
- `payload.resetPassword({ collection: 'users', data: { token, password: newPassword }, overrideAccess: true })`
  - Payload regeneriert Salt+Hash, clear-Token, returnt JWT — alles transaktional korrekt
  - `overrideAccess: true` ist nötig, weil `resetPasswordToken` als `update: () => false` markiert ist (Payload-base-auth-fields)
- `writeAuditLog 'password.reset.complete'` mit `loginContext`
- `setAuthCookie(result.token)` — kein zweiter `payload.login`-Call
- **Kein Welcome-Mail** (Verhaltens-Korrektur)

**Entfernt:**
- `isInvitationAcceptPattern` (Z. 284–292)
- `INVITE_EXPIRY_HEURISTIC_MS` (Z. 281)
- `INVITE_PATTERN_TOLERANCE_MS` (Z. 282)

**Edge-Cases:**

- **Beide Token-Felder gleichzeitig gesetzt:** Invitation gewinnt (Reihenfolge). Realistisch produktion-irrelevant.
- **Token-Reuse (Concurrent Tabs):** Zweiter Aufruf findet keinen Match → `'Token ungültig.'`. Korrekt.
- **Email-Change zwischen Token-Issue und Set-Password:** Aktuelle Email landet in Welcome-Mail + Audit. Konsistent zwischen beiden Pfaden (DB-Lookup gewinnt).

## I-4: `requestHeaders` Wire-Up

**`setPasswordFromTokenAction`** akzeptiert einen optionalen dritten Parameter `requestHeaders?: Headers`. Wenn übergeben → in `loginContext` umgewandelt via vorhandenem `extractLoginContext`-Helper → in beiden Audit-Pfaden geschrieben.

**`setPasswordFormAction`** (Form-Wrapper) liest `await headers()` und reicht durch:

```ts
const requestHeaders = await headers();
const result = await setPasswordFromTokenAction(token, password, requestHeaders);
```

Pattern identisch zur bestehenden `loginAction`-Caller-Konvention.

**`mode`-Hidden-Field** bleibt im Form für DSGVO-Conditional, wird aber nicht mehr in die Action propagiert. Server vertraut nicht dem Client-Hint.

## i18n — Reset-Token-Expired-Mapping

Pre-Check via `isTokenValid(user.resetPasswordExpiration)` **vor** dem `payload.resetPassword`-Call. Bei abgelaufen: `{ ok: false, error: 'Token abgelaufen.' }`.

Vorteil: Eliminiert String-Match-Brittleness auf Payloads englischen Error-Text. Konsistent mit invitation-Pfad-Pattern.

## Error-Handling

Outer `try/catch` in `setPasswordFromTokenAction` bleibt → mappt unerwartete Throws (DB-Connection, FK-Conflict) auf generische User-Message.

- `writeAuditLog`-Failure: silent (Sub-C3-Pattern, Auth > Audit)
- Welcome-Mail-Failure: `console.warn` (Invitation-Path-Only)
- `payload.login`-Failure im Invitation-Path: silent (User wird redirected, ohne Cookie → muss sich manuell einloggen; aktueller Verhalten)
- `payload.resetPassword`-Throw (z.B. Token-Race oder DB-Error): geht durch outer catch

**Keine neuen Error-Klassen, keine neuen Throw-Surfaces.**

## Testing

### Unverändert
- `tests/integration/auth-set-password-from-token.test.ts` (5 Tests) — alle Tests testen invitation-Pfad-Verhalten, das semantisch identisch bleibt

### Umgeschrieben
- `tests/integration/audit-log-triggers.test.ts` Reset-Test (Z. 182–207): bisher schreibt das Reset-Token ins `setPasswordToken`-Feld (verdeckt den Bug). Neu: `payload.forgotPassword({ collection: 'users', data: { email }, disableEmail: true })` → Token aus DB-Row `resetPasswordToken` ziehen → action call → assert `password.reset.complete`-Audit-Row + `result.ok=true`.

### Neu

1. **Reset-Flow E2E Regression (Bug-Fix-Doku):** wie umgeschriebener Test + zusätzlicher Assert, dass das neue Password tatsächlich für Login funktioniert (`payload.login` mit dem neuen Password = success).
2. **Reset-Token expired → deutscher Text:** User mit `resetPasswordExpiration` in der Vergangenheit → action → assert `{ ok: false, error: 'Token abgelaufen.' }`.
3. **Welcome-Mail-Asymmetrie (Behavior-Change-Beweis):** Mock `@/lib/mail`-`sendMail`-Spy. Invitation-Path: spy called 1×. Reset-Path: spy called 0×.
4. **`requestHeaders` Threading — Invitation:** Headers mit `x-forwarded-for: 10.0.0.1`, `user-agent: TestAgent` → action → audit-row hat `ipHash !== null`, `userAgent === 'TestAgent'`.
5. **`requestHeaders` Threading — Reset:** dito für reset-Pfad.
6. **Token-Conflict Edge-Case:** User mit beiden Token-Feldern gesetzt → Invitation-Path gewinnt (`invitation.accept`-Event written). Liner-Test, Doku-Charakter.

### Nicht hinzufügen
- Spy-Test "loginAction success-Path ruft payload.find nicht auf" — testet Implementation-Detail. Bestehende Bucket-Detection-Tests beweisen Korrektheit.

### T5-M1 Test-Helper

Neuer Helper `tests/helpers/mock-next-headers.ts`:

```ts
import { vi } from 'vitest';

export function mockNextHeaders(headers: Headers = new Headers()) {
  vi.doMock('next/headers', () => ({
    cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    headers: async () => headers,
  }));
}

export function unmockNextHeaders() {
  vi.doUnmock('next/headers');
}
```

**In-Scope-Migration für diesen PR:** Test-Dateien, die wir ohnehin anfassen — `tests/integration/audit-log-triggers.test.ts` + `tests/integration/auth-set-password-from-token.test.ts` + neue Test-Datei(en). Die übrigen ~22 Aufrufer in anderen Test-Dateien bleiben unverändert für einen mechanischen Follow-up-PR. Bestehende Test-Coverage bleibt identisch.

### Erwartete Test-Counts

- Vorher: 420 grün
- Nachher: ~426–428 grün (5–7 neue Tests; 1 umgeschrieben mit additional assertion; 0 entfernt)

## Risiken

| Risiko | Wahrscheinlichkeit | Mitigation |
|---|---|---|
| `overrideAccess: true` öffnet ungewollt Felder | niedrig | `payload.resetPassword` ist eine dedizierte Auth-Operation; `overrideAccess` betrifft nur den Auth-Endpoint-Pfad, nicht generelle Field-Access-Regeln |
| Mode-Field-Lookup Reihenfolge falsch | niedrig | Invitation-zuerst spiegelt page.tsx; Konflikt-Edge-Case durch Test #6 dokumentiert |
| Welcome-Mail-Removal stört bestehende User | sehr niedrig | Production-Bug verhinderte bisher jeden Reset-Erfolg → niemand hat je Welcome-Mail bei Reset bekommen |
| `payload.resetPassword` returnt anders als erwartet | niedrig | Payload-Source-Inspektion bestätigt: `{ token, user }` Result-Shape; Test #1 verifiziert E2E |
| I-2-Refactor verändert Audit-Inhalt | niedrig | Bestehende 18 Trigger-Integration-Tests fangen jede Bucket-Detection-Regression |

## Deployment

**Keine Migration.** Keine ENV-Änderungen. Kein Cron-Touch. Kein Datenschutz-Text-Touch (Spec war für Sub-C3 bereits umfassend).

**Phase-2-Portabel:** Keine Vercel-spezifischen APIs angetastet.

## Out of Scope (Future-Polish-Items, dokumentiert in Projekt-Memory)

- **T5-M2:** `email.change.self`-Event-Type — entfernt, falls V1.7 jemals self-Email-Edit erlaubt
- **V1.6.1-UI-Polish:** Avatar-Upload, Password-Toggle
- **Image-Optimizer-Diagnose**
- **Sentry-Integration** für Audit-Write-Failures
- **Self-View-UI** „Recent Activity" in Mein-Bereich

## Referenzen

- Brainstorm-Session: 2026-06-26 (diese Session)
- Sub-C3-Spec: `docs/superpowers/specs/2026-06-25-pflegeatlas-audit-log-sub-c3-design.md`
- Sub-C3-PR: github.com/shogun160/pflege-atlas/pull/36
- Healthcheck-PR: github.com/shogun160/pflege-atlas/pull/37
- Payload-Operation-Source: `node_modules/payload/dist/auth/operations/resetPassword.{js,js.map}`
