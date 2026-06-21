# V1.6 — Editorial-Workflow + Auth (Spec)

**Status:** Spec, vor Plan-Phase
**Datum:** 2026-06-21
**Vorgänger:** V1.5 (Submissions-as-PRs, PR #9 → `d2d5b06`), PR #15 Status-Vereinheitlichung, PR #17 Status-Enum-Extension
**Ausgangs-HEAD von `main`:** `e6d8976`

---

## 1. Ziel und Scope (B+)

V1.6 öffnet PflegeAtlas für **persistente Beitragende mit Account** — primär Christoph als interner Reviewer/Editor, dann handverlesene externe Autor:innen — und schafft die Workflow-Schicht, die dafür nötig ist:

- **Frontend-Login** für eingeladene Beitragende
- **4 Rollen** mit echten Permission-Grenzen (`admin`, `editor`, `reviewer`, `contributor`)
- **Invitation-Flow** (kein Self-Signup) mit Magic-Set-Password-Link
- **Editorial-Pipeline** für Articles um einen Status erweitert (`ready_to_publish`)
- **Claim-Mechanik** („wer hat das gerade in Review")
- **Contributor-Dashboard** auf Frontend (`/mein-bereich`)
- **Editor-Dashboard** als Custom-Component im Payload-Admin

### Bewusst draußen (defer auf eigene Pläne)

| Defer-Item | Begründung |
|---|---|
| Public Author Pages (`/autor/<slug>`) | Henne-Ei (kein:e externe:r Autor:in da). Daten-Schema (Bio, Avatar) wird aber gebaut, sodass nur das Frontend nachzuziehen ist. |
| Standards-Bound-Re-Review-Cron (18 Monate) | Braucht erst published standardsbound-Artikel + Cron-Infra. |
| Self-Signup / Antragsformular | Heute nur Text-Hinweis-Page mit `mailto:redaktion@…`. Erst nötig, wenn unaufgeforderte Bewerbungen kommen. |
| Magic-Link-Login (Token-Login statt Password) | Nice-to-have. Forgot-Password + Set-Password decken den UX-Kern ab. |
| OAuth (Google/GitHub) / 2FA / Passkey | Kein Use Case bei Invitation-only + handverlesener Gruppe. |
| V2-QM-Tool-SSO | V2 ist eigenes Repo/Produkt. Auth-Kapselung in V1.6 hält die Tür offen. |
| Submission-Status-Mails an externe Submitter | Eigener Mail-Notification-Track, V1.7+. |
| Audit-Log-Collection (User-Lifecycle-Events) | V1.5-GitHub-Sync ist faktisch der Audit-Trail für Content-Changes. User-Events können später nachgereicht werden. |
| Hard-Delete für Right-to-Erasure-Anfragen | V1.6 macht nur Soft-Delete + Anonymisierung. Hard-Delete passiert manuell durch Admin, falls Anfrage kommt. |

### Release-Gate

V1.6 darf **nicht produktiv deployed werden, bevor der DSGVO-Track (Datenschutzerklärung, Impressum, AVV mit Resend/Cloudflare/Postgres-Hoster) durch ist.** V1.6 sammelt Account-Daten — die brauchen rechtsgültige Erklärung.

---

## 2. Architektur

Drei Bausteine:

**(1) Auth-Layer (gekapselt)** — `src/lib/auth.ts` ist die einzige Stelle, die Payload-Auth-API anspricht. Alle Server Components, Server Actions und Collection-Access-Functions reden ausschließlich über diese Schicht. Damit ist ein späterer Auth-Stack-Wechsel (z.B. V2-QM-Tool-SSO) lokal begrenzt.

**(2) Erweitertes Domain-Modell** — `users` bekommt Profil-Felder + Lifecycle-Felder; `articles.status`-Enum bekommt `ready_to_publish`; `submissions` bekommt `submittedBy` (auto-fill); `media` bekommt `purpose` (für Avatar-Privacy). Collection-Access wird von `Boolean(user)` auf rolle-basiert refaktoriert.

**(3) UI-Schicht in zwei Welten**
- **Frontend** (Pflege-Atlas-Look, Petrol/Clay, Plex Serif/Sans): `/login`, `/passwort-vergessen`, `/passwort-setzen?token=…`, `/mein-bereich`, `/mitmachen`
- **Payload-Admin** (CMS-Standard-Look): Custom Dashboard, Users-Liste mit „Einladen", Filter-Presets in Submissions/Articles, „Claim"-Button in Detail-View. `/admin/login` redirected nach `/login`.

**Mail-Pipeline:** V1.3a-Resend-Adapter wird wiederverwendet für Invitation, Forgot-Password, Welcome, Notification.

---

## 3. Datenmodell

### 3.1 `users` Collection — neue Felder

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `role` (erweitert) | enum: admin / editor / reviewer / contributor | ja | War: editor/reviewer/contributor. `admin` ist neu. |
| `pflegerischeRolle` | enum: Pflegefachkraft / PDL / WBL / Auszubildende:r / Sonstiges | nein | Frei wählbar im Profil |
| `bundesland` | enum: 16 DE-Bundesländer + AT + CH + Sonstiges | nein | Region statt PLZ/Stadt (keine Deanonymisierung) |
| `avatar` | relationship → media (single) | nein | Profilbild, Privacy via `media.purpose='avatar'` |
| `disabled` | boolean | ja, default false | Login-Sperre ohne Datensatz-Verlust |
| `setPasswordToken` | text, hidden im UI | nein | 32-byte random, base64-url-safe |
| `setPasswordTokenExpiresAt` | timestamp, hidden im UI | nein | Default invite-Generation +7 Tage |
| `invitedBy` | relationship → users (single), readonly | nein | Audit |
| `invitedAt` | timestamp, readonly | nein | Audit |

Bestehende Felder bleiben: `email`, `password` (Payload-auth), `displayName`, `bio`.

### 3.2 `articles` Collection — Status-Enum + Claim-Field

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `status` (erweitert) | enum: draft / **in_review** / **ready_to_publish** / published / archived | ja | `ready_to_publish` ist neu |
| `currentReviewer` | relationship → users (single) | nein | Gesetzt während `status ∈ {in_review, ready_to_publish}`, sonst null |

Bestehende Felder bleiben: alle aus V1.5 (title, slug, intent, summary, definition, praxis, risiken, quellen, authors, reviewedBy, lastReviewedAt, standardsBound).

### 3.3 `submissions` Collection — Auto-Verknüpfung + Claim + Audit

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `submittedBy` | relationship → users (single), readonly | nein | Auto-fill bei `create` wenn `req.user` vorhanden |
| `currentReviewer` | relationship → users (single) | nein | Gesetzt während `reviewStatus = in_review`, sonst null |
| `reviewedBy` | relationship → users (hasMany) | nein | Audit-Historie aller Reviewer:innen |

Bestehende Felder bleiben: alle aus V1.5 (type, displayTitle, relatedArticle, proposedTitle/Intent/Summary/Sections, editedSections, correctionReason, submitterName, submitterEmail, proposedSlug, prNumber/Branch/State, reviewStatus, reviewerNotes, workflowButtons).

### 3.4 `media` Collection — Avatar-Privacy

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `purpose` | enum: avatar / article_image / other | ja, default `other` | Steuert Read-Access |
| `uploadedBy` | relationship → users (single) | nein | Audit + Avatar-Owner-Check |

Bestehende Felder bleiben: `alt`, `upload: true`.

### 3.5 Migrationen

Drei sequenzielle, self-contained Migrations (V1.2-Lesson):

1. **`<timestamp>_users_role_articles_status_enums`** — `ALTER TYPE enum_users_role ADD VALUE 'admin'` + `ALTER TYPE enum_articles_status ADD VALUE 'ready_to_publish'`. Pattern aus PR #17 (Enum-Extend). Plus: Olivers User-Record manuell auf `admin` per SQL im selben Migrations-Step.
2. **`<timestamp>_users_lifecycle_and_profile_fields`** — neue `users`-Spalten (pflegerischeRolle, bundesland, avatar, disabled, setPasswordToken, setPasswordTokenExpiresAt, invitedBy, invitedAt). Default-Werte für bestehende Rows: alle null außer `disabled=false`.
3. **`<timestamp>_submissions_articles_media_review_fields`** — `submissions.submittedBy`, `submissions.currentReviewer`, `submissions.reviewedBy` (M2M-Tabelle), `articles.currentReviewer`, `media.purpose` (default `other`), `media.uploadedBy`.

CI-Vorschrift: jede Migration muss gegen leere DB durchlaufen. Pre-Merge-Check.

---

## 4. Permission-Matrix

Zentrale TypeScript-Konstante in `src/lib/auth.ts`, Single Source of Truth. Alle Access-Functions referenzieren sie.

### 4.1 Articles

| Action | admin | editor | reviewer | contributor | anonym |
|---|---|---|---|---|---|
| read `published` | ✓ | ✓ | ✓ | ✓ | ✓ |
| read alle Stati | ✓ | ✓ | ✓ | – | – |
| create | ✓ | ✓ | ✓ | – | – |
| update Inhalt | ✓ | ✓ | ✓ | – | – |
| status → `in_review` | ✓ | ✓ | ✓ | – | – |
| status → `ready_to_publish` | ✓ | ✓ | ✓ | – | – |
| status → `published` | ✓ | ✓ | – | – | – |
| status → `archived` | ✓ | ✓ | – | – | – |
| delete | ✓ | – | – | – | – |

Status-Übergang via `beforeChange`-Hook validiert: `previousDoc.status` ↔ `data.status` ↔ `req.user.role`. Verstoß → 403.

### 4.2 Submissions

| Action | admin | editor | reviewer | contributor | anonym |
|---|---|---|---|---|---|
| read alle | ✓ | ✓ | ✓ | – | – |
| read eigene (`submittedBy = req.user`) | – | – | – | ✓ | – |
| create | ✓ | ✓ | ✓ | ✓ | ✓ |
| update (Workflow + Notes) | ✓ | ✓ | ✓ | – | – |
| delete | ✓ | – | – | – | – |

**Bewusste Vereinfachung:** Contributor kann eigene Submissions nicht updaten — auch nicht im `pending`-State. Submission ist „abgeschickt = fertig". Bei Nachtrag: neue Submission anlegen.

### 4.3 Users

| Action | admin | editor | reviewer | contributor |
|---|---|---|---|---|
| read alle (Relationship-Picker) | ✓ | ✓ | ✓ | – |
| read own | ✓ | ✓ | ✓ | ✓ |
| invite admin/editor | ✓ | – | – | – |
| invite reviewer/contributor | ✓ | ✓ | – | – |
| update own profile¹ | ✓ | ✓ | ✓ | ✓ |
| update own role / disabled / email | – | – | – | – |
| update others' role | ✓ | – | – | – |
| update others' disabled | ✓ | – | – | – |
| delete (hard) | ✓ | – | – | – |

¹ „own profile" = displayName, bio, pflegerischeRolle, bundesland, avatar. Nicht role, disabled, email, password. `updateOwnProfileAction` filtert eingehende Daten gegen Whitelist; Field-Level-Access in der Collection als doppelte Wand.

**Privilege-Escalation-Schutz:**
- `inviteUserAction` validiert `req.user.role`-vs-eingeladene-Rolle doppelt — in der Server-Action UND in der Collection-`create`-Access. Editor kann keine admins/editors anlegen.
- `updateOwnProfileAction` whitelisted erlaubte Felder. Self-Promotion zu admin/editor ist unmöglich, auch durch konstruierte Requests.
- Bestehende User können ihre Email nicht selbst ändern (defer auf V1.7); Email-Wechsel braucht Admin-Eingriff (verhindert Account-Übernahme via Email-Hijack ohne Audit).

### 4.4 Media

| Action | admin | editor | reviewer | contributor | anonym |
|---|---|---|---|---|---|
| read `purpose=article_image` | ✓ | ✓ | ✓ | ✓ | ✓ |
| read `purpose=avatar` (own) | ✓ | ✓ | ✓ | ✓ | – |
| read `purpose=avatar` (andere) | ✓ | ✓ | – | – | – |
| upload avatar (own) | ✓ | ✓ | ✓ | ✓ | – |
| upload article_image | ✓ | ✓ | ✓ | – | – |
| delete (own) | ✓ | ✓ | ✓ | ✓ | – |
| delete (any) | ✓ | – | – | – | – |

Avatar-Read-Access ist die Tightening-Erwartung an V1.6. Heute ist `media.read: () => true` (alles public). Mit `purpose`-Feld können wir Avatar-Zugriff begrenzen. Wenn später Author-Pages dazukommen, lockern wir Avatar-Read selektiv (eigener Plan).

---

## 5. Workflows & Lifecycles

### 5.1 Article-Lifecycle

```
draft ──→ in_review ──→ ready_to_publish ──→ published ──→ archived
  ↑          ↑↓                ↑↓                ↑↓
  └──────────┴─────────────────┴────────────────┘
        (Übergänge via Status-Dropdown im Admin)
```

| Übergang | Wer |
|---|---|
| `draft → in_review` | editor/reviewer (Claim) |
| `in_review → ready_to_publish` | editor/reviewer („fertig, Editor übernehmen") |
| `in_review → draft` | editor/reviewer („zurück, mehr zu tun") |
| `ready_to_publish → in_review` | editor („nochmal reviewen") |
| `ready_to_publish → published` | **nur editor/admin** (finaler Klick) |
| `* → archived` | editor/admin |
| `archived → published` | editor/admin |

**Claim-Mechanik:** Bei Wechsel **nach** `in_review` (von `draft`) wird `currentReviewer = req.user`. Bei Wechsel **weg** von `in_review` oder `ready_to_publish` wird der bisherige `currentReviewer`-Wert nach `reviewedBy` (Historie) gepusht und `currentReviewer = null`.

**V1.5-GitHub-Sync** läuft unverändert — triggert auf `published ↔ not-published`. Andere Übergänge sind für GitHub still (Audit lokal in DB).

### 5.2 Submission-Lifecycle

```
pending ──→ in_review ──→ accepted
              ↓              ↓
           rejected      [Article published]
```

| Übergang | Wer | Side-Effects |
|---|---|---|
| `pending → in_review` | editor/reviewer | V1.5: PR-Erzeugung + `currentReviewer = req.user` |
| `in_review → accepted` | **nur editor/admin** | V1.5: PR-Merge + Article-Anlage/-Update (Status direkt `published`) + `reviewedBy.push(currentReviewer)` + `currentReviewer = null` |
| `in_review → rejected` | editor/admin | V1.5: PR-Close + `currentReviewer = null` |
| `pending → rejected` | editor/admin | Kein PR (Spam/Doppelt) |

Bei Submission-`accepted`:
- `type=new_article` → neuer Article mit Status `published` (kein Umweg über `ready_to_publish` — Editor hat entschieden)
- `type=correction` → Article-Update, Status bleibt `published`
- Article.authors: enthält `submittedBy` der Submission (falls nicht anonym)
- Article.reviewedBy: enthält `req.user` (Editor)
- Article.lastReviewedAt: jetzt

### 5.3 User-Lifecycle

```
[Editor klickt 'Einladen'] ─→ invited  (kein password, setPasswordToken aktiv)
                                  ↓
                       [Magic-Link-Klick + SetPassword]
                                  ↓
                                active
                                  ↓
                             disabled (admin oder self-delete)
```

Zustände implementiert via zwei Felder:
- `setPasswordToken` befüllt + nicht expired = **invited** (Login per Email/Password unmöglich)
- `setPasswordToken` leer + `password` gesetzt + `disabled=false` = **active**
- `disabled=true` = **gesperrt** (Login-Action verweigert auch bei korrektem Password)

**Re-Invite:** Editor öffnet User im Admin → Knopf „Erneut einladen" generiert neuen Token (alter wird invalidiert), schickt neue Mail.

**Hard-Delete** nur via admin und nur wenn keine Article-/Submission-Referenzen (sonst FK-Block — natürlicher Schutz). Standardweg für „User loswerden" ist `disabled=true`.

---

## 6. UI/UX

### 6.1 Frontend-Pages (Pflege-Atlas-Look, responsive)

**`/login`** — Email + Password + „Passwort vergessen?"-Link. Submit ruft `loginAction`. Smart-Redirect nach Rolle: admin/editor/reviewer → `/admin`, contributor → `/mein-bereich`. Wenn `?next=...` gesetzt → dorthin. Bereits eingeloggt → sofortiger Redirect.

**`/passwort-vergessen`** — Email-Feld + Submit. Rate-Limit-Hinweis. Erfolgs-Message **immer generisch** (keine Account-Enumeration).

**`/passwort-setzen?token=…`** — Token in Server-Component-Phase geprüft:
- Token valid → Set-Password-Form (zwei Felder, Min-8-Zeichen) + Lifecycle-Hinweis („Willkommen" bei Invitation vs. „Wähle neues Passwort" bei Reset)
- Token invalid/expired → Error-Page mit „Neuen Link anfordern"-CTA
- Bei Invitation zusätzlich Pflicht-Checkbox: „Mit dem Passwort-Setzen bestätigst du, dass Email und Anzeigename gespeichert werden. [Datenschutz]"

**`/mein-bereich`** — Login required, Pflege-Atlas-Look
- **Card 1 „Meine Beiträge"** — Liste eigener Submissions (für Contributor; ausgeblendet bei admin/editor/reviewer). Pro Eintrag: Titel, Typ-Badge, Status-Badge, Datum, ggf. Link zum entstandenen Article.
- **Card 2 „Profil"** — Edit-Form für displayName, bio, pflegerischeRolle, bundesland, avatar. Save via Server-Action. Email-Änderung **nicht** in V1.6 (defer auf V1.7).
- **Card 3 „Neuer Beitrag"** — CTA zu `/einreichen` (auto-`submittedBy`)
- **Card 4 „Zur Redaktion" (nur admin/editor/reviewer)** — Link zu `/admin`
- **Card 5 „Konto"** — „Daten exportieren" + „Account löschen"

**`/mitmachen`** — Statische Page:
1. „Beitrag/Korrektur?" → CTA zu `/einreichen` (kein Account nötig)
2. „Regelmäßig beitragen / namentlich genannt werden?" → Text-Hinweis + Mailto-Link zu `redaktion@pflegeatlas.org`
3. „Pflege-Kraft, willst lesen?" → CTA zu `/artikel`

Verlinkt aus Header und Footer.

**Header-Anpassung** — Server-Component, liest Session. Ausgeloggt: „Anmelden"-Button → `/login`. Eingeloggt: Dropdown mit Avatar/Initial + displayName, Items „Mein Bereich", ggf. „Admin", „Logout" (Form-Submit zu Logout-Action).

### 6.2 Payload-Admin-Anpassungen

**Custom Admin Dashboard** als Landing-Page für `/admin` (via `admin.components.views.dashboard` in Payload-Config):
- 4 Stats-Cards: Pending Submissions, In-Review Submissions, Ready-to-publish Articles, Mein offener Stack
- 2 Quick-Lists: „5 neueste Submissions", „5 neueste Articles in Pipeline"

**Users-Liste** — Spalten: email, displayName, role, disabled (Badge), invitedAt vs. last-login.
- Knopf „Einladen" oben mit Modal (Email + Role-Select, Optionen rolle-abhängig gefiltert)
- Re-Invite-Knopf in jeder invited-Zeile

**Submissions-Liste** — bestehende Spalten + „In Review bei" (`currentReviewer.displayName`).
- Filter-Presets: „Pending", „Unzugewiesen in Review", „Meins", „Alle in Review"

**Articles-Liste** — analog, Spalte „In Review bei" + Status-Color-Badge (draft=grau, in_review=gelb, ready_to_publish=orange, published=grün, archived=neutral).
- Filter-Presets: „Mein Stack", „Ready to publish", „Alle in Pipeline"

**Detail-View Article/Submission** — bei `status=in_review` mit leerem `currentReviewer`: Sidebar-Knopf „Übernehmen" (Claim). Bei fremdem currentReviewer: Hinweis-Text „Aktuell bei <Name>". Übernahme durch andere editor/admin: möglich mit Warnung-Modal.

**`/admin/login`** — Next-Route-Handler returnt 307 zu `/login?next=/admin`. Payload-Default-UI wird nicht geladen.

### 6.3 Responsive-Verhalten

- Frontend-Pages (Login, /mein-bereich, /mitmachen, /einreichen, alle Artikel-Pages): mobile-first, V1.1-Pattern
- Payload-Admin: nutzt Payload-Default-Responsivität (passabel, nicht perfekt) — Review/Korrektur/Article-Schreiben passieren laut Stakeholder am Rechner, Mobile-Admin ist nicht prioritär

---

## 7. Auth-Layer (`src/lib/auth.ts`)

Single Source of Truth für Sessions, Permissions und Auth-Actions. Niemand außer `src/lib/auth.ts` ruft Payload-Auth-API direkt.

### 7.1 Read-Side API

```ts
getSession(): Promise<Session | null>      // Cookie-Lookup
requireUser(): Promise<Session>             // 401 wenn null
requireRole(roles: Role[]): Promise<Session> // 403 wenn role nicht enthalten
hasPermission(user, action, resource): boolean
```

`Session` enthält `{ id, email, displayName, role, disabled, avatar }`. Niemals Password-Hash.

`hasPermission` referenziert die Permission-Matrix-Konstante (Section 4).

### 7.2 Server-Actions

```ts
loginAction(email, password): Promise<LoginResult>
logoutAction(): Promise<void>
inviteUserAction(email, role, displayName?): Promise<InviteResult>
setPasswordFromTokenAction(token, password): Promise<SetPasswordResult>
requestPasswordResetAction(email): Promise<{ ok: true }>  // immer ok (Anti-Enumeration)
updateOwnProfileAction(data): Promise<UpdateProfileResult>  // whitelisted: displayName, bio, pflegerischeRolle, bundesland, avatar
deleteOwnAccountAction(confirmation): Promise<void>  // Soft-Delete + Anonymisierung
exportOwnDataAction(): Promise<{ filename, json }>
```

Jede Action validiert intern und nutzt `requireUser` / `requireRole` als ersten Schritt.

### 7.3 Payload-Auth-Config-Tweaks (in `Users.ts`)

```ts
auth: {
  tokenExpiration: 60 * 60 * 24,    // 24h (statt Default 2h)
  maxLoginAttempts: 5,
  lockTime: 600 * 1000,              // 10min
  verify: false,                     // wir nutzen Magic-Set-Password
  cookies: { sameSite: 'Lax', secure: true } // Production
}
```

### 7.4 Token-Lifecycle (Magic-Set-Password)

- Generierung: `crypto.randomBytes(32).toString('base64url')` (43-char URL-safe)
- Speicherung: `setPasswordToken` (text, indexed für Lookup) + `setPasswordTokenExpiresAt` (timestamp, +7 Tage bei Invitation, +1h bei Reset)
- Einlösung: `setPasswordFromTokenAction` sucht User mit `setPasswordToken=X AND setPasswordTokenExpiresAt > NOW()`. Setzt Password, clear Token + Expiry. Returnt Login-Session.
- Reuse-Schutz: Token wird nach Einlösung gecleart. Zweite Einlösung returnt 404.

### 7.5 Rate-Limiting

- Login: Payload-native via `maxLoginAttempts` + `lockTime`
- Forgot-Password: Server-Action wrappt Payload-`forgotPassword` mit In-Memory-Bucket (3 Anfragen / IP / 10min). Bei Limit-Treffer trotzdem generische Erfolgs-Message.
- Invite: nur editor/admin können callen → kein externes Surface

---

## 8. Mail-Templates

Vier Trigger in V1.6 (Resend-Adapter aus V1.3a):

| # | Trigger | Empfänger | Subject |
|---|---|---|---|
| 1 | `inviteUserAction` | Eingeladene:r | „Willkommen bei PflegeAtlas — Account aktivieren" |
| 2 | `requestPasswordResetAction` | User | „Passwort-Reset für deinen PflegeAtlas-Account" |
| 3 | Article `in_review → ready_to_publish` Hook | alle editor + admin | „Artikel '<Titel>' ist bereit zur Veröffentlichung" |
| 4 | Erfolgreicher `setPasswordFromTokenAction` (Invitation-Flow) | Eingeladene:r | „Account aktiv — willkommen bei PflegeAtlas" |

**Template-Architektur:**
- `src/lib/mail-templates/` mit einem File pro Mail: `invitation.ts`, `forgot-password.ts`, `ready-to-publish.ts`, `welcome.ts`
- Pro Template: `renderXxxMail(args): { subject, html, text }`
- HTML + Plain-Text, beide branded (PflegeAtlas-Wortmarke oben, Footer mit Impressum + Datenschutz)
- HTML: mailclient-kompatibel (Inline-Styles, System-Fonts mit Plex als Progressive Enhancement, single-column ~600px)
- Snapshot-Tests pro Template + assert: Token erscheint im Output, kein Password im Output

**Anti-Pattern explizit ausgeschlossen:** Wir senden **niemals** das Passwort selbst in einer Mail. Auch nicht ein „temporäres" Initial-Password. Immer nur Magic-Link.

---

## 9. DSGVO-Aspekte

**Disclaimer:** V1.6 baut technische Voraussetzungen — die vollständige Datenschutzerklärung + Impressum + AVV-Verträge sind eigener DSGVO-Track. V1.6 darf nicht produktiv deployed werden, bevor der DSGVO-Track durch ist (siehe Release-Gate in Section 1).

### 9.1 Was V1.6 selbst liefert

**Datenminimum als Default**
- Pflicht bei Account: nur email + displayName + password
- Optional: bio, pflegerischeRolle, bundesland, avatar
- Keine Adressen, Telefonnummern, Geburtsdaten
- `bundesland` statt PLZ/Stadt (Anti-Deanonymisierung)

**Self-Service Account-Löschung** in `/mein-bereich`
- Zweistufige Bestätigung (Modal + getipptes „LÖSCHEN")
- Soft-Delete + Anonymisierung:
  - `disabled = true`
  - `email = 'deleted-<random>@invalid.local'`
  - `displayName = 'Gelöschte:r Beitragende:r'`
  - `bio = null`, `pflegerischeRolle = null`, `bundesland = null`
  - Avatar wird hard-gelöscht (Media-Record + File)
  - `invitedBy` bleibt (Audit)
- Submissions.submittedBy und Articles.authors zeigen weiter auf den User-Record (mit anonymisiertem Namen). Audit + externer Beitrag bleiben zuordbar.
- **Admin-Accounts können nicht self-deleten** (Schutz-Constraint) — nur per zweitem Admin / DB-Eingriff

**Datenexport (Art. 15 DSGVO)** in `/mein-bereich`
- JSON-Download mit: eigener User-Record (ohne Password-Hash), alle eigenen Submissions, Liste aller Articles wo `authors` mich enthält, Avatar als Base64 oder Download-URL

**Privacy-Hinweise an den richtigen Stellen**
- `/passwort-setzen` (Invitation): Pflicht-Checkbox vor Submit
- Avatar-Upload: „derzeit nicht öffentlich, intern für Wiedererkennung"
- Bundesland/pflegerischeRolle: „Optional. Sichtbar für: Redaktion."

**Cookie-Handling**
- Login-Cookie (`payload-token`) ist „strictly necessary" — kein Opt-In-Banner nötig
- Hinweis in Datenschutzerklärung (DSGVO-Track)
- Sonst keine Cookies in V1.6

**Mail-Logs** — Resend-Dashboard ist authoritative; keine zusätzliche App-seitige Mail-Log-Collection.

**Account-Enumeration-Schutz** — Forgot-Password antwortet immer generisch. Login-Endpoint hat Payload-natives Lock-after-Failed-Attempts.

### 9.2 Was V1.6 nicht liefert (DSGVO-Track oder V1.7+)

- Datenschutzerklärung-Page
- Impressum
- AVV mit Resend, Cloudflare, Postgres-Hoster
- Aufbewahrungs-Konzept (automatische Löschung inaktiver Accounts)
- Audit-Log-Collection für User-Lifecycle-Events
- Hard-Delete für echte Right-to-Erasure-Anfragen (kommt bei Bedarf manuell durch Admin)

---

## 10. Testing-Strategie

Vitest-Setup bleibt wie V1.5 (zwei Projects: `node` mit DB + `jsdom` für Components). `tests/setup.node.ts` (V1.5-GitHub-Mocks) wird um Mail-Mock erweitert (`vi.mock('@/lib/mail')`).

### 10.1 Unit-Tests (`tests/unit/`)

- `auth-permissions.test.ts` — Permission-Matrix als Truth-Table (4 Rollen × jede Action × jede Collection ≈ 80 Cases via parametrize)
- `auth-tokens.test.ts` — Token-Generierung (32-byte, base64-url-safe), -Validation (expired, malformed)
- `article-status-transitions.test.ts` — jeder erlaubte + verbotene Übergang × jede Rolle
- `user-soft-delete.test.ts` — Anonymisierung-Function, Schutz für admin-Self-Delete
- `mail-templates/*.test.ts` — pro Template: Snapshot HTML + Text, assert Token erscheint, assert kein Password im Output

### 10.2 Component-Tests (`tests/component/`)

- `LoginForm.test.tsx` — Validation, Error-Display, Smart-Redirect (Action-Mock)
- `SetPasswordForm.test.tsx` — Token-Validation-States, Min-Length-Check
- `ProfileEditForm.test.tsx` — alle Felder, Avatar-Upload-Stub, Bundesland-Select
- `HeaderUserMenu.test.tsx` — Login-Status-Switch, Dropdown-Items je Rolle
- `ClaimButton.test.tsx` — sichtbar nur bei `status=in_review AND currentReviewer IS NULL`
- `AdminDashboard.test.tsx` — Stats-Cards, Empty-States, Filter-Links

### 10.3 Integration-Tests (`tests/integration/`)

Gegen echte Postgres-DB:

- `auth-actions.test.ts` — loginAction, logoutAction, inviteUserAction, setPasswordFromTokenAction, requestPasswordResetAction (Happy + Error)
- `permission-matrix-collections.test.ts` — pro Rolle versucht jede Collection-Action via Payload-Local-API, assertet 200/403
- `article-status-hook.test.ts` — verbotene Übergänge werfen 403
- `submission-auto-attribution.test.ts` — eingeloggter Contributor → submittedBy automatisch gesetzt
- `user-lifecycle.test.ts` — Invite → SetPassword → Login → Disable → Login-blocked → Self-Delete → Anonymized-State
- `data-export.test.ts` — Export-JSON enthält erwartete Top-Level-Keys
- `claim-mechanics.test.ts` — claim race (zwei Requests, Last-Write-Wins)
- `magic-link-security.test.ts` — Token nicht zweimal einlösbar, expired Token rejected, fremder Token rejected

### 10.4 Test-DB-Vorbereitung

- Beforeach: Truncate V1.6-relevanter Tabellen
- Seed: ein User pro Rolle als Fixture-Helper `createUserFixture(role)`
- Mail-Mock: globale `vi.mock('@/lib/mail')` in `setup.node.ts` mit `mockSendMail.calls`

### 10.5 Manuelle Browser-Verifikation (V1.5-Lesson)

Sechs Pflicht-Flows:
- **A** Admin lädt Editor ein → Magic-Link → SetPassword → Login → Admin-Dashboard
- **B** Editor lädt Contributor → aktiviert → submitted Beitrag mit auto-submittedBy → sieht in `/mein-bereich`
- **C** Editor lädt Reviewer → Reviewer claimt Submission → reviewt → ready_to_publish → Editor publisht
- **D** Contributor edit Profile + Avatar + Account-Lösch (assert Anonymisierung)
- **E** Forgot-Password-Roundtrip mit echter Resend-Mail
- **F** Privilege-Escalation: editor versucht admin anzulegen → 403; contributor versucht `/admin` → Redirect

Zusätzlich:
- Echte Resend-Mails in Staging-Setup
- Avatar-Upload-Edge-Cases (PNG/JPG/WebP, große Files, polyglott-PDF mit `.jpg`-Endung → Reject)
- Cross-Browser: Chrome, Safari, Firefox (Login + Set-Password)
- Mobile-Quick-Check: Frontend-Pages auf iPhone (Admin nicht prioritär)

### 10.6 Coverage-Erwartungen

- Permission-Matrix + Auth-Layer + Token-Lifecycle: ~100%
- Restliches V1.6: Happy-Path + Top-Error-Paths
- Erwarteter Test-Zuwachs: 233 → ~300 (60-80 neue)

### 10.7 Out-of-scope für V1.6-Tests

- Load-/Stress-Tests
- Externer Security-Pen-Test
- DSGVO-Compliance-Audit

---

## 11. Migrations- und Deployment-Risiken

| Risiko | Mitigation |
|---|---|
| Payload-Postgres-Dev-Adapter pusht Schema-Diffs silently beim Boot (V1.4/V1.5-Lesson) | Migration-First-Workflow: Migration manuell schreiben + via psql applien, dann Code committen. Pre-Merge: CI grünes Migrations-Replay gegen frische DB. |
| Enum-Extension auf bestehende `users.role`-Spalte | Migration testet auch Olivers-Record-Update auf `admin`. Pre-Check: SELECT current role values. |
| Avatar-Read-Access in Tests | Test-Fixtures setzen `purpose='avatar'` explizit. Default `other` deckt Article-Image-Path automatisch. |
| Bestehende V1.5-Tests betroffen (`req.user` jetzt strukturierter) | tests/setup.node.ts erweitert um `createUserFixture` + User-Login-Helper. Bestehende Integration-Tests umstellen wo nötig. |
| GitHub-Sync-Hook bei Status-Wechsel ready_to_publish | Hook prüft nur `published ↔ not-published`-Übergänge — `ready_to_publish` ist beidseitig „not-published", also kein Trigger. Regression-Test in `tests/integration/`. |
| Production-Deploy ohne DSGVO-Track | **Release-Gate** in der Deployment-Doku. Spec-Header und PR-Body erinnern an den Block. |

---

## 12. Abgrenzung zu bestehendem Code

**Was bleibt unverändert:**
- V1.5 Submissions-as-PRs (Server-Actions, GitHub-Sync, Hooks)
- V1.4 Submission-Form-Struktur (`/einreichen`)
- V1.3a Mail-Infrastruktur (Resend-Adapter, email-config)
- V1.3b/V1.4 Anonyme Submission-Pipeline
- Article-Schema außer Status-Enum + currentReviewer
- Articles `read`-Access (`published` für anonym, sonst eingeloggt) bleibt vom Prinzip her — die rolle-basierten Updates kommen on top

**Was wird angefasst (Refactor):**
- Alle Collection-`access`-Functions (von `Boolean(user)` zu rolle-basiert via `hasPermission`)
- `Users.ts` (Auth-Config-Tweaks, neue Felder, neue Hooks)
- `Submissions.ts` (submittedBy, currentReviewer, reviewedBy, Hook-Erweiterung)
- `Articles.ts` (currentReviewer, Status-Übergangs-Hook)
- `Media.ts` (purpose, uploadedBy, Read-Access-Verfeinerung)
- `payload.config.ts` (Custom Admin Dashboard-Component)
- Header-Component (Login-Status, Avatar-Display)

**Was ist komplett neu:**
- `src/lib/auth.ts` und Mail-Templates-Folder
- Alle V1.6 Frontend-Pages (Login, Forgot, SetPassword, MeinBereich, Mitmachen)
- Custom Admin Dashboard Component
- `/admin/login` Route-Handler-Redirect

---

## 13. Offene Punkte / Bewusste TBDs

Keine. Alle aus dem Brainstorm aufgemachten Detail-Entscheidungen sind in den Sections oben festgehalten. Spätere Plan-Phase darf neue Detail-TBDs zu Implementation aufmachen (Migration-Reihenfolge-Verfeinerung, exakte TypeScript-Signaturen, etc.).

---

## 14. Quellen

- **V1.5-Spec** `docs/superpowers/specs/2026-06-20-pflegeatlas-submissions-as-prs-v1-5-design.md`
- **V1.5-Plan** `docs/superpowers/plans/2026-06-20-pflegeatlas-submissions-as-prs-v1-5.md`
- **Status-Vereinheitlichung-Spec (PR #15)** `docs/superpowers/specs/2026-06-21-pflegeatlas-status-unification-design.md`
- **Articles-Status-Enum-Extend-Spec (PR #17)** `docs/superpowers/specs/2026-06-21-pflegeatlas-articles-status-enum-extend-design.md`
- **Homepage-Community-Pull-Brainstorm** `docs/BRAINSTORM-2026-06-20-homepage-community-pull.md` (Contributor-Stories als Defer-Pattern referenziert)
- **Track-F-Handoff (PR #12-#13)** `docs/HANDOFF-2026-06-20-track-f-and-pr-12.md` (Auth-Stack ursprünglich genannt: Better-Auth, in V1.6 zugunsten Payload-native verworfen mit Begründung in Section 7)
