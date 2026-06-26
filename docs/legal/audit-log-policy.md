# PflegeAtlas — Audit-Log-Policy (intern)

**Stand:** 2026-06-26 (Sub-C3)
**Companion zu:** `docs/legal/right-to-erasure-runbook.md`

## Zweck

Interne Policy für den Umgang mit der `audit-logs`-Collection. Die public-user-facing
Erklärung steht in der Datenschutz&shy;erklärung (`src/components/DatenschutzSections.tsx`,
Section „Sicherheits- und Kontoverwaltungs-Protokoll").

## Was wird geloggt

12 Event-Typen, vollständig dokumentiert in der Spec:
`docs/superpowers/specs/2026-06-25-pflegeatlas-audit-log-sub-c3-design.md`,
Section „Die 12 Event-Typen".

Kurz-Übersicht:

| Kategorie | Events |
|---|---|
| Authentifizierung | `login.success`, `login.failure` |
| Passwort-Lifecycle | `password.reset.request`, `password.reset.complete` |
| Einladungen | `invitation.create`, `invitation.accept` |
| Kontoverwaltung | `role.change`, `account.disable`, `email.change.admin` |
| Selbst-Aktion | `account.soft_delete.self` |
| Runbook | `account.erasure.runbook` |
| System | `audit.cleanup.run` (täglicher Heartbeat) |

## Wer hat Zugriff

- **Lesen:** nur Accounts mit `role: 'admin'` via Payload-Admin-UI unter
  `/admin/collections/audit-logs`.
- **Schreiben:** ausschließlich server-side via `writeAuditLog()` Helper aus
  `src/lib/audit-log.ts` mit `overrideAccess: true`. Kein REST-/GraphQL-Zugriff
  für authenticated Users.
- **Update:** niemand. Einträge sind immutable.
- **Löschen:** nur durch den Cleanup-Cron via `overrideAccess: true`.
- **Self-Read:** User können ihre eigenen Audit-Einträge über den Datenexport
  unter `/mein-bereich` herunterladen (Art. 15 DSGVO). `ipHash` und `userAgent`
  werden NICHT exportiert — admin-only Forensik-Daten.

## Retention

- 90 Tage ab `createdAt`.
- Täglicher Cleanup via `cleanupExpiredAuditLogs()` in `src/lib/audit-log-cleanup.ts`,
  piggybacked auf den V1.7-Cron `/api/cron/cleanup-submissions` (Vercel-Hobby
  hat nur 2 Cron-Slots; einer war bereits durch Submissions-Cleanup belegt).
- Cleanup schreibt selbst einen `audit.cleanup.run`-Meta-Event — täglicher
  Heartbeat. Wenn das Event 2+ Tage nicht erscheint, läuft der Cron nicht
  (Frühwarnung).

## `AUDIT_IP_HASH_SECRET`

- Server-seitiges Secret für SHA-256-Hashing der IP bei Login-Events.
- **Production:** in Vercel-ENV gesetzt, gespiegelt in 1Password.
- **Lokal:** in `.env` gesetzt (`.env.example` zeigt das Pattern).
- **Tests:** überschrieben in `tests/setup.ts` + `tests/setup.node.ts` mit
  `'test-secret-value-fixed-for-determinism'` für reproduzierbare Hashes.
- **Niemals rotieren** während aktiver Forensik-Untersuchung — bricht
  Hash-Korrelation über die Rotation hinweg. Nach Vorfall-Abschluss plus
  90 Tage Karenz ist Rotation sicher (alte Logs sind dann ohnehin abgelaufen).

## Forensik-Workflow

1. **Verdachts-Trigger** (z.B. Support-Ticket „mein Account verhält sich seltsam"):
   im Admin-UI nach `actorEmail` filtern, `createdAt` absteigend sortieren.
2. **Brute-Force-Korrelation:** nach gleichem `ipHash` filtern; zählt vorgängige
   `login.failure`-Events auf andere Email-Adressen.
3. **Admin-Aktions-Audit:** nach `eventType=role.change` oder `account.disable`
   filtern; `actorEmail` zeigt den Admin.

## Beziehung zu DSGVO

- **Art. 5 Abs. 2 (Rechenschaftspflicht):** das Audit-Log belegt, dass
  Anonymisierung + Hard-Delete-Vorgänge tatsächlich stattgefunden haben.
- **Art. 6 Abs. 1 lit. f (Berechtigtes Interesse):** Sicherheits-Monitoring +
  Missbrauchsabwehr rechtfertigen die Speicherung der Login-Versuchsdaten und
  pseudonymisierten IP.
- **Art. 15 (Auskunftsrecht):** User exportieren ihre Audit-Einträge via
  `/mein-bereich`-Datenexport — keine manuelle Admin-Arbeit nötig.
- **Art. 17 Abs. 3 lit. b (Ausnahme vom Löschrecht):** Email-Snapshots
  überleben Account-Anonymisierung für die verbleibende Retention-Zeit.
  Public-Erklärung dafür steht in der Datenschutz&shy;erklärung.

## Hard-Delete-Sonderfall

Echtes psql-Hard-Delete laut `right-to-erasure-runbook.md` Section 6 läuft
außerhalb der App und schreibt **keinen Auto-Audit-Eintrag**. Wenn die manuelle
Stufe angewendet wird, soll der ausführende Admin **vor** dem psql-DELETE
manuell einen Eintrag setzen:

```ts
import { writeAuditLog } from '@/lib/audit-log';
import { getPayload } from 'payload';
import config from '@/payload.config';

const payload = await getPayload({ config });
await writeAuditLog(payload, {
  eventType: 'account.erasure.runbook',
  actor: <admin-id>,
  actorEmail: '<admin-email>',
  subject: <user-id>,           // BEVOR Delete läuft, danach wird subjectUserId NULL (ON DELETE SET NULL)
  subjectEmail: '<user-email>', // Snapshot überlebt
  metadata: { stage: 'hard_delete', method: 'manual_psql', notes: '<begründung>' },
});
```

Nach dem `DELETE FROM users WHERE id=<user-id>` zeigt der Audit-Eintrag dann
`subject=null`, aber der Snapshot bleibt zuordbar. Der Eintrag fällt nach
spätestens 90 Tagen durch die Retention.

## Skalen-Sorge

Bei niedrigem User-Stand sind <1000 Audit-Rows/Tag erwartbar. Bulk-Delete
läuft in <1s. Wenn das Volumen ungewöhnlich wächst (z.B. Bot-Sturm auf den
Login-Endpoint), kann der Cleanup-Cron innerhalb des Vercel-Hobby-Timeouts
(10s) an seine Grenzen kommen. Schwelle: bei `deletedCount > 50_000` zu
Chunked-Delete migrieren (TODO-Kommentar im `audit-log-cleanup.ts`).
