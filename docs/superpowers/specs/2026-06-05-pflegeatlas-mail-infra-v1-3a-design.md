# PflegeAtlas — Mail-Infrastruktur V1.3a (Design-Spec)

**Status:** Entwurf nach Brainstorming-Session am 2026-06-05 · Folgt auf V1.2 Hygiene-Sprint (gemerged auf `main` als `af881e3`).

## 1. Zweck und Scope

V1.3a richtet die Mail-Infrastruktur für PflegeAtlas ein, **bevor** sie der erste Funktions-Plan (V1.3b Submission-Formular) tatsächlich braucht. Hintergrund: ohne Mail-Setup kann die Submission-Notification an die Redaktion nicht funktionieren, und die gleiche Infrastruktur wird später von Auth-Verification-Mails, Editor-Einladungen und Passwort-Reset gebraucht. V1.3a wird deshalb als eigenständiger Plan vorgezogen, damit V1.3b sich auf die Form selbst konzentrieren kann.

V1.3a liefert:

- Empfangs-Routing für `redaktion@pflegeatlas.org` und `mitmachen@pflegeatlas.org` via Cloudflare Email Routing
- Sende-Pfad via Resend mit verifizierter Domain `pflegeatlas.org`
- Payload-Email-Adapter (`@payloadcms/email-resend`) **conditional registriert** abhängig von der Existenz eines API-Keys
- Ein Sanity-Check-Skript (`scripts/send-test-mail.ts`) zur manuellen Verifikation
- Dokumentation (`README`, `CONTRIBUTING`, `.env.example`) für künftige Mitwirkende
- Unit- und Integrations-Tests die ohne API-Key auskommen und CI grün lassen

V1.3a ist **nicht**:

- Kein Submission-Formular-Code (kommt in V1.3b).
- Keine Submission-Notification-Mail-Template (kommt in V1.3b mit dem Form-Code).
- Keine Auth-relevanten Mail-Templates (forgotPassword, emailVerification) — die kommen automatisch in Reichweite sobald Auth aktiviert wird, aber der Auth-Plan ist eigenständig.
- Kein Production-Deployment der Mail-Konfig — V1.3a stellt nur die Plumbing bereit; ENV-Vars im Hosting-Dashboard kommen mit dem Deployment-Plan.
- Kein Submitter-Bestätigungs-Mail-Flow („Danke, deine Submission ist eingegangen"). Dies ist optional und gehört falls erwünscht zu V1.3b oder später.

## 2. Architektur

Zwei voneinander unabhängige Pfade:

**Empfangs-Pfad** (kein Code im Repo, reines Cloudflare-Setup):

```
Sender → MX-Record pflegeatlas.org → Cloudflare Email Routing
  ├── redaktion@pflegeatlas.org → Oliver-Mailbox + Christoph-Mailbox
  └── mitmachen@pflegeatlas.org → Oliver-Mailbox + Christoph-Mailbox
```

Cloudflare leitet nur weiter. Antworten der Redakteure gehen von ihren persönlichen Mailboxen raus, **nicht** von einer Pflegeatlas-Adresse. Outbound-Replies aus Pflegeatlas-Domain (Mailbox-mäßig) sind explizit out-of-Scope für V1.3a.

**Sende-Pfad** (Code im Repo):

```
payload.sendEmail({ to, subject, html }) →
  @payloadcms/email-resend Adapter →
  Resend-API (HTTPS) →
  noreply@pflegeatlas.org → Empfänger
```

Resend-Domain-Verifikation läuft über drei DNS-Records (SPF, DKIM, DMARC) bei Cloudflare. Verifikation ist Voraussetzung — ohne sie sendet Resend nicht.

## 3. Adress-Layout

| Adresse | Rolle | Konfiguration |
|---|---|---|
| `noreply@pflegeatlas.org` | Sender für alle System-Mails | Resend (Send-only). Eingehende Replies werden in Cloudflare nicht geroutet → bouncen / verworfen. |
| `redaktion@pflegeatlas.org` | Redaktions-Inbox | Cloudflare Email Routing → Oliver-Mailbox + Christoph-Mailbox |
| `mitmachen@pflegeatlas.org` | Öffentlich kommunizierte Mitmach-Adresse (im README) | Cloudflare Email Routing → gleiche Ziele wie `redaktion@` |

`hallo@` und weitere community-warme Adressen sind nicht in V1.3a, können später als zusätzliche Routing-Custom-Adressen jederzeit nachgerüstet werden ohne Code-Änderung.

## 4. Dev/Prod-Verhalten

Adapter wird in `src/payload.config.ts` **conditional** registriert:

```ts
email: process.env.RESEND_API_KEY
  ? resendAdapter({
      defaultFromAddress: process.env.RESEND_FROM_ADDRESS!,
      defaultFromName: process.env.RESEND_FROM_NAME ?? 'PflegeAtlas',
      apiKey: process.env.RESEND_API_KEY,
    })
  : undefined,
```

- **Lokales Dev** (`pnpm dev`): `RESEND_API_KEY` ist **nicht** in `.env` → `email` bleibt `undefined` → Payload nutzt seinen Default-Console-Logger. Mails landen in der Server-Console. **Keine manuelle .env-Anpassung nötig.**
- **CI**: `RESEND_API_KEY` ist nicht gesetzt → gleicher Console-Pfad → Tests laufen ohne externen Service.
- **Production**: `RESEND_API_KEY` ist im Hosting-Dashboard gesetzt → Resend-Adapter aktiv → echte Mails.

Lokale Verifikation (einmalig, kein Persist in `.env` nötig):

```bash
RESEND_API_KEY=re_xxx pnpm tsx scripts/send-test-mail.ts redaktion@pflegeatlas.org
```

## 5. Repo-Änderungen

**Neue Dependency:**

```
pnpm add @payloadcms/email-resend
```

Ein Production-Dep. Zieht `resend` (offizielles JS-SDK) als Peer-Dep mit. Beide werden in `package.json` deklariert.

**Geänderte/neue Files:**

| Pfad | Änderung |
|---|---|
| `src/payload.config.ts` | `email`-Property mit conditional Resend-Adapter ergänzen |
| `scripts/send-test-mail.ts` | **Neu** — CLI-Skript für manuelle Verifikation. Argumente: `<empfänger-email>`. Liest `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` aus ENV. Ruft `payload.sendEmail()` einmal mit fest verdrahteter Testnachricht. |
| `.env.example` | **Neu** — checked-in. Dokumentiert alle ENV-Vars inkl. der optionalen Mail-Vars, mit Leerwerten und Kommentaren. |
| `README.md` | Neuer Abschnitt „Mail-Setup" mit Verweis auf Setup-Reihenfolge in dieser Spec |
| `CONTRIBUTING.md` | Hinweis „Dev läuft ohne `RESEND_API_KEY` — Mails werden in Console geloggt. Für manuellen Mail-Test siehe `scripts/send-test-mail.ts`." |
| `tests/unit/mail-config.test.ts` | **Neu** — Unit-Tests für die conditional Adapter-Registration |
| `tests/integration/mail-send.test.ts` | **Neu** — Integration mit `vi.mock('resend')` |

**Keine Migration** — Mail-Adapter ist Payload-Config-only, kein DB-Schema-Change.

**Keine CSS- oder UI-Änderung** — V1.3a ist reine Infrastruktur.

## 6. Setup-Reihenfolge

Fünf Schritte, manuelle Klicks und Repo-Arbeit verschränkt. Oliver führt die Dashboard-Klicks, Claude führt durch die Schritte und macht die Repo-Änderungen.

### Schritt 1 — Cloudflare Email Routing (manuell)

1. Cloudflare-Dashboard → Account auswählen → `pflegeatlas.org` → Email → Email Routing
2. „Enable Email Routing" → Cloudflare setzt MX-Records automatisch
3. Custom Address `redaktion@pflegeatlas.org` anlegen → Action: „Send to an email" → Olivers Gmail eintragen → Verify-Mail an Olivers Gmail bestätigen
4. (Sobald Christoph seine Wunsch-Empfangs-Mailbox nennt) Zweite Forward-Destination zu `redaktion@…` hinzufügen für Christoph
5. Custom Address `mitmachen@pflegeatlas.org` mit gleichen Zielen anlegen
6. Smoketest: von externer Adresse Mail an `redaktion@pflegeatlas.org` → kommt in Olivers Gmail an

### Schritt 2 — Resend-Account + Domain-Verifikation (manuell)

1. resend.com → Account erstellen (Oliver, geteilte Credentials in 1Password/Bitwarden ablegen)
2. Domain `pflegeatlas.org` hinzufügen → Resend zeigt drei DNS-Records:
   - SPF (TXT-Record, ergänzt evtl. existierenden SPF von Cloudflare Email Routing)
   - DKIM (TXT- oder CNAME-Record)
   - DMARC (TXT-Record)
3. Records bei Cloudflare DNS einfügen — Resend gibt exakte Werte
4. Resend-Domain-Verifikation abwarten (typisch 5-30 Min, max einige Stunden bei DNS-Propagation)
5. API-Key generieren → in 1Password/Bitwarden sicher ablegen → **niemals** ins Repo committen
6. Sobald Status „verified": weiter zu Schritt 3

### Schritt 3 — Repo-Änderungen (Claude, auf Branch `feat/v1-3a-mail-infra`)

1. Neuen Branch von `main` anlegen
2. `pnpm add @payloadcms/email-resend`
3. `src/payload.config.ts` mit conditional `email`-Block ergänzen
4. `scripts/send-test-mail.ts` schreiben
5. `.env.example` erstellen
6. README und CONTRIBUTING aktualisieren
7. Vitest-Tests schreiben (Unit + Integration mit Mock)
8. Lokal: `pnpm test`, `pnpm lint`, `pnpm build` grün

### Schritt 4 — Verifikation lokal (Oliver+Claude)

1. Ad-hoc:
   ```bash
   RESEND_API_KEY=re_xxx \
   RESEND_FROM_ADDRESS=noreply@pflegeatlas.org \
   pnpm tsx scripts/send-test-mail.ts redaktion@pflegeatlas.org
   ```
2. Resend-Dashboard: Send sichtbar? Status `delivered`?
3. Olivers Gmail-Inbox: Mail angekommen? **Auch im Spam-Ordner prüfen** (DMARC/SPF-Pannen sind häufig beim ersten Setup)
4. Wenn nicht angekommen: DNS-Propagation abwarten, SPF-Record auf Konflikte prüfen, Resend-Logs checken

### Schritt 5 — PR + Merge

1. Commits pushen auf `feat/v1-3a-mail-infra`
2. PR gegen `main`, CI muss grün (läuft ohne API-Key, nutzt Console-Pfad)
3. Merge nach grünem CI, Branch löschen
4. Memory-Update: V1.3a fertig, V1.3b kann starten

## 7. Test-Strategie

Drei Test-Kategorien, gleiche Vitest-Infrastruktur wie V1:

**Unit-Tests** (`tests/unit/mail-config.test.ts`):

- Wenn `RESEND_API_KEY` nicht in ENV → Payload-Config hat `email: undefined`
- Wenn `RESEND_API_KEY` in ENV (Test-Mock) → Payload-Config hat `email` als `resendAdapter`-Instance mit korrekten From-Werten

**Integration-Test** (`tests/integration/mail-send.test.ts`):

- `vi.mock('resend')` mockt die Resend-API
- Mit gesetztem Mock-Key: `payload.sendEmail({ to, subject, html })` löst Mock-Resend-Call mit den erwarteten Argumenten aus
- Ohne Key: `payload.sendEmail()` läuft durch Console-Path, Mock-Resend wird **nicht** aufgerufen

**Manuelle Verifikation** (kein automatischer Test):

- Schritt 4 oben — echtes Resend wird einmal angesprochen, Mail kommt physisch an, DNS-Records sind korrekt
- Nicht in CI; nicht reproduzierbar ohne Production-Credentials

## 8. Verifikations-Kriterien

V1.3a ist fertig wenn:

- [ ] Cloudflare Email Routing aktiv, `redaktion@` und `mitmachen@` forwarden an Empfangs-Mailboxen, Smoketest „externe Mail kommt an" erfolgreich
- [ ] Resend-Domain `pflegeatlas.org` Status `verified`
- [ ] `src/payload.config.ts` hat conditional `email`-Block, ohne API-Key default zu Console
- [ ] `scripts/send-test-mail.ts` existiert und sendet einmalig erfolgreich an `redaktion@…`, sichtbar in Resend-Dashboard und in Empfangs-Mailbox
- [ ] `.env.example`, README und CONTRIBUTING dokumentieren das Setup
- [ ] Unit- und Integration-Tests grün; CI grün auf dem Branch ohne API-Key
- [ ] PR gegen `main` gemerged, Branch entfernt

## 9. Out-of-Scope und Folge-Themen

Ausdrücklich nicht in V1.3a, sondern in späteren Plänen:

- **Submission-Formular und seine Notification-Mail** — V1.3b
- **Submitter-Bestätigungs-Mail** („Danke, deine Submission ist eingegangen") — optional, V1.3b oder später
- **Auth-relevante Mail-Templates** (forgotPassword, emailVerification) — Auth-Plan, würden den V1.3a-Adapter automatisch nutzen, brauchen aber separate Template-Definitionen und Auth-Wiring
- **Editor-Einladungs-Mails** — Auth + Roles + Editorial Workflow
- **Mailbox-Hierarchie** (`hallo@`, `system@` etc.) — als Cloudflare-Routing-Nachträge jederzeit möglich, kein Code-Impact
- **Production-Deployment der ENV-Vars** — Deployment-Plan
- **Bounce-Handling / Suppression-List-Sync** — Resend hat eingebautes Bounce-Tracking; ein Plan dafür kommt nur wenn Bounce-Volumen relevant wird
- **Outbound-Replies aus Pflegeatlas-Mailbox** (z.B. Christoph antwortet als `redaktion@…`) — würde eine echte Mailbox-Lösung statt reines Forwarding erfordern (Cloudflare Email Workers oder externes Hosted Postfach)
