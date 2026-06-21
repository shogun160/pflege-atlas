# PflegeAtlas V1.7 — Deployment + DSGVO-Texte (Phase 1: Vercel/Neon)

**Status:** Design freigegeben, Plan-Erstellung als nächstes
**Brainstorm-Session:** 2026-06-21 (neunzehnte Session)
**Vorgänger:** V1.6 (Editorial-Workflow + Auth) auf `main` (`8044cac`)
**Geplanter Branch:** `feat/v1-7-deployment-dsgvo`
**Release-Gate aufhebend:** ja, dieser Track hebt das V1.6-DSGVO-Release-Gate auf

---

## 1. Executive Summary

V1.7 bringt die Plattform produktiv live — mit DSGVO-konformen Pflichttexten (Impressum + Datenschutzerklärung), Auftragsverarbeiter-Sammlung, einem Aufbewahrungs-Konzept inkl. Cron-Job für rejected-Submissions, Cloudflare R2 als Media-Storage und einem Two-Phase-Hosting-Pfad: **Phase 1 (Vercel Hobby + Neon Free) = 0 € laufende Kosten**, mit dokumentiertem Migrations-Pfad zu **Phase 2 (Hetzner CX22 + Coolify, ~4.51 €/Monat) als späterer Sub-C-Track**, sobald Quotas erreicht oder Verein/UG gegründet ist.

Dieser Track umfasst die kombinierten Sub-Projekte **A (Deployment-Infra)** und **B (DSGVO-Texte)** aus der Brainstorm-Decomposition. Sub-C (DSGVO-Code-Härtung: Articles-Export-Pagination, Audit-Log, Hard-Delete-Policy für Right-to-Erasure) bleibt separates späteres Track.

---

## 2. Scope

### In Scope
- **Hosting Phase 1:** Vercel Hobby (Frankfurt fra1) + Neon Free (eu-central-1) + Cloudflare R2 (EU)
- **Media-Storage-Adapter:** Cloudflare R2 via `@payloadcms/storage-s3`
- **DSGVO-Pflichttexte:**
  - `/impressum`-Page (§ 5 DDG-Pflichtangaben für Joint-Controller Oliver + Christoph)
  - `/datenschutz`-Page (datenschutz-generator.de-Output + Custom-Sections für V1.5/V1.6-Eigenheiten)
- **Joint-Controller-Vereinbarung** (internes Doc, Art. 26 DSGVO)
- **Auftragsverarbeiter-Sammlung** (Vercel/Neon/Cloudflare/Resend/GitHub mit Schrems-II/EU-DPF-Erläuterung)
- **Aufbewahrungs-Konzept** mit Cron-Job für rejected-Submissions (30 Tage Auto-Delete)
- **Cloudflare Web Analytics** (cookieless, kein Banner nötig)
- **`datenschutz@pflegeatlas.org`-Email-Route** via Cloudflare Email Routing
- **README + Deployment-Runbook**
- **Migration-Notizen** für späteren Phase-2-Switch zu Hetzner+Coolify

### Out of Scope (Sub-C oder spätere Tracks)
- Articles-Export-Pagination (V1.6-Backlog, Sub-C)
- Audit-Log-Collection (V1.6-Spec defer, Sub-C)
- Hard-Delete-Policy für Right-to-Erasure (V1.6-Spec defer, Sub-C)
- Phase-2-Migration zu Hetzner+Coolify (eigener kleiner Track)
- Sentry/Error-Tracking (Phase-2-Backlog, vorerst Vercel-Logs)
- Plausible/Analytics-Upgrade (vorerst CF Web Analytics)
- Verein/UG-Gründung (außerhalb Codebase-Scope)

---

## 3. Brainstorm-Entscheidungen (Audit-Trail)

8 Hauptfragen + Architektur-Approach-Wahl:

| # | Frage | Wahl | Begründung |
|---|---|---|---|
| 1 | Hosting Phase 1 | Vercel Hobby + Neon Free | 0 € laufend, schneller Live-Gang, später Hetzner-Migration als Sub-Plan |
| 2 | Media-Storage | Cloudflare R2 (10 GB free) | EU-verfügbar, S3-API, Phase-2-tauglich (R2 bleibt) |
| 3 | Verantwortliche Stelle | Gemeinsam (Oliver + Christoph), später Verein/UG | passt zu Joint-Editorial-Workflow; UG-Wechsel mit V2 QM-Tool |
| 4 | Datenschutzerklärung-Strategie | datenschutz-generator.de + Custom-Sections | 0 €, etablierter Schwenke-Generator, Custom-Teile für V1.5/V1.6-Spezifika |
| 5 | Analytics + Cookie-Banner | CF Web Analytics (cookieless) → kein Banner | passt zu CF-Stack, free, DSGVO-konform |
| 6 | Aufbewahrung | wie vorgeschlagen, rejected Submissions 30 Tage (statt 90) | Datensparsamkeit, schnellere Auto-Cleanup |
| 7 | DSGVO-Anfragen-Adresse | `datenschutz@pflegeatlas.org` (neue CF-Route, Forward an Oliver + Christoph) | signalisiert Ernsthaftigkeit, getrennt von redaktion@ |
| 8 | Error-Tracking | Vercel-Logs only (Sentry später) | DSGVO-Aufwand minimal, V1.5 GitHub-Sync-Risiko bewusst akzeptiert |
| – | Implementation-Reihenfolge | A (Bundled: alles in einem Sprint + PR + Go-Live) | rechtlich konsistent von Tag 1, Komponenten hängen eng zusammen |

---

## 4. Architektur

### Phase-1-Übersicht

```
USER (Browser)
   │ HTTPS
   ▼
Cloudflare Edge (DNS + CDN + Turnstile + Web Analytics)
pflegeatlas.org → CNAME → Vercel
   │
   ▼
VERCEL (Hobby, Frankfurt fra1)
Next.js 16 + Payload CMS Admin + Serverless Functions + Static Pages
   │              │              │              │
   │ Postgres     │ Mail         │ Storage      │ Repo-Sync
   ▼              ▼              ▼              ▼
NEON Free      RESEND         CF R2          GITHUB App
eu-central-1   EU Route       EU bucket      (V1.5 PR-Mirror)
Postgres       Mail-API       Object Store
```

**Eingehende Mails (unverändert + neue Route):**
- `redaktion@pflegeatlas.org`
- `mitmachen@pflegeatlas.org`
- `datenschutz@pflegeatlas.org` (neu)

→ alle via Cloudflare Email Routing → Forward an Oliver (oliver.wosnitza@gmail.com) + Christoph (christoph.brueck@gmail.com)

**Cron:**
- Vercel Cron Daily 03:00 UTC → `/api/cron/cleanup-submissions`
- Logik: löscht `submissions` mit `reviewStatus=rejected AND updatedAt < now - 30d`
- Auth: Bearer-Header mit `CRON_SECRET`

### Auftragsverarbeiter-Tabelle (für Datenschutzerklärung + AVV-Sammlung)

| Provider | Funktion | Sitz | DPA | Rechtsgrundlage | Schrems-II |
|---|---|---|---|---|---|
| Vercel Inc. | Hosting, Edge-CDN, Server-Logs | US | online verfügbar, EU-DPF zertifiziert | Art. 6(1)(f) Hosting-Schutz | EU-US DPF |
| Neon, Inc. | Postgres-DB (eu-central-1) | US | online, EU-DPF zertifiziert | Art. 6(1)(f) Hosting | EU-US DPF |
| Cloudflare, Inc. | DNS, Email Routing, R2, Turnstile, Web Analytics | US | online, EU-DPF zertifiziert | Art. 6(1)(f) Schutz/Funktion | EU-US DPF + EU-Datenresidenz für R2 + CF Web Analytics |
| Resend, Inc. | Mail-Versand | US | online, EU-DPF zertifiziert | Art. 6(1)(b) Vertragsdurchführung | EU-US DPF |
| GitHub, Inc. (Microsoft) | Repo-Mirror für Submissions (V1.5) — **Empfänger nach Art. 13(1)(e)**, nicht klassischer Auftragsverarbeiter, da Veröffentlichungsplattform | US | online, EU-DPF zertifiziert (über Microsoft) | Art. 6(1)(f) Open-Source-Zweck + Einwilligung via PII-Notice im Submission-Form | EU-US DPF |

---

## 5. Code-Komponenten + Tasks

### Pre-Tasks (manuell via Browser-Dashboards)

| # | Was | Wo | Dauer | Output |
|---|---|---|---|---|
| P1 | Cloudflare Email Routing → `datenschutz@pflegeatlas.org` → Forward an Oliver + Christoph | Cloudflare-Dashboard → Email Routing | 2 min | neue Route aktiv |
| P2 | Cloudflare R2 → Bucket `pflegeatlas-media` (EU-Region), S3-API Access-Key | Cloudflare-Dashboard → R2 | 5 min | Bucket-URL + Access-Key + Secret-Key in 1Password |
| P3 | Vercel-Account → neues Projekt, GitHub-Repo verbinden | Vercel-Dashboard | 5 min | Project-ID + Deployment-Hooks |
| P4 | Neon-Account → neues Projekt (eu-central-1), Connection-String | Neon-Dashboard | 5 min | `DATABASE_URI` |
| P5 | Cloudflare Web Analytics → neue Site, JavaScript-Beacon-Token | Cloudflare-Dashboard → Analytics | 3 min | `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` |
| P6 | Cloudflare DNS → CNAME `pflegeatlas.org` + `www` auf Vercel | Cloudflare-Dashboard → DNS | 5 min | **erst am Go-Live-Tag** |

### Code-Tasks (TDD)

| # | Titel | Hauptdateien | Tests |
|---|---|---|---|
| **T1** | R2-Storage-Adapter | `src/payload.config.ts`, `package.json` (deps: `@payloadcms/storage-s3` + peer `@aws-sdk/client-s3`), `.env.example` | Unit: ENV leer → Local-FS-Fallback; ENV gesetzt → S3-Adapter konfiguriert |
| **T2** | Vercel-Build-Config | `vercel.json` (Build-Command, Region fra1, Functions-Config), `package.json` (postbuild → `pnpm payload migrate`), `.env.example` (Production-Sektion) | Build local mit `vercel build` |
| **T3** | `/impressum`-Page | `src/app/(frontend)/impressum/page.tsx` (Server-Component, Static) | Component: Pflichtangaben rendern (Klarnamen, Adressen, `datenschutz@`-Mail, MStV-§-18(2)-Verantwortliche) |
| **T4** | `/datenschutz`-Page | `src/app/(frontend)/datenschutz/page.tsx` (Server-Component, Static) | Component: alle Provider gelistet, Aufbewahrungs-Tabelle, JCA-Hinweis, Betroffenenrechte-Abschnitt |
| **T5** | Cron-Job: rejected-Submissions-Cleanup | `src/app/api/cron/cleanup-submissions/route.ts`, `vercel.json` (cron-block 03:00 UTC), `.env.example` (`CRON_SECRET`) | Unit: Date-Math 30-Tage-Cutoff; Integration: Auth-Header-Check, Selektions-Logik (3 Sample-Submissions), Idempotenz |
| **T6** | Cloudflare Web Analytics Script | `src/app/(frontend)/layout.tsx`, neue `src/components/CloudflareAnalytics.tsx`, `.env.example` (`NEXT_PUBLIC_CF_ANALYTICS_TOKEN`) | Component: Token gesetzt → Script rendert; Token leer → kein Script; nur in `NODE_ENV=production` |
| **T7** | Joint-Controller-Vereinbarung | `docs/legal/joint-controller-agreement-2026.md` (neu) | – (reines Dokument) |
| **T8** | README + Deployment-Runbook | `README.md` (Phase-1-Hosting-Sektion), `docs/DEPLOYMENT.md` (neu) | – |
| **T9** | Smoke-Test-Checkliste | `docs/V1.7-DEPLOYMENT-SMOKE.md` (neu) | – (manuelle Checkliste) |
| **T10** | PR + Go-Live | – | – |

### Dateien-Übersicht

**Neu erstellt:**
- `src/app/(frontend)/impressum/page.tsx`
- `src/app/(frontend)/datenschutz/page.tsx`
- `src/app/api/cron/cleanup-submissions/route.ts`
- `src/components/CloudflareAnalytics.tsx`
- `vercel.json`
- `docs/DEPLOYMENT.md`
- `docs/V1.7-DEPLOYMENT-SMOKE.md`
- `docs/legal/joint-controller-agreement-2026.md`
- `tests/unit/storage-config.test.ts`
- `tests/unit/cleanup-cutoff.test.ts`
- `tests/component/Impressum.test.tsx`
- `tests/component/Datenschutz.test.tsx`
- `tests/component/CloudflareAnalytics.test.tsx`
- `tests/integration/cleanup-cron.test.ts`

**Modifiziert:**
- `src/payload.config.ts` (R2-Adapter wiring)
- `src/app/(frontend)/layout.tsx` (CF Analytics Script-Tag)
- `package.json` (Dependencies + postbuild)
- `.env.example` (Production-Sektion erweitert)
- `README.md` (Hosting-Sektion)

---

## 6. Datenfluss / DSGVO-Daten-Map

### A) Anonymer Public-Visitor

| Daten | Provider | Rechtsgrundlage | Aufbewahrung |
|---|---|---|---|
| IP-Adresse (Request-Routing) | Cloudflare Edge | Art. 6(1)(f) Schutz/Anti-DDoS | flüchtig, CF-Default ≤30 Tage |
| Aggregate (PV, Country, Device) | CF Web Analytics | Art. 6(1)(f) | 6 Monate, keine PII |
| Server-Function-Logs (IP + Path) | Vercel | Art. 6(1)(f) | 1h Hobby-Default |

### B) Submission-Einreicher

| Daten | Provider | Rechtsgrundlage | Aufbewahrung |
|---|---|---|---|
| Submission-Inhalt (Titel, Sektionen, Quellen) | Neon | Art. 6(1)(b) Vertragsanbahnung + 6(1)(f) Editorial | accepted: dauerhaft; rejected: 30 Tage; pending: dauerhaft bis Review |
| E-Mail (optional) | Neon | Art. 6(1)(b) + Einwilligung | mit Submission |
| Submission-Notification-Mail | Resend | Art. 6(1)(b) | Resend-Logs 30 Tage |
| Turnstile-Verification | Cloudflare | Art. 6(1)(f) Spam-Schutz | flüchtig |
| **Bei Accept:** Markdown-Mirror als GitHub-PR (öffentlich) | GitHub | Art. 6(1)(f) + Einwilligung via PII-Notice | dauerhaft öffentlich, irreversibel |

### C) Eingeloggte User

| Daten | Provider | Rechtsgrundlage | Aufbewahrung |
|---|---|---|---|
| Account (E-Mail, Passwort-Hash, Rolle, Profil, Avatar-Ref) | Neon | Art. 6(1)(b) Nutzungsvertrag | bis Account-Löschung |
| Session-Cookie | Browser + Vercel | Art. 6(1)(b) | Session-Lifetime (V1.6: 24h) |
| Login-Failed-Counter | Neon | Art. 6(1)(f) Schutz | 10min Lock |
| Avatar-Upload | Cloudflare R2 | Art. 6(1)(b) | bis Account-Löschung |
| Audit-Trail (`submittedBy`, `currentReviewer`, `reviewedBy`) | Neon | Art. 6(1)(f) Editorial-Nachvollziehbarkeit | mit Submission/Article-Lebensdauer |

### D) Login-Workflow

| Daten | Provider | Rechtsgrundlage | Aufbewahrung |
|---|---|---|---|
| Invitation-/Reset-Token | Neon | Art. 6(1)(b) | 7d / 1h (V1.6) |
| Magic-Link-Mail | Resend | Art. 6(1)(b) | Resend-Logs 30 Tage |
| Rate-Limit-Bucket (in-memory) | Vercel-Function | Art. 6(1)(f) Anti-Enumeration | 10min |

### E) Account-Lifecycle

| Daten | Provider | Rechtsgrundlage | Aufbewahrung |
|---|---|---|---|
| Soft-Delete-Anonymisierung | Neon | Art. 6(1)(c) + 6(1)(f) Authorship-Erhalt | anonymisiert dauerhaft |
| Self-Service-Export | Vercel-Function → Browser-Download | Art. 6(1)(c) Art. 15+20 | flüchtig |
| Welcome-/Profile-Change-Mails | Resend | Art. 6(1)(b) | Resend-Logs 30 Tage |

### F) Joint-Controller-Verantwortlichkeiten (Art. 26)

| Bereich | Oliver | Christoph |
|---|---|---|
| Plattform-Code + Hosting + DB | verantwortlich | informiert |
| Inhalts-Reviews + Editorial | als Editor/Reviewer | als Editor/Reviewer |
| DSGVO-Anfragen-Bearbeitung | primär | unterstützt bei Inhalts-Themen |
| Sicherheits-Incidents | primär | informiert |

→ Formelles JCA-Dokument als `docs/legal/joint-controller-agreement-2026.md`.

### G) Ausserhalb der DSGVO-Verantwortung der Plattform

- **GitHub-PRs nach Annahme öffentlich + unwiderruflich.** Datenschutzerklärung muss explizit sagen: kein Recht auf Löschung des GitHub-Inhalts möglich, da CC-BY-SA-Lizenzierung + Open-Source-Repo-Verlauf.
- **Cloudflare Email Routing speichert nicht.** Leitet nur weiter, keine Persistenz. Oliver + Christoph Gmail-Konten sind eigene Verantwortlichkeit.

---

## 7. Fehlerbehandlung

| # | Fehlerfall | Strategie | User-sichtbar? |
|---|---|---|---|
| 1 | R2-Upload-Fehler | Payload-S3-Adapter wirft Error → Admin-UI-Toast. `console.error` → Vercel-Logs. Local-Dev fällt auf Filesystem zurück. | ja, Upload-Toast |
| 2 | Neon Cold Start (3-5s nach Idle) | Akzeptierter Trade-off Phase 1. Pool via `@neondatabase/serverless`. | erste Request langsam |
| 3 | Cron-Job-Fehler | try/catch, `console.error`. Idempotent → nächster Lauf holt nach. | nein |
| 4 | Vercel-Build-Migration-Fehler | Build bricht → kein Deploy. Vorherige Version bleibt. Notfall: 1-Klick-Rollback in Vercel. | nein (alte Version läuft weiter) |
| 5 | Mail-Versand-Fehler | V1.6-Pattern: try/catch + `console.warn`. DB-Operation läuft trotzdem. | nein |
| 6 | GitHub-Sync-Fehler (V1.5) | Bestehender Pattern: try/catch in afterChange-Hook, DB-Save rollt nicht zurück. Silent-Failure-Risiko bewusst akzeptiert (Sentry später). | nein |
| 7 | `datenschutz@`-Forwarder bricht | CF `Promise.allSettled` in `pflegeatlas-forwarder`-Worker; eine Destination-Failure ist tolerant. | nein |
| 8 | CF Web Analytics nicht erreichbar | `defer` + `async` Script-Tag → Plattform funktioniert ohne Tracking weiter. | nein |
| 9 | R2-Bucket-Quota >10 GB (Phase 1) | Free reicht für Avatare jahrelang. Bei Überschreitung: $0.015/GB-Monat akzeptabel. | nein |
| 10 | Neon-DB-Quota >0.5 GB | Trigger für Phase-2-Migration. Vorher-Warnung im Neon-Dashboard. | bei Überschreitung Write-Fehler |
| 11 | Vercel Hobby Bandwidth >100 GB/Monat | Bei statischem Wiki realistisch nicht erreicht (CF cached davor). Falls erreicht: Auto-Suspension → Phase-2-Trigger. | bei Überschreitung Service-Suspend |
| 12 | DNS-Cutover schiefgegangen | Go-Live-Runbook: erst `*.vercel.app` verifizieren, dann CNAME setzen, TTL abwarten, Smoke-Test. Notfall: DNS zurück auf alt (TTL 5min in CF). | ja, kurze Downtime möglich |
| 13 | Vercel-Hobby-ToS-Verstoß (Account-Suspension) | Risiko akzeptiert. Mitigation: V1.5 GitHub-Mirror als Backup aller Articles. Wöchentlicher `pg_dump` von Neon in 1Password-Vault (manueller Sonntag-Task). | ja, Service-Outage |

### Bewusst NICHT abgedeckt
- Automatische Sentry-Errors (Sub-C-Backlog)
- Auto-Failover (nicht Phase-1-Scope)

---

## 8. Testing-Strategie

Folgt V1.6-Pattern: Unit/Component im jsdom-Project, Integration im node-Project, manuelle Production-Smokes.

### Unit-Tests
- `storage-config`: ENV leer → Local-FS-Fallback; ENV gesetzt → S3-Adapter
- `cleanup-cutoff`: 30-Tage-Date-Math
- `CloudflareAnalytics`-Component: Token-Gate

### Component-Tests (jsdom)
- `Impressum`: Pflichtangaben rendern (Klarnamen Oliver+Christoph, Adressen, `datenschutz@`, MStV-§-18(2))
- `Datenschutz`: alle Provider gelistet, Aufbewahrungs-Tabelle, JCA-Hinweis, Betroffenenrechte
- `CloudflareAnalytics`: Token gesetzt → `<Script>` rendert; leer → nichts

### Integration-Tests (node)
- Cleanup-Cron Auth: richtiger Bearer → execution; falscher → 401
- Cleanup-Cron Selektion: 3 Sample-Submissions (rejected >30d / rejected <30d / accepted >30d) → nur erste wird gelöscht
- Cleanup-Cron Idempotenz: zweimal hintereinander → keine Fehler
- R2-Upload-Pfad: Mock S3-Client, verify `PutObjectCommand` mit korrekten Args

### Manuelle Production-Smokes (T9-Checkliste)
1. Vercel-Preview-URL: Login-Magic-Link → Mail kommt von Resend → Setzen-Passwort → Login funktioniert
2. Submission als anonymer Visitor: Turnstile success → DB-Eintrag → `redaktion@`-Notification-Mail
3. Avatar-Upload als Contributor: File landet in R2-Bucket (CF-Dashboard verifizieren)
4. Forgot-Password-Roundtrip: Mail kommt → Reset → Login
5. Cron manuell triggern via Vercel-Dashboard → Logs zeigen Cleanup-Output
6. CF Web Analytics: 1 Page-View vom eigenen Browser → CF-Dashboard zeigt Event innerhalb ~30s
7. `datenschutz@`-Mail-Forwarder: Test-Mail an `datenschutz@pflegeatlas.org` → Oliver + Christoph erhalten beide

### Bewusst NICHT in der Test-Suite
- Vercel/Neon/CF/Resend interne Verfügbarkeit (deren SLAs)
- DSGVO-juristische Korrektheit der Datenschutzerklärung (redaktionell, nicht technisch — Schwenke-Generator + Custom-Sections müssen menschlich gelesen werden)
- Schrems-II-Argument-Audit (Anwalts-Review-Backlog)

### Coverage-Ziel
Alle neuen Code-Module unit-tested, kritische Pfade integration-tested. Baseline 334 Tests bleibt grün; +12-18 Tests aus T1-T6.

---

## 9. Migration-Pfad zu Phase 2 (Hetzner+Coolify, später)

**Nicht Teil dieser Spec**, aber wir bauen so, dass der Wechsel klein bleibt. Separater Sub-Plan später.

### Bleibt unverändert
- Cloudflare-Stack (DNS, R2, Email Routing, Turnstile, Web Analytics)
- Resend (Mail)
- GitHub-App (V1.5-Mirror)
- App-Code (Next.js + Payload + Postgres-Adapter)
- `/impressum` (Verantwortliche identisch)
- JCA-Dokument

### Wechselt
| Aspekt | Phase 1 | Phase 2 | Aufwand |
|---|---|---|---|
| Hosting | Vercel Hobby | Hetzner CX22 + Coolify (~4.51 €/Monat) | 1 Bestellung + Coolify-Setup ~2h |
| Postgres | Neon Free | Coolify-managed Docker-Postgres | `pg_dump` + `pg_restore` ~30min |
| Cron-Job | Vercel Cron in `vercel.json` | Coolify Scheduled-Task ruft HTTP-Route via `curl` | Config-Switch, Route bleibt |
| Build/Deploy | Vercel auto-deploy | Coolify auto-deploy | – |
| DNS | CNAME → Vercel | A-Record → Hetzner-IP | DNS-Edit + TTL |
| ENV-Vars | Vercel-Dashboard | Coolify-Dashboard | Copy-Paste |
| Session-Cookies | gültig | invalidieren beim DNS-Switch | User loggen sich einmal neu ein |
| Server-Logs-Retention | Vercel 1h | Coolify per-Container (~7d) | Datenschutz-Update |

### Phase-1-Architektur-Disziplin
- Cron-Route ist Standard-Next-API-Route mit Bearer-Auth — kein Vercel-Specific. Coolify-Cron kann via `curl -H "Authorization: Bearer $CRON_SECRET"` triggern.
- R2-S3-Adapter ist Storage-agnostisch.
- Keine Vercel-Edge-Functions oder Vercel-spezifischen APIs in `src/`.
- `vercel.json` ist einzige Vercel-spezifische Datei; in Phase 2 ungenutzt aber harmlos.
- Migrations via `pnpm payload migrate` — funktioniert auf jeder Postgres-DB.

### Phase-2-Trigger
- Neon Free DB >0.5 GB (forced)
- Vercel Bandwidth >100 GB/Monat (forced)
- Verein/UG-Gründung
- DSGVO-Beruhigung: „deutsches Rechenzentrum" statt EU-DPF

### Geschätzter Phase-2-Aufwand
~4-6h eine Session.

---

## 10. Aufbewahrungs-Konzept (vollständig)

| Datenart | Aufbewahrung | Rechtsgrundlage | Implementation |
|---|---|---|---|
| Submissions accepted | dauerhaft | Art. 6(1)(f) Audit-Trail + Inhalt in GitHub | DB-Default |
| Submissions pending | dauerhaft bis Review | Art. 6(1)(b) | DB-Default |
| Submissions rejected | **30 Tage**, dann Auto-Delete | Art. 5(1)(c) Datensparsamkeit | T5 Cron-Job |
| User-Accounts aktiv | dauerhaft | Art. 6(1)(b) | DB-Default |
| User-Accounts soft-deleted | dauerhaft anonymisiert | Art. 6(1)(c) + Authorship | V1.6 `anonymizeUserPatch` |
| Vercel Server-Logs | 1h Hobby | Art. 6(1)(f) | Vercel-Default, nicht konfigurierbar |
| Neon Postgres-Backups | 7 Tage Point-in-Time | Art. 6(1)(f) | Neon Free-Default |
| Resend Mail-Logs | 30 Tage | Art. 6(1)(b) | Resend-Default |
| Cloudflare Email Routing (eingehend) | nicht persistiert | – | CF forward-only |
| Cloudflare Web Analytics | 6 Monate aggregiert | Art. 6(1)(f) | CF-Default, keine PII |
| GitHub-PR-Mirror | dauerhaft öffentlich | Art. 6(1)(f) + Einwilligung | Repo-Verlauf, irreversibel |
| Audit-Log (Sub-C, später) | 90 Tage | Art. 6(1)(f) | Sub-C-Implementation |

---

## 11. Release-Gate / Akzeptanz-Kriterien

V1.7 ist produktionsbereit (Phase 1) wenn:

- [ ] Alle T1-T10 Code-Tasks merged via PR auf main
- [ ] Alle 6 Pre-Tasks (P1-P6) ausgeführt, Credentials in 1Password
- [ ] Smoke-Test-Checkliste T9 vollständig durchgelaufen
- [ ] `/impressum` + `/datenschutz` öffentlich erreichbar mit Pflichtangaben
- [ ] AVV/DPA von Vercel + Neon + Cloudflare + Resend + GitHub archiviert (PDF in 1Password-Vault)
- [ ] JCA-Dokument committed
- [ ] Cron-Job läuft mind. einmal erfolgreich (Vercel-Logs verifiziert)
- [ ] DNS-Cutover abgeschlossen, `https://pflegeatlas.org` zeigt Vercel-Deployment

**Backlog post-V1.7:**
- Sub-C: Articles-Export-Pagination + Audit-Log + Hard-Delete-Policy
- Phase-2: Hetzner+Coolify-Migration (eigener kleiner Plan)
- Sentry-Integration (mit Phase 2 oder bei erstem Silent-Failure-Incident)
- Verein/UG-Gründung → Impressum-Update + JCA-Auflösung

---

## 12. Risiken + Mitigation

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| Vercel Hobby-ToS-Verstoß-Auslegung | gering-mittel | Account-Suspension, kurze Outage | GitHub-Mirror als Article-Backup, wöchentlicher pg_dump, kann auf Pro upgraden ($20/Monat) als Notfall |
| Schrems-III oder DPF-Außerkraftsetzung | gering kurzfristig | Datenschutzerklärung-Update + möglicher Phase-2-Forced-Switch | Phase-2-Architektur ist vorbereitet, Switch in 1 Session machbar |
| Neon Free Cold Start UX-Problem | hoch (deterministisch) | erste Request 3-5s langsam | dokumentiert; bei Beschwerden Trigger für Phase-2-Switch |
| DSGVO-Anfrage zu GitHub-PR-Inhalt | gering | rechtliches Risiko bei nicht-anonymen Inhalten | PII-Notice schon im Submission-Form; Datenschutzerklärung erklärt explizit Irreversibilität |
| Generator-basierte Datenschutzerklärung übersieht etwas | mittel | Abmahnungsrisiko | Custom-Sections decken V1.5/V1.6-Spezifika; anwaltliche Validierung als späteres Backlog-Item |
| DPF-Zertifizierungs-Status der Provider zur Implementierungszeit nicht aktuell | gering | Datenschutzerklärung-Text falsch | bei T4 jeden Provider auf dataprivacyframework.gov-Active-List verifizieren; falls nicht aktiv: SCCs als Rechtsgrundlage statt DPF |
| Vercel Hobby Cron-Limit (2 Jobs, 1x/Tag) | mittel | weiterer Cron-Bedarf in Sub-C blockiert | T5-Cron in Hobby OK (1 Job, daily); Sub-C-Audit-Log evtl. via Postgres pg_cron oder Phase-2-Wechsel triggern |
| Neon-Postgres-Connection-Pool-Inkompatibilität mit Payload-`pg`-Adapter | gering-mittel | Connection-Errors bei Cold Start oder hoher Concurrency | T2 verifiziert: Neon-Standard-Connection-String (mit `?sslmode=require`) funktioniert mit Payload-`pg`. Fallback: `@neondatabase/serverless` als Custom-Adapter-Wiring |
| Cron-Job löscht versehentlich nicht-rejected Submission | gering | Datenverlust | Integration-Test verifiziert Selektions-Logik; Neon Backup 7d ermöglicht Restore |
| R2-Credentials geleakt | gering-mittel | unauthorized Upload/Read | Credentials nur in Vercel-ENV + 1Password; Bucket-Policy beschränkt auf gesetzte API-Keys |

---

## 13. Implementation-Reihenfolge

Bundled-Approach (Brainstorm-Wahl A): alles in einem Sprint, ein PR, dann Go-Live.

Reihenfolge der Tasks im Plan:
1. **Pre-Tasks parallel** (P1-P5; P6 erst am Go-Live-Tag): Setup-Klicks, Credentials in 1Password
2. **T1 R2-Adapter** (zuerst, weil andere Tasks ENV erwarten)
3. **T2 Vercel-Build-Config** (vor Deploy nötig)
4. **T3-T4 DSGVO-Pages** (parallel, unabhängig)
5. **T5 Cron-Job** (unabhängig)
6. **T6 CF Analytics** (unabhängig)
7. **T7 JCA-Dokument** (parallel, reines MD)
8. **T8 README + Deployment-Runbook** (vor Smoke-Tests)
9. **T9 Smoke-Tests-Checkliste** (während Production-Smoke ausgeführt)
10. **T10 PR + Go-Live** (P6 DNS-Cutover als letzter Schritt)

Workflow: Subagent-Driven wie V1.6 (Implementer + Spec-Reviewer + Code-Quality-Reviewer pro Task).

---

## 14. Geschätzter Aufwand

Insgesamt geschätzt: **2-3 Sessions** mit Subagent-Driven-Workflow, ähnlich V1.3a (Mail-Infra, 2 Sessions) + V1.3b (Submission-Form, 2-3 Sessions).

Detaillierte Schätzung pro Task siehe Plan-Phase.
