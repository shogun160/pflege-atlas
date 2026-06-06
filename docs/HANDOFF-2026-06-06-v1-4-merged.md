# Handoff — PflegeAtlas V1.4 strukturierte Submissions shipped

**Datum:** 2026-06-06
**Vorherige Session:** siebte Session, lange Implementations-Runde mit Browser-Bug-Fixes am Ende
**Status:** V1.4 ist gemerged. Strukturierte Submissions, Lexical-Editor, Section-Picker-Korrektur, Per-Section-Edit-Links. Wartet auf Plan-Wahl für V1.5+.

---

## Repo-Stand

- Working tree: `/Users/oliverwosnitza/pflege-brainstorm`
- Remote: https://github.com/shogun160/pflege-atlas (public)
- Branch: `main`, HEAD: **`854c01f`** (Merge V1.4)
- CI grün, 138/138 Tests, Build sauber
- Dev-Server stoppt nach Session (Postgres läuft via Docker)

## Was steht im Memory (NICHT duplizieren)

Diese Stellen lesen statt diesen Handoff dauernd zu durchblättern:

- `~/.claude/projects/-Users-oliverwosnitza/memory/MEMORY.md` — Pointer-Index
- `~/.claude/projects/-Users-oliverwosnitza/memory/project_pflegeatlas.md` — kompletter V1.4-Stand inkl. aller Plan-Deviations, Lessons (Lexical-Shape, Version-Pin, Migrate-CLI-Hang, next/dynamic-Mock), DSGVO-Anforderungen
- `~/.claude/projects/-Users-oliverwosnitza/memory/reference_pflegeatlas_docs.md` — Pfade zu Specs, Plänen, Code-Files

Im Repo, Spec + Plan für V1.4:
- Spec: `docs/superpowers/specs/2026-06-06-pflegeatlas-structured-submissions-v1-4-design.md`
- Plan: `docs/superpowers/plans/2026-06-06-pflegeatlas-structured-submissions-v1-4.md` (15 Tasks)
- PR #4: https://github.com/shogun160/pflege-atlas/pull/4

---

## Projektplan: wo stehen wir

### Erledigt (auf `main`)

| Version | Commit | Was |
|---|---|---|
| **V1.0 Core Foundation** | `bb0dc60` | Payload + Postgres + Articles-Collection + Frontend-Stub |
| **V1.1 Visual Polish** | `83fafbf` | Brand Logo + Wordmark + Tokens + Mitmach-Flow-Stub + Markenwechsel zu PflegeAtlas |
| **V1.2 Hygiene-Sprint** | `af881e3` | Footer-Link, Logo-WebP, SectionLabel-Helper, Migration-Konsolidierung |
| **V1.3a Mail-Infra** | `27e160f` | Cloudflare Email Routing + Resend + conditional Adapter |
| **V1.3b Submission-Form** | `0f1abd5` | Zod + Turnstile + Server Action + Mail-Notification, gov.uk-ErrorSummary |
| **V1.4 Strukturierte Submissions** | `854c01f` | Lexical-Editor + Section-Picker + Schema-Migration + Per-Section-Edit-Links |

### Offen (nach Priorität, Reihenfolge ist nicht fix)

**Track A — Funktionale Folgepläne**

| Plan | Was | Brainstorming nötig? | Spec? | Plan? |
|---|---|---|---|---|
| **V1.5 Submissions-als-PRs** | Submission zusätzlich als GitHub-PR exportieren, Mail mit Kurzzusammenfassung + PR-Link, GitHub als Review-Backbone. Strategische Frage: GitHub vs. Payload-Admin als Review-UI. Open Question: Articles im Repo spiegeln (für echten Diff), Bot-Auth (PAT vs. GitHub App), DSGVO-Trennung (PII bleibt in DB). | ✓ ja | nein | nein |
| **V1.6 Editorial-Workflow + Auth** | Better-Auth, Roles, Review-Queue, RichText-Lexical-Editor im Admin. Überschneidet sich mit V1.5 — wenn GitHub als Review-Backbone gewählt wird, schrumpft Editorial deutlich. | ✓ ja | nein | nein |
| **Meilisearch-Suche** | Header-Suchfeld aktivieren, Search-Stub im Hero. Eigenständig planbar. | (klein) | nein | nein |

**Track B — Pflicht vor Production-Launch**

| Plan | Was | Pri |
|---|---|---|
| **DSGVO-Track** | Datenschutzerklärung, Impressum, AVV mit Cloudflare/Resend/Postgres-Hoster, Aufbewahrungs-Konzept, Recht auf Auskunft/Löschung. Keine Cookies → kein Banner. E-Mail-Feld bleibt optional. | hoch (vor Production-Launch) |
| **Deployment-Setup** | Production-Domain (`pflegeatlas.org`), Postgres-Hoster, Resend-Production-Keys, Turnstile-Production-Site, ENV-Var-Pflege, Backup-Strategie | hoch (vor Public-Launch) |

**Track C — Nice-to-have / Future**

- GitHub-Mirror-Cron für Content-Backup
- Plausible Analytics (cookie-frei → keine DSGVO-Komplikation)
- V2 QM-Tool (Christophs QM-System als proprietäres Produkt für Pflegedienste)
- HTML-Mail-Variante (alternativ zu V1.5 PR-Workflow)
- Admin-UI-Diff-Tool für Korrektur-Reviews (wenn nicht via PR-Workflow gelöst)

**Track D — Hygiene-Kandidaten (akkumuliert)**

- `mitmachen@pflegeatlas.org` einrichten oder im README abschwächen
- IntentCards + Mitmach-Section a11y-Double-Announce via `aria-labelledby`
- Wordmark-Component evtl. deprecated (Header trägt Logo)
- Mobile-Sidebar-Trigger über Logo-Klick
- `toLocaleDateString('de-DE')` Locale-Abhängigkeit fixen (`artikel/[slug]/page.tsx:59`)
- JSON-LD-Script `createdAt`/`updatedAt` Date-vs-String konsistent
- Doppelte Payload-Query pro Artikel-Render (React `cache()` einsetzen)
- Mobile-Edit-UX (Lexical-Editor auf Touch ist mittelmäßig — V1.4-Annahme: Beitragen passiert am Desktop)

---

## Erste Aktionen in der nächsten Session

1. **Memory lesen** (`MEMORY.md` → `project_pflegeatlas.md` → `reference_pflegeatlas_docs.md`) — passiert automatisch
2. **Diesen Handoff lesen** für Projektplan-Überblick
3. **Plan-Wahl mit Oliver klären:** V1.5 (PR-Workflow), DSGVO-Track, V1.6 (Auth/Editorial), Meilisearch, oder Hygiene-Sprint?
4. **Bei großem Plan (V1.5/V1.6):** `superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:subagent-driven-development`
5. **Bei kleinem Plan (Meilisearch, Hygiene):** ggf. direkt brainstorming, Plan kürzer halten

---

## V1.4-Lessons (für künftige Plans relevant)

1. **Lexical-Shape Boundary:** Editor liefert `{root:{...}}`, einige Walker erwarten bare Root. `unwrapLexicalRoot()` in `src/lib/lexical-unwrap.ts` an allen Boundaries aufrufen (Schema-Refine, Sanitize, Dirty-Check, Mail-Render).
2. **Lexical-Version-Pin:** Payloads `dependencyChecker` zwingt Version-Parität mit `@payloadcms/richtext-lexical`. Bei Lexical-Update vorher Payload-Release prüfen.
3. **Payload-Migrate-CLI hängt auf non-TTY:** `pnpm payload migrate:create` und `pnpm payload migrate` hängen in dieser Shell. Workaround: Migration manuell nach init.ts-Format schreiben, via `psql` applien, `payload_migrations`-Row manuell inserten. `migrate:status` reflektiert das korrekt.
4. **`next/dynamic` in jsdom-Tests:** Lazy-importierte Components bleiben im Loading-State. Test-Mock: `vi.hoisted` MockEditor + `vi.mock('next/dynamic', () => ({ default: () => MockEditor }))`.
5. **Build temporär broken zwischen Tasks ist OK,** wenn Tests + Lint grün bleiben und jeder Commit dokumentiert, was offen ist. Vermeidet künstliches Stages-of-Workarounds, das später wieder rausgehauen werden müsste.
6. **Empty-String aus Hidden-Input ist nicht `undefined`:** Zod `.optional()` greift nicht für leere Strings. Pattern: `.or(z.literal(''))` wrappen, oder `superRefine` für Cross-Field-Logik.
7. **Lexical-Sanitize muss Sicherheits-Whitelist sein,** nicht nur eine Toolbar-Reflektion. URL-Filter (`https?:|mailto:|#`) + Max-Length + Format-Bitmask-Mask sind nötig — manipulierte Form-Submits sind ein realer Vektor.
8. **Turnstile-Dev-Bypass muss client- UND server-side passen.** Beide Pfade müssen an dieselben ENV-Vars gekoppelt sein, sonst sieht UX im Dev unsinnig aus oder Production akzeptiert versehentlich ungültige Tokens.

---

## V1.5-Vorklärungen (am 2026-06-06 entschieden)

Wenn V1.5 (Submissions-als-PRs) die nächste Plan-Wahl wird, sind diese vier Punkte schon geklärt — Brainstorming kann darauf aufsetzen:

1. **GitHub-Auth: GitHub App unter Personal Account `shogun160`** (kein Org-Move, kein Bot-User-Account)
   - Permissions: Contents R/W, Pull Requests R/W, Metadata R (per-Repo)
   - Private Key als `.pem`-Datei in 1Password, in Production als base64-ENV-Var
   - ENV-Vars: `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`
   - Library: `@octokit/auth-app` + `@octokit/rest`
   - Christoph bleibt wie heute Write-Collaborator (`primus-homeassistant`)
   - Org-Move (`github.com/pflegeatlas/...`) bewusst auf später verschoben — würde sich lohnen, wenn V2 QM-Tool als eigenes Repo kommt

2. **Articles als Markdown im Repo gespiegelt** (`content/articles/<slug>.md`)
   - Frontmatter mit title/intent/summary/lastReviewedAt/standardsBound
   - Body: 4 Sektionen als Markdown-Headings (`## Definition`, etc.)
   - Sync-Layer: Lexical→Markdown beim Article-Save (Payload-Hook oder Cron); reduzierte Toolbar (Bold/Italic/Listen/Links) ist verlustfrei mappbar
   - Bei Lexical-Version-Updates: Sync-Layer testen, weil JSON-Format driften kann

3. **PR-DSGVO: Submission-ID-Verlinkung**
   - PR-Body enthält Link auf Payload-Admin (`/admin/collections/submissions/<id>`)
   - **Keine** PII (submitterName, submitterEmail) im PR-Body oder Commit-Metadaten
   - `correctionReason` darf rein (fachliche Begründung, kein PII per se — aber bei V1.5-Spec nochmal explizit checken)
   - Submitter-Daten bleiben in der DB, Christoph kontaktiert via Admin

4. **Merges: Oliver + Christoph**
   - Christoph behält `write`-Permission, darf Inhalts-PRs (von Submissions) selbst mergen
   - Oliver bleibt für Code-PRs zuständig
   - Lightweight-Konvention im CONTRIBUTING.md statt formaler CODEOWNERS-Datei

## Sonst kein Erzwungenes

- Stand ist sauber, V1.4 ist auf `main`.
- Plan-Wahl in einer Woche völlig offen — auch DSGVO-Track oder Meilisearch sind valide statt V1.5.

## Repo-Convention

Bisherige Handoffs liegen unter `docs/HANDOFF-YYYY-MM-DD-<topic>.md` (siehe `docs/HANDOFF-2026-06-05*.md` und `docs/HANDOFF-2026-06-06-v1-3b-merged.md`).
