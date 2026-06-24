# PflegeAtlas — Sub-C2 Avatar-Hard-Delete + Right-to-Erasure-Runbook

**Datum:** 2026-06-24
**Status:** Spec
**Vorgänger:** Sub-C1 (PR #34, `79f8b48`) — Articles-Export-Pagination.
**Track:** Sub-C (DSGVO-Code-Härtung), zweites von drei Mini-Plans.

## Problem

Zwei zusammenhängende DSGVO-Lücken:

**1. Spec-Drift zwischen Code und Public-Promise.**
- V1.6-Spec versprach (Z. 411): *„Avatar wird hard-gelöscht (Media-Record + File)"*
- `src/components/DatenschutzSections.tsx` Z. 99-106 verspricht User: *„Beim Löschen eines Beiträger:innen-Kontos werden die personenbezogenen Daten (Name, E-Mail, Profilbild) entfernt bzw. anonymisiert"*
- Code-Realität in `src/lib/user-soft-delete.ts:21`: `anonymizeUserPatch()` setzt nur `avatar: null` (Relation). Media-Doc + R2-Objekt bleiben liegen.
- Zusätzlich: kein Hard-Delete bei Profile-Avatar-Removal oder -Replacement — Orphan-Files akkumulieren in R2 mit der Zeit.

**2. Kein dokumentierter Pfad für echte Art.-17-Anfragen.**
- V1.6-Spec sagt: *„Hard-Delete passiert manuell durch Admin, falls Anfrage kommt."* — aber keinerlei Runbook existiert, was die manuelle Prozedur ist, welche FKs zu beachten sind, welche DSGVO-Frist greift.

## Entscheidungen (Brainstorm 2026-06-24)

| Frage | Entscheidung |
|---|---|
| Scope: was zählt als Hard-Delete? | **Variante C.** Nur Avatar im Self-Service (+ manueller Admin-Pfad für komplette Erasure-Anfragen via Runbook). Article-Image und andere uploaded Media bleiben — `article_image` gehört semantisch zum Article (CC-BY-SA, „dauerhaft öffentlich"). |
| Trigger für Avatar-Hard-Delete? | **Variante C.** Drei Pfade: (a) Account-Delete, (b) Avatar-Removal im Profile (`avatar: id → null`), (c) Avatar-Replacement im Profile (`avatar: oldId → newId`). Konsistente Semantik, keine Orphan-Akkumulation in R2. |
| Failure-Mode bei R2-/Media-Delete-Fehler? | **Variante B.** Fehler schlucken + `console.warn`. DSGVO-User-Recht (Account-Delete läuft durch) hat Vorrang über interne Storage-Hygiene. Orphan-File ist manuell via Admin-UI aufräumbar. |
| Code-Struktur? | **Variante B.** Helper `hardDeleteAvatar` in `src/lib/avatar-cleanup.ts`, drei Action-Pfade rufen explizit auf. KEIN Payload-Hook (Hook würde auch bei Admin-Updates greifen, wo Admin evtl. die Media-Doc behalten will). |
| Admin-Runbook-Format? | **Variante B.** MD-Runbook (`docs/legal/right-to-erasure-runbook.md`) PLUS Helper-Script (`scripts/right-to-erasure.{sh,ts}`) analog zu `seed-initial-admin.{sh,ts}`. |

## Architektur

### Helper

Neuer Helper in `src/lib/avatar-cleanup.ts`:

```ts
import type { Payload } from 'payload';

export interface HardDeleteAvatarResult {
  deleted: boolean;
  error?: string;
}

export type HardDeleteAvatarTrigger = 'account-delete' | 'profile-update';

export async function hardDeleteAvatar(
  payload: Payload,
  oldMediaId: number | null | undefined,
  context: { userId: number; trigger: HardDeleteAvatarTrigger },
): Promise<HardDeleteAvatarResult>;
```

**Verhalten:**
- `oldMediaId == null/undefined` → silent no-op, returnt `{ deleted: false }` ohne Error, **kein warn-Log**
- Erfolg → `payload.delete({ collection: 'media', id: oldMediaId })`, returnt `{ deleted: true }`
- Payload-NotFound (Media-Doc gibt's nicht mehr) → behandeln wie Erfolg, returnt `{ deleted: false }` ohne warn-Log (Race-Condition / bereits gelöscht = idempotent)
- Sonstige Fehler (R2-Outage, Permission, Netzwerk) → strukturierter `console.warn` mit `userId`, `oldMediaId`, `trigger`, `error-message`. Returnt `{ deleted: false, error }`. **Wirft nicht.** Caller schluckt per Default.

**R2-Cleanup automatisch:** `payload.delete` auf `media`-Collection triggert s3Storage-Plugin-After-Delete-Hook, der das R2-Objekt mit entfernt. Keine separate R2-API-Call nötig.

### Action-Touches

**`deleteOwnAccountAction`** in `src/lib/auth.ts:381-405`:
- Vor dem `payload.update` mit `anonymizeUserPatch`: einen `payload.findByID`-Lookup auf den User, um aktuelles `avatar` zu lesen, dann `hardDeleteAvatar(payload, user.avatar, { userId, trigger: 'account-delete' })`.
- `anonymizeUserPatch` bleibt unverändert (setzt weiterhin `avatar: null` — defensive Doppel-Belt-Suspenders).

**`updateOwnProfileAction`** in `src/lib/auth.ts:351-379`:
- Wenn `whitelisted.avatar !== undefined`: Vor dem `payload.update`, einen `payload.findByID`-Lookup auf den User, um aktuelles `avatar` zu lesen. Wenn alt vorhanden UND (neu = null ODER neu ≠ alt) → `hardDeleteAvatar(payload, oldAvatarId, { userId, trigger: 'profile-update' })`.
- Wenn neuer und alter Avatar identisch sind (z.B. nur `displayName` ändert sich) → nichts tun.

### Admin-Runbook

Neue Datei `docs/legal/right-to-erasure-runbook.md` (~100 Zeilen MD), Sections:

1. **Wann anwenden** — Verweis auf Self-Service als Default; Runbook nur für echte Art.-17-Anfragen die über Anonymisierung hinausgehen
2. **Identitätsprüfung** — Mail-Adresse muss mit Account-Email matchen, sonst Rückbestätigung anfordern
3. **Scope-Klärung mit User** — was genau soll weg? Anonymisierung reicht oder echtes Hard-Delete? CC-BY-SA-Lizenz-Konflikt erklären (Article-Authorship-Erhaltung als Lizenz-Pflicht-Hinweis)
4. **DSGVO-Frist** — 1 Monat ab Eingang (Art. 12 Abs. 3), bei Komplexität +2 Monate mit Hinweis-Mail
5. **Schritte bei reiner Anonymisierung** — Verweis aufs Script (Section 4 unten)
6. **Schritte bei echtem Hard-Delete** — manuelle psql-Snippets für FK-Cascade: Articles.authors, Submissions.submittedBy/currentReviewer, Media.uploadedBy, Users.invitedBy. Backup-Hinweis (Neon Point-in-Time bleibt 7 Tage). GitHub-Mirror-Hinweis (Articles bleiben dort öffentlich, Art. 17 Abs. 3 lit. a — Recht auf freie Meinungsäußerung).
7. **Bestätigung an User** — Mail-Template-Skizze; Vermerk in Audit-Log (sobald Sub-C3 existiert — bis dahin: handschriftliche Notiz in 1Password-Vault).

### Admin-Script

Neue Dateien `scripts/right-to-erasure.sh` + `scripts/right-to-erasure.ts` (analog zu `scripts/seed-initial-admin.{sh,ts}`):

**`right-to-erasure.sh`** — Bash-Wrapper, prüft ENVs (`DATABASE_URI`, `R2_*`), führt `npx tsx scripts/right-to-erasure.ts "$@"`.

**`right-to-erasure.ts`** — Payload-Local-API-Skript:
- CLI: `right-to-erasure user@email.de`
- Lookup: `payload.find({ collection: 'users', where: { email: { equals: arg } } })`, abort wenn nicht gefunden
- Vorschau-Block in stdout: User-Felder (ohne sensitive) + Avatar-Media-ID + Counts (Submissions wo `submittedBy`, Articles wo `authors` enthält user.id)
- Confirmation-Prompt: `Type "ERASE <email>" to confirm:` — exakter String-Match nötig
- On confirm: identischer Code-Pfad zu `deleteOwnAccountAction` (`hardDeleteAvatar` + `payload.update` mit `anonymizeUserPatch`). **Kein echtes Hard-Delete** der User-Row oder der Authorship-FKs — das bleibt manuell (siehe Runbook Section 6), weil zu viele Edge-Cases.
- Audit-Snapshot in stdout am Ende: anonymisierte User-ID, Timestamp, gelöschte Avatar-Media-ID, betroffene Submissions/Articles-Counts. Admin kopiert das in Mail-Bestätigung an User + 1Password-Vault.

## Touch-Liste

| Datei | Änderung |
|---|---|
| `src/lib/avatar-cleanup.ts` | **Neu.** `hardDeleteAvatar` Helper. |
| `src/lib/auth.ts` | **Modify.** `deleteOwnAccountAction` (Z. 381-405) + `updateOwnProfileAction` (Z. 351-379): `hardDeleteAvatar`-Aufrufe einbauen. Import-Zeile ergänzen. |
| `tests/unit/avatar-cleanup.test.ts` | **Neu.** 4 Tests (siehe Tests-Abschnitt). |
| `tests/integration/avatar-hard-delete.test.ts` | **Neu.** 4 Integration-Tests. |
| `docs/legal/right-to-erasure-runbook.md` | **Neu.** Manuelles Runbook ~100 Zeilen. |
| `scripts/right-to-erasure.sh` | **Neu.** Bash-Wrapper. |
| `scripts/right-to-erasure.ts` | **Neu.** Payload-Local-API-Skript. |

`src/lib/user-soft-delete.ts` bleibt **unverändert** (`anonymizeUserPatch` setzt weiterhin `avatar: null` — wird vor dem Action-Update aufgerufen, defensive Doppelsicherheit gegen FK-Constraint-Issues).

## Tests

**Unit-Tests** (`tests/unit/avatar-cleanup.test.ts`, neu):

1. **`hardDeleteAvatar(null, ...)`** returnt `{ deleted: false }`, kein `payload.delete`-Call, kein warn-Log
2. **`hardDeleteAvatar(undefined, ...)`** identisches Verhalten zu 1
3. **`hardDeleteAvatar(42, ctx)` mit Mock-Payload-Success** returnt `{ deleted: true }`, `payload.delete` aufgerufen mit `{ collection: 'media', id: 42 }`
4. **`hardDeleteAvatar(42, ctx)` mit Mock-Payload-Reject** returnt `{ deleted: false, error }`, `console.warn` mit User-ID + Media-ID + Trigger getriggert (via `vi.spyOn(console, 'warn')`), kein re-throw

**Integration-Tests** (`tests/integration/avatar-hard-delete.test.ts`, neu):

5. **Account-Delete-Flow:** Seed: User + Media-Doc (`purpose: 'avatar', uploadedBy: user.id`) + User.avatar = mediaId. Action: `deleteOwnAccountAction('LÖSCHEN')`. Assertion: `payload.findByID({ collection: 'media', id })` wirft NotFound, User.disabled=true, User.email anonymisiert.
6. **Profile-Update Avatar-Removal:** Seed wie oben. Action: `updateOwnProfileAction({ avatar: null })`. Assertion: alte Media-Doc weg, User.avatar=null.
7. **Profile-Update Avatar-Replacement:** Seed User mit Avatar A. Upload Media B per `payload.create`. Action: `updateOwnProfileAction({ avatar: B.id })`. Assertion: A weg, B existiert, User.avatar = B.
8. **No-op-Pfad:** Seed User ohne Avatar. Action: `deleteOwnAccountAction('LÖSCHEN')`. Assertion: kein Media-Delete-Call, kein Error, User wie erwartet anonymisiert.

**Cleanup-Pattern:** Jeder Integration-Test räumt seine User+Media via `try/finally` direkt per `payload.db.pool.query` auf (Pattern aus Sub-C1 übernommen, falls Payload-Hooks crashen — z.B. wenn Media-Doc schon weg ist und User-Delete via Hook nochmal versucht).

**Bestehende Tests:** `tests/integration/auth-delete-own-account.test.ts` muss geprüft werden — falls Fixture-User ein Avatar haben, müssen Tests den neuen Hard-Delete-Pfad mit-asserten oder ein User-ohne-Avatar nutzen.

## Out of Scope

- **Sub-C3 Audit-Log:** keine Audit-Trail-Persistierung in Sub-C2; Runbook markiert das als „TODO Sub-C3"
- **Self-Service-Hard-Delete-UI:** kein neuer UI-Pfad in `/mein-bereich` — Avatar wird automatisch beim Profile-Update + Account-Delete weggeräumt
- **Orphan-Media-Cleanup-Cron:** keine Sweep-Logic für vorbestehende Orphan-Files; falls Self-Service-Pflug genug Orphans erzeugt hat in Prä-C2-Zeit, manueller Cleanup via Payload-Admin-UI
- **Avatar-Versioning:** kein History-Track der alten Avatare
- **Article-Image-Cleanup:** unverändert — `article_image`-Media gehört semantisch zum Article (CC-BY-SA, dauerhaft öffentlich)
- **Hook-basierte Variante:** explizit verworfen (Brainstorm-Variante C) — würde auch bei Admin-Updates greifen, was operativ unerwünscht ist
- **Echtes Hard-Delete via Script:** Script automatisiert nur Anonymisierungs-Pfad; echtes Hard-Delete bleibt manuell laut Runbook Section 6

## Risiken + Mitigation

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| R2-Permission-Konflikt: Self-Service-User darf nicht alle Media löschen | mittel | Hard-Delete schlägt fehl, Orphan bleibt | Media-Collection-Delete-Access erlaubt schon `uploadedBy: equals user.id` (Media.ts:50-54) — User darf sein eigenes Avatar löschen, Permission-Match passt. |
| `payload.delete` mit `req: { user }`-Auth wird gebraucht | gering | Permission-Denied unter Access-Control | Lokal-API hat `overrideAccess: true` per Default — kein Issue. Falls doch: `overrideAccess: true` explizit setzen. |
| Race-Condition zwei parallele Profile-Updates | gering | beide versuchen alten Avatar zu löschen → einer kriegt NotFound | NotFound von `payload.delete` als „schon weg" interpretieren = Erfolg-Equivalent. Helper schluckt. |
| Avatar zeigt auf bereits gelöschtes Media (DB-Inkonsistenz) | gering | NotFound beim find → unklare Branchentscheidung | Helper: NotFound = silent skip, kein warn |
| Test-Seed-Avatar generiert R2-Upload-Versuch unter Dev | gering | Lokaler Test versucht Upload zu Mock-S3-Endpoint, schlägt fehl | Dev hat keine R2-ENVs → `s3Storage`-Plugin nicht geladen → Payload nutzt lokales Filesystem als Fallback (V1.7-Pattern). Integration-Test seeded via `payload.create({ collection: 'media', data: { file: ... } })` mit minimalem File-Buffer. Wenn das zu komplex wird: Test-Helper `createAvatarFixture()` analog zu `createUserFixture`. |

## Release-Gate / Akzeptanz-Kriterien

- [ ] `hardDeleteAvatar` Helper in `src/lib/avatar-cleanup.ts` exportiert
- [ ] `deleteOwnAccountAction` ruft Helper VOR `payload.update` mit `anonymizeUserPatch`
- [ ] `updateOwnProfileAction` ruft Helper bei Avatar-Removal UND -Replacement
- [ ] 4 Unit-Tests + 4 Integration-Tests grün
- [ ] `pnpm exec tsc --noEmit` grün
- [ ] `pnpm lint` 0 errors
- [ ] `docs/legal/right-to-erasure-runbook.md` committed mit 7 Sections
- [ ] `scripts/right-to-erasure.{sh,ts}` committed, manuell smoke-getestet auf einem Test-User in Dev-DB
- [ ] PR mit Plan-Deviations (falls vorhanden) im Body
- [ ] Memory-Update + Backlog-Hinweis auf Sub-C3 Audit-Log

## Implementation-Workflow

Subagent-Driven-Driven angemessen (~500 Zeilen, ein neuer Helper + zwei Action-Touches + zwei Test-Files + Runbook + Script). Tasks-Schnitt voraussichtlich:
- T1: Helper + Unit-Tests
- T2: Action-Wiring (Account-Delete-Pfad) + 1 Integration-Test
- T3: Action-Wiring (Profile-Update-Pfade) + 2 Integration-Tests
- T4: No-op-Integration-Test + Voll-Run + Lint/tsc
- T5: Admin-Runbook MD
- T6: Admin-Script Bash + TS, manueller Smoke
- T7: PR + Merge
