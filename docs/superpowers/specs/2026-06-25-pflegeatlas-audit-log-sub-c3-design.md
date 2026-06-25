# PflegeAtlas — Sub-C3 Audit-Log

**Datum:** 2026-06-25
**Status:** Spec
**Vorgänger:** Sub-C1 (PR #34, `79f8b48`) — Articles-Export-Pagination. Sub-C2 (PR #35, `86adad1`) — Avatar-Hard-Delete + Right-to-Erasure-Runbook.
**Track:** Sub-C (DSGVO-Code-Härtung), drittes und letztes von drei Mini-Plans. Schließt den Track ab.

## Problem

Drei zusammenhängende Lücken:

**1. Keine forensische Spur bei User-Lifecycle-Events.**
- Heutiger Code-Stand: ein einzelnes `console.warn('[auth.loginAction] login rejected', err)` in `src/lib/auth.ts:134`. Vercel-Hobby-Logs sind nur **1h** persistent.
- Bei Vorfällen („Wer hat User X zum Admin gemacht?", „Wer hat sich von wo wie oft erfolglos eingeloggt?", „Wann wurde Account Y deaktiviert?") gibt es **nichts** zu rekonstruieren.

**2. DSGVO Art. 5(2) Rechenschaftspflicht nicht abgesichert.**
- V1.6 hat Anonymisierung bei Soft-Delete eingeführt, Sub-C2 hat Hard-Delete für Avatare ergänzt. Ohne Audit-Trail können wir nicht nachweisen, dass diese Verarbeitungen tatsächlich stattgefunden haben.
- V1.7-Datenschutz-Spec Section 10 hat intern *„Audit-Log (Sub-C, später) — 90 Tage — Art. 6(1)(f)"* versprochen. Live-`DatenschutzSections.tsx` erwähnt es noch nicht — wir haben Spielraum, müssen aber das interne Versprechen jetzt einlösen.

**3. Sub-C2-Runbook verweist auf Audit-Log.**
- `docs/legal/right-to-erasure-runbook.md` Section 7 (Sub-C2) sagt: *„Vermerk in Audit-Log (sobald Sub-C3 existiert — bis dahin: handschriftliche Notiz in 1Password-Vault)."* Sub-C3 löst diesen offenen Verweis ein.

## Entscheidungen (Brainstorm 2026-06-25)

| Frage | Entscheidung |
|---|---|
| Event-Scope? | **Variante B.** Sicherheitskern + Admin-Aktionen (~11 Event-Typen, plus 1 System-Meta-Event). Self-Service-Mutationen (Profile-Update, Avatar-Upload) bleiben außen vor — Lärm ohne Forensik-Mehrwert. Avatar-Hard-Delete ist über Sub-C2-Runbook dokumentiert. |
| Storage-Form? | **Variante 1.** Payload-Collection `audit-logs` in Neon. Konsistent mit Sub-C1/C2-Pattern, Admin-UI gratis, leichte Testbarkeit. |
| Verhalten bei Anonymisierung? | **Variante b.** Relation (`actorUserId` / `subjectUserId`) PLUS Email-Snapshot (`actorEmail` / `subjectEmail`). Snapshots überleben Anonymisierung. Juristische Stütze: Art. 17(3)(b)+(e) DSGVO i.V.m. 90-Tage-Retention. |
| IP / User-Agent? | **Variante b.** Pseudonymisierte IP (SHA256(IP + Server-Secret)) + UA-truncated, **nur** bei `login.*`-Events. Brute-Force-Korrelation möglich, kein Klartext-IP. |
| Trigger-Pattern? | **Hybrid.** Payload-`afterChange`-Hooks auf `users` für Datenmutations-Events (fängt Admin-UI + Server-Actions). Inline-Calls in Server-Actions für Lifecycle-Events ohne Collection-Write (Login, Reset, Invitation-Accept) sowie Runbook-Script. |
| Failure-Mode bei Audit-Write-Error? | **Variante b.** Silent (try/catch + `console.error`). Audit-Log darf nie User-Action blockieren. Verifikation über Tests pro Event-Trigger. |
| Retention-Mechanismus? | **Variante b.** Piggyback auf existierenden T5-Cron (`/api/cron/cleanup-submissions`-Pendant). Spart den letzten Vercel-Hobby-Cron-Slot. |
| Read-Access für User? | **Variante c.** Admin-only via Payload-Admin-UI. Self-Read über Erweiterung des bestehenden `exportOwnDataAction` (DSGVO Art. 15). Kein neues UI. |

## Architektur

### Collection-Schema

Neue Collection `audit-logs` in `src/collections/AuditLogs.ts`, registriert in `src/payload.config.ts`.

| Feld | Typ | Notes |
|---|---|---|
| `id`, `createdAt`, `updatedAt` | Payload-Default | `createdAt` indexed |
| `eventType` | text/enum | einer der 12 Werte (siehe unten), indexed |
| `actorUserId` | relationship → users (integer FK), nullable, `onDelete: SET NULL` | wer die Aktion ausgelöst hat (null bei System-Events + unknown-login) |
| `actorEmail` | text, nullable | Email-Snapshot zum Event-Zeitpunkt |
| `subjectUserId` | relationship → users (integer FK), nullable, `onDelete: SET NULL` | wer Ziel der Aktion war |
| `subjectEmail` | text, nullable | Email-Snapshot des Subjects |
| `metadata` | json (jsonb), nullable | event-spezifisch |
| `ipHash` | text, nullable, maxLength 64 | SHA256(IP + SECRET), hex, nur bei `login.*` |
| `userAgent` | text, nullable, maxLength 200 | truncated UA, nur bei `login.*` |

**Indices:** `created_at`, `event_type`, `actor_user_id`, `subject_user_id`.

**Access-Control:**
- `read`: `({ req }) => req.user?.role === 'admin'`
- `create`: `() => false` — nur server-side via `overrideAccess: true`
- `update`: `() => false` — immutable
- `delete`: `() => false` — nur Cleanup-Cron via `overrideAccess: true`

**Admin-UI:**
- `admin.useAsTitle: 'eventType'`
- `admin.defaultColumns: ['createdAt', 'eventType', 'actorEmail', 'subjectEmail']`
- `admin.group: 'System'`
- nicht hidden

### Die 12 Event-Typen

| # | eventType | Actor | Subject | metadata | IP/UA |
|---|---|---|---|---|---|
| 1 | `login.success` | logging-in user | — | – | ✓ |
| 2 | `login.failure` | nullable | – | `{ bucket: 'wrong-password' \| 'disabled' \| 'locked' \| 'unknown', emailAttempt: string }` | ✓ |
| 3 | `password.reset.request` | nullable | requesting user (falls existiert) | `{ emailAttempt: string }` | – |
| 4 | `password.reset.complete` | resetting user | self | – | – |
| 5 | `invitation.create` | admin | invited user | `{ assignedRole: string }` | – |
| 6 | `invitation.accept` | invited user | self | – | – |
| 7 | `role.change` | admin | changed user | `{ oldRole: string, newRole: string }` | – |
| 8 | `account.disable` | admin | disabled user | `{ reason?: string }` | – |
| 9 | `account.soft_delete.self` | self-deleting user | self | – | – |
| 10 | `account.erasure.runbook` | admin | erased user | `{ stage: 'anonymize' \| 'hard_delete', method: 'runbook_script' \| 'manual_psql', notes?: string }` | – |
| 11 | `email.change.admin` | admin | changed user | `{ oldEmail: string, newEmail: string }` | – |
| 12 | `audit.cleanup.run` | null (system) | – | `{ deletedCount: number, retentionDays: 90 }` | – |

**Edge-Case-Entscheidungen:**

- **`login.failure` mit unbekannter Email:** `actorUserId=null`, `actorEmail=null`, `metadata.emailAttempt=<eingegebene Email>`. Bringt fremde Email-Adressen ins Log; nötig für Brute-Force-Forensik. 90-Tage-Retention deckt ab; Datenschutzerklärung deklariert explizit.
- **`account.erasure.runbook`:** zwei Sub-Pfade. (a) Stage `anonymize` — Sub-C2-Script (`right-to-erasure.ts`) führt Anonymisierung + Avatar-Hard-Delete aus, User-Row bleibt. (b) Stage `hard_delete` — echtes psql-DELETE laut Runbook Section 6 (manuell, kein Auto-Audit). Für (b) müsste Admin **vorher** den Audit-Eintrag manuell setzen (oder das Runbook erweitert um einen Pre-Delete-Helper-Call). Bei FK-Cascade durch echtes User-DELETE wird `subjectUserId` auf `null` gesetzt (`ON DELETE SET NULL`); `subjectEmail`-Snapshot überlebt. Konsequenz: ein post-Delete-Audit-Eintrag ohne Subject-Reference ist möglich, der Snapshot dokumentiert die Tat.
- **`audit.cleanup.run`:** reines System-Event ohne User-Bezug; täglicher Heartbeat (auch bei `deletedCount=0`), liefert Frühwarnung wenn Cron stoppt.

### Helper-API

Neue Datei `src/lib/audit-log.ts`:

```ts
import type { Payload } from 'payload'

export const AUDIT_EVENT_TYPES = [
  'login.success', 'login.failure',
  'password.reset.request', 'password.reset.complete',
  'invitation.create', 'invitation.accept',
  'role.change', 'account.disable',
  'account.soft_delete.self', 'account.erasure.runbook',
  'email.change.admin', 'audit.cleanup.run',
] as const
export type AuditEventType = typeof AUDIT_EVENT_TYPES[number]

export type LoginContext = { ip: string | null; userAgent: string | null }

export type AuditEventInput = {
  eventType: AuditEventType
  actorUserId?: number | null   // matches users.id (integer/serial)
  actorEmail?: string | null
  subjectUserId?: number | null
  subjectEmail?: string | null
  metadata?: Record<string, unknown> | null
  loginContext?: LoginContext  // nur für 'login.*' relevant
}

export async function writeAuditLog(
  payload: Payload,
  input: AuditEventInput,
): Promise<void> {
  try {
    const data = {
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      actorEmail: input.actorEmail ?? null,
      subjectUserId: input.subjectUserId ?? null,
      subjectEmail: input.subjectEmail ?? null,
      metadata: input.metadata ?? null,
      ipHash: input.loginContext?.ip ? hashIp(input.loginContext.ip) : null,
      userAgent: truncateUserAgent(input.loginContext?.userAgent),
    }
    await payload.create({
      collection: 'audit-logs',
      data,
      overrideAccess: true,
    })
  } catch (err) {
    console.error('[audit] write failed', { eventType: input.eventType, err })
    // niemals throw — Audit darf User-Action nicht blockieren
  }
}

export function hashIp(ip: string): string {
  const secret = process.env.AUDIT_IP_HASH_SECRET
  if (!secret) {
    console.error('[audit] AUDIT_IP_HASH_SECRET not set — ipHash unavailable')
    return ''  // wird im writeAuditLog-Mapping zu null via Falsy-Check
  }
  return createHash('sha256').update(`${ip}:${secret}`).digest('hex')
}

export function truncateUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null
  return ua.length > 200 ? ua.slice(0, 200) : ua
}
```

**Login-Kontext-Extraktion** (Inline in Server-Actions, keine separate Datei nötig — kurz genug):

```ts
function extractLoginContext(request: Request): LoginContext {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? request.headers.get('x-vercel-forwarded-for')
        ?? request.headers.get('x-real-ip')
        ?? null
  return { ip, userAgent: request.headers.get('user-agent') }
}
```

**ENV-Var:** `AUDIT_IP_HASH_SECRET` — Pflicht in Production. Setup-Pattern analog zu `MAIL_*`-Vars (Vercel Dashboard + 1Password). `.env.example` bekommt eine Zeile mit Dummy-Wert.

### Trigger-Punkte

| # | eventType | Trigger-Punkt | Pattern |
|---|---|---|---|
| 1 | `login.success` | `loginAction` in `src/lib/auth.ts`, nach erfolgreichem `payload.login()` | inline |
| 2 | `login.failure` | `loginAction` catch-Block (ersetzt heutiges `console.warn` in `auth.ts:134`) | inline |
| 3 | `password.reset.request` | `requestPasswordResetAction` in `src/lib/auth.ts` | inline |
| 4 | `password.reset.complete` | `resetPasswordAction` in `src/lib/auth.ts` | inline |
| 5 | `invitation.create` | `users` `afterChange` Hook, wenn `operation==='create'` und Invitation-Token gesetzt | hook |
| 6 | `invitation.accept` | `acceptInvitationAction` (V1.6) | inline |
| 7 | `role.change` | `users` `afterChange` Hook, wenn `previousDoc.role !== doc.role` | hook |
| 8 | `account.disable` | `users` `afterChange` Hook, wenn Disable-Feld kippt | hook |
| 9 | `account.soft_delete.self` | `deleteOwnAccountAction` (V1.6) | inline |
| 10 | `account.erasure.runbook` | `scripts/right-to-erasure.ts` (Sub-C2-Script, Stage `anonymize`) | inline |
| 11 | `email.change.admin` | `users` `afterChange` Hook, wenn Email-Change UND `req.user.role==='admin'` UND `req.user.id !== doc.id` | hook |
| 12 | `audit.cleanup.run` | erweiterter Cleanup-Cron, nach DELETE | inline |

**Zwei Verifikations-Punkte für T1:**
- Account-Disable-Mechanismus: exaktes Feld-Naming aus V1.6 (`disabled`? `accountStatus`?) im Code prüfen. Wenn V1.6 noch kein Disable-Feature hat, fällt Event #8 raus (Spec aktualisieren oder Event als „Feature-gekoppelt" markieren).
- `x-vercel-forwarded-for` Header-Verfügbarkeit: in T1-Spike verifizieren, ob Vercel diesen Header setzt; falls nicht, Fallback-Reihenfolge anpassen.

### Read-Access — Export-Erweiterung

`exportOwnDataAction` (V1.6, in Sub-C1 paginierbar gemacht) bekommt einen neuen Block:

```ts
const auditEntries = await fetchAllPaginated((page) =>
  payload.find({
    collection: 'audit-logs',
    where: {
      or: [
        { actorUserId: { equals: userId } },
        { subjectUserId: { equals: userId } },
      ],
    },
    sort: '-createdAt',
    page,
    limit: 1000,
  }),
  { hardCap: 10_000 }  // analog Sub-C1
)
```

**Im Export enthalten:** `createdAt`, `eventType`, `actorEmail`, `subjectEmail`, `metadata`.

**NICHT im Export:** `ipHash`, `userAgent` (Forensik-Daten für Admin, für User redundant), `actorUserId` / `subjectUserId` (UUID-Lärm).

**`fetchAllPaginated`-Helper:** wenn Sub-C1 ihn bereits als Funktion extrahiert hat, reuse. Wenn er inline in `exportOwnDataAction` lebt, im Zuge dieses Sub-Plans in z.B. `src/lib/pagination.ts` ziehen — kleiner Refactor, kein Pflichtteil.

### Retention-Cron — Piggyback

Der existierende T5-Cron aus V1.7 (vermutlich `/api/cron/cleanup-submissions` — exakter Name bei T1 verifizieren) bekommt einen zweiten Cleanup-Step.

```ts
// app/api/cron/<bestehender-name>/route.ts
export async function GET(request: Request) {
  // bestehende Authn (CRON_SECRET) unverändert
  const payload = await getPayload({ config })

  const submissionsDeleted = await cleanupRejectedSubmissions(payload)
  const auditDeleted = await cleanupExpiredAuditLogs(payload)

  return Response.json({ submissionsDeleted, auditDeleted })
}
```

Existierende Submissions-Cleanup-Logik wird in eine Funktion `cleanupRejectedSubmissions(payload)` extrahiert (kleiner Refactor, semantisch identisch). Neue Funktion daneben:

```ts
// src/lib/audit-log-cleanup.ts
export async function cleanupExpiredAuditLogs(payload: Payload): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const result = await payload.delete({
    collection: 'audit-logs',
    where: { createdAt: { less_than: cutoff.toISOString() } },
    overrideAccess: true,
  })
  const deletedCount = result.docs?.length ?? 0

  // Meta-Event auch bei deletedCount=0 (täglicher Heartbeat)
  await writeAuditLog(payload, {
    eventType: 'audit.cleanup.run',
    metadata: { deletedCount, retentionDays: 90 },
  })

  return deletedCount
}
```

**Endpoint-Name bleibt stabil** — kein Breaking-Change in `vercel.json`.

**Reihenfolge sequenziell** (Payload-Connection-Pool — keine parallele Bulk-Delete-Last).

**Failure-Verhalten:**
- Submissions-Cleanup wirft → Audit-Cleanup läuft nicht, Cron rotiert morgen. Bestehende V1.7-Logik unverändert.
- Audit-Cleanup wirft → in Cron-Response sichtbar via HTTP 500.
- `audit.cleanup.run`-Event-Write failt → silent (Helper).

**Skalen-Sorge:** bei niedrigem User-Stand <1000 Zeilen/Tag erwartbar, Bulk-Delete <1s. Vercel-Hobby-Function-Timeout (10s) hat Reserve. Inline-Kommentar im Cleanup-Code: bei `deletedCount > 50_000` zu Chunked-Delete migrieren.

### Datenschutzerklärung-Update

**Zwei Änderungen in `src/components/DatenschutzSections.tsx`** (Pfad bei T1 verifizieren):

**1) Neue Zeile in der Aufbewahrungs-Tabelle:**

| Daten | Aufbewahrung | Rechtsgrundlage | Mechanik |
|---|---|---|---|
| Audit-Log (Sicherheits- und Kontoverwaltungs-Ereignisse) | 90 Tage | Art. 6(1)(f) Sicherheits-Forensik + Art. 5(2) Rechenschaftspflicht | täglicher Cleanup-Cron |

**2) Neue Custom-Section „Sicherheits- und Kontoverwaltungs-Protokoll"** (eingefügt nach der bestehenden Login-/Auth-Sektion):

> **Was wir bei Anmeldevorgängen protokollieren:** Zeitpunkt, Erfolg oder Fehlschlag (mit Grund-Kategorie wie „Passwort falsch" oder „Konto deaktiviert"), die eingegebene Email-Adresse (auch wenn kein Konto mit dieser Adresse existiert), eine pseudonymisierte Form Ihrer IP-Adresse (SHA-256-Hash mit serverseitigem Geheimschlüssel — nicht zurückrechenbar) sowie den übertragenen Browser-Kennzeichner (User-Agent).
>
> **Was wir bei kontoverwaltenden Aktionen protokollieren:** Bei Rollenänderungen, Kontodeaktivierungen, Konto-Löschvorgängen, versendeten und angenommenen Einladungen sowie Passwort-Zurücksetzungen halten wir fest, welcher Account die Aktion ausgelöst hat und welcher Account betroffen war.
>
> **Aufbewahrung und Rechtsgrundlage:** Diese Protokoll-Einträge werden 90 Tage gespeichert und anschließend täglich automatisch gelöscht. Rechtsgrundlage ist unser berechtigtes Interesse an der Abwehr unbefugter Zugriffe und der Nachweisbarkeit kontoverwaltender Vorgänge (Art. 6 Abs. 1 lit. f DSGVO; Art. 5 Abs. 2 DSGVO).
>
> **Hinweis zur Account-Löschung:** Wenn Sie Ihr Konto löschen, werden Ihre personenbezogenen Daten in den Hauptdatensätzen anonymisiert. Email-Schnappschüsse, die zum Zeitpunkt eines Protokoll-Eintrags gespeichert wurden, bleiben in der Protokoll-Tabelle für die verbleibende Restdauer (höchstens 90 Tage ab Eintrags-Zeitpunkt) erhalten. Diese Ausnahme stützt sich auf Art. 17 Abs. 3 lit. b DSGVO (Erfüllung rechtlicher Aufzeichnungspflichten zur Sicherheit der Verarbeitung).

**Interne Begleitdoku:** `docs/legal/audit-log-policy.md` (~30 Zeilen), Companion zum Right-to-Erasure-Runbook aus Sub-C2. Inhalt: was geloggt wird, wer Zugriff hat, wie Cleanup läuft, wo `AUDIT_IP_HASH_SECRET` liegt, was bei Secret-Rotation zu beachten ist.

### Migration

Eine neue Migration: `src/migrations/<timestamp>_audit_logs.ts`

**ID-Typ-Wahl:** PflegeAtlas nutzt durchgängig **`integer` mit Serial-Sequence** (Payload-Default, siehe `src/migrations/20260605_140707_init.ts`). Audit-Logs folgen demselben Pattern — keine UUIDs, FK-Typen müssen `integer` matchen.

Skeleton (zur Orientierung — finale SQL kommt aus `pnpm payload migrate:create audit_logs` nach Collection-Definition):

```sql
CREATE TABLE audit_logs (
  id integer PRIMARY KEY,
  created_at timestamp(3) with time zone NOT NULL DEFAULT now(),
  updated_at timestamp(3) with time zone NOT NULL DEFAULT now(),
  event_type character varying NOT NULL,
  actor_user_id integer,
  actor_email character varying,
  subject_user_id integer,
  subject_email character varying,
  metadata jsonb,
  ip_hash character varying(64),
  user_agent character varying(200)
);
CREATE SEQUENCE audit_logs_id_seq OWNED BY audit_logs.id;
ALTER TABLE audit_logs ALTER COLUMN id SET DEFAULT nextval('audit_logs_id_seq');
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_user_id_users_id_fk
  FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_subject_user_id_users_id_fk
  FOREIGN KEY (subject_user_id) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);
CREATE INDEX audit_logs_event_type_idx ON audit_logs(event_type);
CREATE INDEX audit_logs_actor_user_id_idx ON audit_logs(actor_user_id);
CREATE INDEX audit_logs_subject_user_id_idx ON audit_logs(subject_user_id);
```

**Workflow:** Collection in `src/collections/AuditLogs.ts` definieren, in `payload.config.ts` registrieren, `pnpm payload migrate:create audit_logs` ausführen, generierte SQL gegen obiges Soll-Schema vergleichen, FK-Naming verifizieren, committen.

**FK-Naming-Konsistenz:** V1.7.1 (PR #32) hat alle FKs auf `<table>_<col>_<ref_table>_<ref_col>_fk`-Pattern normalisiert. Skeleton oben folgt dem schon; Payload-Generator sollte das automatisch produzieren. Falls nicht, manuell anpassen.

**Idempotenz:** Migration läuft gegen leere DB (V1.2-Lesson). `CREATE TABLE` ist nicht idempotent — Payload-Migration-Tracking sorgt für genau-einmal-Ausführung.

**`jsonb`:** binär, indexierbar — Postgres-Standard für strukturierte Felder.

**`ON DELETE SET NULL`:** kritisch für `account.erasure.runbook` Stage `hard_delete`-Pfad. Wenn ein User-Row jemals via manuellem psql-DELETE entfernt wird (Runbook Section 6), bleiben die Audit-Einträge stehen mit `actor_user_id`/`subject_user_id = NULL` und Email-Snapshot intakt.

## Touch-Liste

| Datei | Änderung |
|---|---|
| `src/collections/AuditLogs.ts` | **Neu.** Payload-Collection-Definition. |
| `src/payload.config.ts` | **Modify.** Collection-Registrierung. |
| `src/migrations/<timestamp>_audit_logs.ts` | **Neu.** Table + 4 Indizes + 2 FKs. |
| `src/lib/audit-log.ts` | **Neu.** Helper-API (`writeAuditLog`, `hashIp`, `truncateUserAgent`, Types). |
| `src/lib/audit-log-cleanup.ts` | **Neu.** `cleanupExpiredAuditLogs()` + Meta-Event-Write. |
| `src/lib/auth.ts` | **Modify.** 4 Trigger-Sites: `loginAction` (success+failure), `requestPasswordResetAction`, `resetPasswordAction`, `acceptInvitationAction`. Ersetzt `console.warn` Z. 134. Plus `extractLoginContext`-Helper inline. |
| `src/lib/user-soft-delete.ts` oder `deleteOwnAccountAction`-Site | **Modify.** `account.soft_delete.self`-Trigger einbauen. |
| `src/collections/Users.ts` | **Modify.** `afterChange` Hook erweitern für `role.change`, `account.disable`, `invitation.create`, `email.change.admin`. |
| `app/api/cron/<bestehender-name>/route.ts` | **Modify.** Submissions-Cleanup in Funktion extrahieren, Audit-Cleanup-Call hinzufügen, beide Counts in Response. |
| `src/lib/<exportOwnDataAction-Site>` | **Modify.** Audit-Log-Block im Export-JSON ergänzen. |
| `src/components/DatenschutzSections.tsx` | **Modify.** Neue Tabellen-Zeile + neue Custom-Section. |
| `scripts/right-to-erasure.ts` | **Modify.** Am Ende: `writeAuditLog({ eventType: 'account.erasure.runbook', metadata: { stage: 'anonymize', method: 'runbook_script' }, ... })`. Sub-C2-Audit-Snapshot in stdout bleibt unverändert (User-facing Bestätigung). |
| `docs/legal/audit-log-policy.md` | **Neu.** Interne Policy-Doku ~30 Zeilen. |
| `docs/legal/right-to-erasure-runbook.md` | **Modify.** Section 7 aktualisieren: Audit-Log existiert jetzt, statt 1Password-Notiz greift automatischer Eintrag. |
| `.env.example` | **Modify.** `AUDIT_IP_HASH_SECRET=` Zeile. |
| `tests/unit/audit-log.test.ts` | **Neu.** Helper-Unit-Tests. |
| `tests/unit/audit-log-cleanup.test.ts` | **Neu.** Cleanup-Logic-Unit-Tests. |
| `tests/integration/audit-log-triggers.test.ts` | **Neu.** 12 Integration-Tests (einer pro Event-Typ). |
| `tests/integration/audit-log-export.test.ts` | **Neu.** Export-Erweiterungs-Test. |
| `vitest.setup.ts` | **Modify.** `AUDIT_IP_HASH_SECRET=test-secret-value` setzen. |

## Tests

Coverage-Ziel: **jeder der 12 Event-Typen** hat einen Integration-Test, der die geschriebene Audit-Zeile auf die korrekte Shape verifiziert. Das ist die Hauptabsicherung gegen Silent-Failures aus Failure-Mode b.

**Unit-Tests** (`tests/unit/audit-log.test.ts`):
1. `hashIp()` deterministisch: gleiche IP + gleiches Secret → gleicher Hash
2. `hashIp()` secret-bound: gleiche IP + anderes Secret → anderer Hash
3. `hashIp()` Format: 64-Zeichen-Hex-String
4. `hashIp()` ohne Secret: gibt leeren String zurück, `console.error` getriggert
5. `truncateUserAgent()` kappt auf 200 Zeichen, gibt `null` für `null/undefined`
6. `writeAuditLog()` Failure-Swallowing: gemockter `payload.create()` wirft → Helper resolved ohne throw, `console.error` getriggert
7. `extractLoginContext()` Header-Parsing: `x-forwarded-for` (mit Komma-Liste) > `x-vercel-forwarded-for` > `x-real-ip` > `null`

**Unit-Tests** (`tests/unit/audit-log-cleanup.test.ts`):
8. Cutoff-Berechnung: 90 Tage Subtraktion korrekt
9. Meta-Event `audit.cleanup.run` wird auch bei `deletedCount=0` geschrieben (täglicher Heartbeat)
10. Bei `payload.delete()`-Fehler: Cleanup-Funktion wirft (kein Silent — Cron-Sichtbarkeit gewollt; nur der nachfolgende Meta-Event-Write ist silent)

**Integration-Tests** (`tests/integration/audit-log-triggers.test.ts`, ~12 Tests):
- Pro Event-Typ: triggert die echte Server-Action / Hook → liest aus `payload.find({ collection: 'audit-logs', ... })` → asserts auf `eventType`, `actorUserId`, `subjectUserId`, `metadata.*`, ggf. `ipHash`/`userAgent`
- Beispiel `login.success`: `loginAction({ email, password, request })` mit valider Credential → genau ein neuer Audit-Eintrag, `actorUserId: <user.id>`, `actorEmail: <user.email>`, `ipHash` non-null, `userAgent` non-null
- Beispiel `login.failure` Bucket `unknown`: `loginAction` mit nicht-existenter Email → `actorUserId: null`, `metadata.bucket: 'unknown'`, `metadata.emailAttempt: <input>`
- Beispiel `role.change`: `payload.update({ collection: 'users', id, data: { role: 'editor' } })` als Admin → Hook feuert → Audit-Eintrag mit `oldRole`, `newRole`
- Beispiel `account.erasure.runbook`: direkter Helper-Call (Script-Pfad) → Audit-Eintrag mit `metadata.stage: 'anonymize'`, `metadata.method: 'runbook_script'`

**Integration-Test** (`tests/integration/audit-log-export.test.ts`):
- User mit ~5 Audit-Einträgen ruft `exportOwnDataAction` auf → Export enthält Audit-Block mit korrekten Einträgen, NICHT mit fremden Audit-Einträgen, NICHT mit `ipHash`/`userAgent`
- OR-Bedingung verifizieren (`actor=me OR subject=me`)
- Bei >10.000 eigenen Audit-Einträgen: Hard-Cap greift (analog Sub-C1-Test)

**Test-Infrastruktur:**
- Test-Datenbank kriegt im Setup automatisch die neue Migration (gegen leere DB lauffähig)
- Test-ENV-Var `AUDIT_IP_HASH_SECRET=test-secret-value` in `vitest.setup.ts`
- Audit-Cleanup-Tests seeden Records mit explizit gesetztem `created_at` via Raw-SQL (`UPDATE audit_logs SET created_at = now() - interval '91 days' WHERE id = ...`), weil Payload-`create` immer `now()` setzt und `vi.useFakeTimers()` Postgres-`now()` nicht beeinflusst
- Vitest-Config bleibt `singleFork` (V1.7.1-Lesson)
- Cleanup-Pattern pro Test analog Sub-C1/C2 (try/finally)

**Baseline:** ~334+ Tests grün. Erwarteter Zuwachs: **+20-25 Tests**. Bestehende Tests bleiben unverändert.

## Out of Scope

- **Self-View-UI für Audit-Events** (z.B. `/mein-bereich/anmeldungen` mit „Recent activity"-Liste) — V1.8-Account-Security-Feature, separat brainstormen
- **Mail-Benachrichtigung bei verdächtigen Logins** — V1.8 / V2
- **Content-Audit** (Articles publish/unpublish, Submission-Reviewer-Wechsel) — V1.5 GitHub-Sync deckt Content-Changes ab
- **Self-Service-Mutationen-Logging** (Profile-Update, Avatar-Upload) — Lärm ohne Forensik-Mehrwert; Avatar-Hard-Delete ist über Sub-C2-Runbook-Snapshot dokumentiert
- **Suche/Filter über Admin-UI hinaus** — Payload-Listenview reicht für 99 % der Forensik-Fragen
- **Externe Audit-Sinks** (Axiom, Better Stack, Logflare) — Phase-2-Backlog
- **Sentry-Integration für Audit-Write-Failures** — Phase-2-Backlog (heute: `console.error` in Vercel-Logs)
- **`emailAttempt`-Hashing in `login.failure`** — heute Klartext für Brute-Force-Korrelation; bei künftiger Privacy-Sorge ergänzbar
- **Rate-Limiting in `loginAction` vor Audit-Write** — V1.8-Kandidat falls Bot-Sturm aktuell wird
- **Chunked-Delete im Cleanup-Cron** — heute nicht nötig, Inline-Kommentar für 50k-Schwelle
- **pg_cron auf Postgres-Ebene** — Neon Free unterstützt nicht; nicht relevant

## Risiken + Mitigation

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| `AUDIT_IP_HASH_SECRET` geht verloren oder rotiert → Hash-Korrelation über die Rotation hinweg bricht | gering | mittel (Forensik-Werk-Verlust für Window) | Secret in 1Password, in V1.7-Setup-Doc dokumentieren; keine Rotation während aktiver Vorfall-Untersuchung; `audit-log-policy.md` warnt davor |
| Bot produziert Tausende `login.failure`-Events/Sekunde → Audit-Tabelle wächst explosionsartig | gering-mittel | hoch (Neon-Free-Quota-Sprengung, Cron-Cleanup nur täglich) | Folge-Backlog: Rate-Limit in `loginAction` *vor* Audit-Write (V1.8). Heute: monitor via Vercel-Logs |
| `emailAttempt` in `login.failure unknown` enthüllt im Falle eines DB-Leaks Nicht-User-Emails | gering | mittel (Privacy-Leak Dritter) | 90-Tage-Retention deckt ab; Datenschutzerklärung deklariert explizit; ggf. später `emailAttempt` zusätzlich hashen |
| Hook-Cascade: `users.afterChange` triggert Audit-Write, der unbedacht weitere Hooks auslöst | gering | mittel (Endlosschleife) | Helper schreibt nur in `audit-logs`-Collection, liest nichts aus `users` — alle nötigen Werte aus `req.user`/`doc`/`previousDoc` reingereicht; `audit-logs`-Collection hat keine eigenen Hooks |
| Cron-Cleanup-Timeout bei sehr großer Audit-Tabelle (>100k Zeilen) | gering | mittel (Cleanup läuft nicht durch, Retention verzögert) | Heute nicht relevant (Skala niedrig). Inline-Kommentar: bei `deletedCount > 50_000` zu Chunked-Delete migrieren |
| Datenschutzerklärung-Update wird vergessen oder zeitversetzt deployed → Sammlung läuft ohne juristische Grundlage | gering | hoch (DSGVO-Verstoß) | Pflicht-Bestandteil derselben PR wie Code (Release-Gate); Code-Review-Checkliste |
| Account-Disable-Mechanismus existiert in V1.6 evtl. nicht → Event #8 lässt sich nicht triggern | mittel | gering (Event entfällt) | T1-Spike: Disable-Feld im `users`-Schema verifizieren. Falls nicht vorhanden, Event #8 aus Plan streichen oder als „Feature-gekoppelt" markieren |
| Login-Header `x-forwarded-for` gespoofed (Upstream-Forwarding inkonsistent) | mittel | gering (Hash-Korrelation unreliable für bestimmte Angreifer) | Akzeptiert. `x-vercel-forwarded-for` als bevorzugter Vercel-Header in `extractLoginContext`-Fallback-Kette |

## Release-Gate / Akzeptanz-Kriterien

- [ ] Collection `audit-logs` in `src/collections/AuditLogs.ts` mit korrektem Access-Control (Admin-only read, kein direkter create/update/delete)
- [ ] Migration committed, läuft gegen leere DB; FK-Naming entspricht V1.7.1-Pattern
- [ ] `writeAuditLog` Helper in `src/lib/audit-log.ts` exportiert, mit Try/Catch (niemals throws)
- [ ] Alle 12 Trigger-Punkte verkabelt (Tabelle in „Trigger-Punkte"); Event #8 ggf. nach T1-Spike entfernt/angepasst
- [ ] `extractLoginContext` Header-Fallback-Kette korrekt (`x-forwarded-for` → `x-vercel-forwarded-for` → `x-real-ip` → null)
- [ ] `exportOwnDataAction` enthält Audit-Block, paginiert, kein `ipHash`/`userAgent`
- [ ] Cleanup-Cron erweitert, beide Counts in HTTP-Response, Meta-Event auch bei `deletedCount=0`
- [ ] `DatenschutzSections.tsx`: Tabellen-Zeile + Custom-Section eingebaut
- [ ] `docs/legal/audit-log-policy.md` committed
- [ ] `docs/legal/right-to-erasure-runbook.md` Section 7 aktualisiert
- [ ] `.env.example` aktualisiert
- [ ] `AUDIT_IP_HASH_SECRET` in Vercel-Production-Env gesetzt (1Password-Verweis)
- [ ] 7 Unit-Tests + 3 Cleanup-Units + ~12 Trigger-Integration-Tests + 1 Export-Integration-Test grün
- [ ] `pnpm exec tsc --noEmit` grün
- [ ] `pnpm lint` 0 errors
- [ ] Baseline ~334+ Tests bleibt grün
- [ ] PR mit Plan-Deviations (falls vorhanden) im Body
- [ ] Memory-Update: Sub-C-Track abgeschlossen, V1.6-Defers (Audit-Log-Collection) eingelöst

## Implementation-Workflow

Subagent-Driven angemessen (~700-900 Zeilen Production-Code + ~600 Zeilen Tests + Doku). Tasks-Schnitt voraussichtlich:

- T1: Spike — Verifikation (Account-Disable-Feld, Cron-Endpoint-Name, `fetchAllPaginated`-Helper-Status, Vercel-Header), `.env.example`, Setup `AUDIT_IP_HASH_SECRET` lokal
- T2: Collection + Migration + Access-Control
- T3: `writeAuditLog` Helper + `hashIp` + `truncateUserAgent` + Unit-Tests
- T4: 4 Login-/Reset-Trigger-Sites in `auth.ts` + Integration-Tests
- T5: `users` `afterChange` Hook-Erweiterung (4 Events) + Integration-Tests
- T6: `account.soft_delete.self` + `invitation.accept` Trigger + Integration-Tests
- T7: Cleanup-Cron-Erweiterung + Meta-Event + Unit-Tests
- T8: Export-Erweiterung + Integration-Test
- T9: `right-to-erasure.ts`-Script-Erweiterung für `account.erasure.runbook`
- T10: `DatenschutzSections.tsx` + `audit-log-policy.md` + Runbook-Update
- T11: PR + Merge
