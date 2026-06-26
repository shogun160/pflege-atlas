# Right-to-Erasure-Runbook (Art. 17 DSGVO)

**Stand:** 2026-06-24
**Adressaten:** Admins (Oliver, Christoph)
**Gilt für:** PflegeAtlas Phase 1 (Vercel + Neon + R2)

---

## 1. Wann anwenden

Self-Service deckt den Standardfall ab: User klickt in `/mein-bereich`
auf „Konto löschen" → Account wird anonymisiert (Name, E-Mail,
Profilbild weg; Beiträge bleiben als „Gelöschte:r Beitragende:r"
verlinkt). Avatar-Media-Doc + R2-File werden automatisch hart gelöscht
(Sub-C2).

Dieses Runbook gilt nur, wenn eine User-Anfrage per Mail über die
Self-Service-Anonymisierung hinausgeht — z.B. wenn explizit gefordert
wird, dass auch die Authorship-Verlinkung auf veröffentlichten Artikeln
entfernt werden soll (echtes Hard-Delete).

## 2. Identitätsprüfung

- Die Anfrage muss von der Account-E-Mail-Adresse kommen, die der User
  bei uns registriert hat.
- Bei Zweifel (z.B. Mail kommt von anderer Adresse, oder User behauptet,
  Account-Zugang verloren zu haben): Rückbestätigung anfordern. Z.B.
  Magic-Link an die Account-E-Mail senden mit Bestätigungs-Text.
- **Nicht ausreichen** als Identitätsbeweis: Display-Name, IP-Adresse,
  Beitrag-Inhalt.
- Bei begründetem Verdacht auf Identitätsmissbrauch: ablehnen mit
  Verweis auf §11 DSGVO (Anforderungen an Identifizierung).

## 3. Scope-Klärung mit User

Vor Ausführung mit User klären, was genau gelöscht werden soll. Drei
Stufen sind möglich:

**Stufe A: Anonymisierung (Self-Service-äquivalent)**
- Account → disabled + anonymisierter Name + Avatar weg.
- Beiträge bleiben unter „Gelöschte:r Beitragende:r" verlinkt.
- → Section 5.

**Stufe B: Anonymisierung + Authorship-Entfernung**
- Wie A, plus: User aus `Articles.authors` rauslöschen.
- CC-BY-SA-Lizenz-Konflikt: Lizenz erfordert Namensnennung der
  Autor:innen. Wenn User selbst die Nennung zurückzieht, ist
  „Gelöschte:r Beitragende:r" eine vertretbare Lösung — aber ein
  vollständiges Entfernen der Authorship würde die Lizenz brechen.
  **Mit User durchsprechen** und schriftlich (per Mail) bestätigen
  lassen, dass auf Namensnennung verzichtet wird.
- → Section 6.

**Stufe C: Vollständiges Hard-Delete (DB-Row)**
- Wie B, plus: User-Row, Submissions, alle FK-Verweise hart gelöscht.
- Praktisch oft NICHT möglich, weil veröffentlichte Articles per
  V1.5-GitHub-Sync schon auf GitHub gespiegelt sind („dauerhaft
  öffentlich, unwiderruflich"). Art. 17 Abs. 3 lit. a DSGVO greift
  hier (Recht auf freie Meinungsäußerung + öffentliches Interesse).
- **Mit User durchsprechen** dass GitHub-Mirror irreversibel ist.
- → Section 6 + manueller GitHub-Repo-Eingriff.

## 4. DSGVO-Frist

- 1 Monat ab Eingang der Anfrage (Art. 12 Abs. 3 DSGVO).
- Bei Komplexität / hohem Aufwand: +2 Monate, **muss aber innerhalb
  des ersten Monats schriftlich mit Begründung an User mitgeteilt**
  werden.
- Status der Anfrage protokollieren — Sub-C3-Audit-Log nimmt das automatisch
  für Stufe-A-Anonymisierungen (Script schreibt `account.erasure.runbook` mit
  `metadata.stage='anonymize'`). Für Stufe-B/C-Hard-Delete siehe Section 6
  „Vor dem psql-DELETE" — Admin setzt vorher manuell einen Audit-Eintrag.

## 5. Stufe A — Anonymisierung via Script

Empfohlener Weg: `scripts/right-to-erasure.{sh,ts}`.

```bash
bash scripts/right-to-erasure.sh user@example.de
```

Das Skript:
1. Sucht User per E-Mail.
2. Zeigt Vorschau-Block (User-Felder, Avatar-Media-ID, Counts
   Submissions / Article-Authorships).
3. Verlangt `Type "ERASE user@example.de" to confirm:` als
   String-Match.
4. Auf Bestätigung: identisch zu `deleteOwnAccountAction` —
   `hardDeleteAvatar` + Anonymisierung-Patch.
5. Druckt Audit-Trail in stdout. **Diesen Output kopieren** und in
   die Bestätigungs-Mail an User aufnehmen + im 1Password-Vault
   archivieren.
6. **Sub-C3-Audit-Log:** Skript schreibt zusätzlich einen Eintrag
   `account.erasure.runbook` mit `metadata.stage='anonymize'`,
   `metadata.method='runbook_script'`, `subject=<user-id>`, `subjectEmail=<original>`.
   Bleibt 90 Tage in `/admin/collections/audit-logs`. Doppelte Sicherung
   (stdout + DB) ist gewollt.

## 6. Stufe B/C — Manuelles Hard-Delete

**Vor dem psql-DELETE: Audit-Eintrag setzen.** Stufe B/C läuft außerhalb der App
und schreibt KEINEN automatischen Audit-Trail. Der ausführende Admin setzt vorher
manuell einen `account.erasure.runbook`-Eintrag mit `metadata.stage='hard_delete'`,
`metadata.method='manual_psql'`. Siehe `docs/legal/audit-log-policy.md`
Section „Hard-Delete-Sonderfall" für das Snippet. **Reihenfolge wichtig:** Audit
zuerst (solange User-Row noch da ist, kann `subject` gesetzt werden); danach psql-
DELETE; durch `ON DELETE SET NULL` wird `subject` automatisch null, aber der
Email-Snapshot überlebt.

**Vorbereitung:**
- Backup-Hinweis: Neon Point-in-Time-Recovery deckt 7 Tage ab. Falls
  Rollback nötig: `neonctl branches restore <branch-id> --parent
  <timestamp>` (siehe Neon-Doku). Vor jedem Hard-Delete den genauen
  Timestamp notieren.
- GitHub-Mirror-Hinweis: Public-Articles sind via V1.5-Hook auf
  `github.com/shogun160/pflege-atlas-content` gespiegelt. Hard-Delete
  in der App entfernt den GitHub-Inhalt **nicht** — separater
  `git rm` + `git commit + push` im Mirror-Repo nötig. Auch dann
  bleibt der Inhalt in der git-History und in Repo-Forks.

**FK-Abhängigkeiten beim User-Hard-Delete:**

```sql
-- Reihenfolge: child-tables zuerst, dann user-table.

-- 1) Submissions wo User submitter ODER reviewer war
DELETE FROM submissions WHERE submitted_by_id = <USER_ID>;
UPDATE submissions SET current_reviewer_id = NULL WHERE current_reviewer_id = <USER_ID>;

-- 2) Articles.authors hasMany-Junction (Stufe B: alle authorship-Verweise weg)
DELETE FROM articles_rels WHERE path = 'authors' AND users_id = <USER_ID>;

-- 3) Articles.current_reviewer_id
UPDATE articles SET current_reviewer_id = NULL WHERE current_reviewer_id = <USER_ID>;

-- 4) Media.uploaded_by_id (alle user-uploaded Media-Docs — Cascade!)
SELECT id FROM media WHERE uploaded_by_id = <USER_ID>;
-- Diese IDs manuell per Payload-Admin-UI löschen, damit s3Storage-Hook
-- die R2-Files mitnimmt. Direkter DELETE in SQL würde R2-Files orphan
-- lassen.
-- Alternative: payload-Local-API-Script.

-- 5) Users.invited_by_id (Hinweis: User die DIESER User eingeladen hat)
UPDATE users SET invited_by_id = NULL WHERE invited_by_id = <USER_ID>;

-- 6) Erst jetzt: User-Row
DELETE FROM users WHERE id = <USER_ID>;
```

**Wichtig:** SQL nur im psql-Direktzugriff laufen (`docker exec`
lokal, `psql $DATABASE_URI` auf Prod), nicht über Payload-Admin-UI
(die Admin-UI hat keine Bulk-Delete-Garantie und triggert
Hooks/Access-Control bei jedem Schritt).

## 7. Bestätigung an User

Mail-Template-Skizze:

```
Betreff: Ihre Datenschutz-Anfrage vom <Datum>

Hallo <Name>,

Ihre Anfrage zur Löschung Ihres PflegeAtlas-Accounts haben wir wie
folgt umgesetzt:

- Account-Status: <anonymisiert / hart gelöscht>
- Avatar-Profilbild: gelöscht
- Beiträge: <unter „Gelöschte:r Beitragende:r" verlinkt /
  Authorship entfernt>
- GitHub-Mirror: <unverändert / manueller Eingriff am ...>

Ausgeführt am: <Timestamp>
Audit-Referenz: <Audit-Trail-Snippet aus Script-Output>

Falls Sie weitere Fragen haben, antworten Sie auf diese Mail.

Mit freundlichen Grüßen,
Oliver Wosnitza & Christoph Brück
PflegeAtlas — gemeinsam Verantwortliche (Art. 26 DSGVO)
```

In den 1Password-Vault („DSGVO-Anfragen") aufnehmen:
- Datum Anfrage
- Datum Ausführung
- User-ID (nicht E-Mail, weil anonymisiert)
- Audit-Trail-Output
- Mail-Bestätigungs-Versand (Resend-Message-ID)

---

**TODO Sub-C3:** Audit-Log-Collection wird Section 7 ersetzen — alle
Erasure-Events landen automatisch im Audit-Log und werden 90 Tage
aufbewahrt (laut V1.7-Datenschutz-Spec Section 10).
