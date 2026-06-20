# Handoff — PflegeAtlas V1.5 Submissions-als-PRs shipped

**Datum:** 2026-06-20
**Vorherige Session:** achte Session — Brainstorm + Spec + Plan + Subagent-Driven-Implementation + manueller Smoke-Test + PR + Merge in einer Session
**Status:** V1.5 ist auf `main`. Submission-Workflow erzeugt PR-Mirror im Repo, Article-Direkt-Edits syncen als direkter `main`-Commit. Wartet auf Plan-Wahl für V1.6+.

---

## Repo-Stand

- Working tree: `/Users/oliverwosnitza/pflege-brainstorm`
- Remote: https://github.com/shogun160/pflege-atlas (public)
- Branch: `main`, HEAD: **`d2d5b06`** (Merge V1.5, PR #9)
- CI grün, 221/221 Tests, Build sauber, 0 Lint-Errors / 35 Warnings
- Feature-Branch `feat/v1-5-submissions-as-prs` lokal gelöscht, remote nach Merge auch weg

## Was steht im Memory (NICHT duplizieren)

Diese Stellen lesen statt diesen Handoff dauernd zu durchblättern:

- `~/.claude/projects/-Users-oliverwosnitza/memory/MEMORY.md` — Pointer-Index
- `~/.claude/projects/-Users-oliverwosnitza/memory/project_pflegeatlas.md` — kompletter V1.5-Stand inkl. Architektur, Findings, V1.5-Lessons
- `~/.claude/projects/-Users-oliverwosnitza/memory/reference_pflegeatlas_docs.md` — Pfade zu Specs, Plänen, Code-Files
- `~/.claude/projects/-Users-oliverwosnitza/memory/project_pflegeatlas_homepage_community.md` — 8 Homepage-Hebel aus Brainstorm vom selben Tag, Contributor Stories vorgemerkt

Im Repo, Spec + Plan für V1.5:
- Spec: `docs/superpowers/specs/2026-06-20-pflegeatlas-submissions-as-prs-v1-5-design.md`
- Plan: `docs/superpowers/plans/2026-06-20-pflegeatlas-submissions-as-prs-v1-5.md`
- PR #9: https://github.com/shogun160/pflege-atlas/pull/9
- Brainstorm-Doc Homepage-Community: `docs/BRAINSTORM-2026-06-20-homepage-community-pull.md`

---

## Was wurde in der Session gemacht

### Brainstorm → Spec → Plan (vor der Implementation)

- 6 Designentscheidungen geklärt: Architektur **B'** (DB Source-of-Truth, PR ist Audit-Mirror), PR erst beim „In Review"-Klick (b), Article-Direkt-Edits per main-Commit (a), atomare Server-Actions (c), PII-Notice in Form (a), Mock-only-Tests + manueller Smoke (a).
- Spec geschrieben, Self-Review (2 Mehrdeutigkeiten gefunden + inline gefixt: Atomaritäts-Ordnung + `skipMarkdownSync`-Flag).
- 17-Task-Plan generiert (~3500 Zeilen), Pre-Task A für GitHub-App-Setup als parallel-Track.

### Subagent-Driven Implementation (17 Tasks)

Pro Task: Implementer-Subagent → Spec-Review → Code-Quality-Review → ggf. Fix-Loop.

| Task | Outcome |
|---|---|
| T1 deps | `d8a178a` + Engine-Field-Fix `a9407db` |
| T2 lexical-to-markdown | `a651711` |
| T3 article-markdown | `61b680b` + js-yaml JSON_SCHEMA fix `ab11f1c` + type widen `9b41802` |
| T4 slug-resolver | `ec7449d` |
| T5 env + boot-check | `ae6f7b6` + NEXT_PHASE test gap `8c473d0` |
| T6 octokit singleton | `e47070e` |
| T7 DB-migration | `ffa8456` (manueller psql-Path wegen non-TTY-CLI-Hang + macOS hat kein `timeout`) |
| T8 github-pr | `8243bb8` + deleteFile-cast + idempotency-note `d76fed9` |
| T9 github-article-sync | `8c66d14` |
| T10 mapper | `e5a9dc4` + throw-coverage `dbe5d3f` |
| T11 section-diff | `3d8e17c` |
| T12 server-actions | `e53b689` + multi-fix `1cdf6c9` + build-fix `69bfbe1` |
| T13 hooks | `b95663f` + visibility-logging `e2d33b2` |
| T14 admin-UI | `d9e37ca` + payload-form-context-wrapper `1e5890d` |
| T15 PII-Notice | `9e825fb` |
| T16 docs | `e171ce0` |
| T17 smoke + PR | manueller Test, dann Sammelcommits `29c969f` + `0b7029c`, PR #9, Merge `d2d5b06` |

### Manueller Smoke-Test

Pre-Task A vom User durchgeklickt (GitHub App `pflegeatlas-bot`, App-ID `4103602`, Werte in Apple Passwörter). Flow 1 + Flow 2 end-to-end mit echten Credentials gegen das echte Repo — beide ✅.

**Flow 1 (new_article):** Test-Submission „V1.5 Smoke Test Artikel" → In Review → PR #5 → Annehmen → Article #112 published + PR gemerged + `content/articles/v1-5-smoke-test-artikel.md` auf main. ✅

**Flow 2 (correction):** Test-Submission Korrektur an Praxis-Sektion → In Review → PR mit Markdown-Diff → Annehmen → nur Praxis updated. ✅ (nach 4 Bug-Fixes — siehe unten)

**Flow 3 (reject)** und **Flow 4 (article-direct-edit)** noch nicht getestet — können später am gemergedten V1.5-main durchlaufen werden.

### Smoke-Test-Findings (alle gefixt, in den zwei fix-Commits gebündelt)

`29c969f` — Flow-1-Findings:
1. Payload 3.x `admin.components.Field`-String braucht `pnpm payload generate:importmap`
2. `import 'server-only'` in `src/lib/github-*.ts` blockt Payload-CLI → entfernt
3. Workflow-Buttons in der Sidebar (`admin.position: 'sidebar'`) statt oben mittig
4. Buttons via `@payloadcms/ui` `<Button>` mit `buttonStyle="primary"`
5. `router.refresh()` nach erfolgreicher Server-Action
6. `Articles.authors.required: true → false`

`0b7029c` — Flow-2-Findings:
7. `relatedArticle` von Payload als Object trotz `depth:0` → defensive Extraktion (3 Stellen)
8. `createSubmissionPR` 422 „Reference already exists" → try/catch + Branch-Reuse
9. `isEmpty` in Mapper erkannte leere Lexical-Objects nicht → `lexicalToPlainText`-basierte Prüfung
10. UI zeigte alle 4 „Editierte Sektion: xxx"-Labels auch für leere → conditional render

Plus Setup außerhalb Repo: `pflegeatlas-bot` zu `bypass_actors` im Branch-Ruleset (gh-API), sonst blockt required-status-checks-policy den App-Merge auch bei grünem CI.

---

## V1.5-Architektur kurz

Drei Welten:
- **Payload-DB**: Source-of-Truth für Articles + Submissions
- **GitHub-Repo**: Markdown-Mirror unter `content/articles/<slug>.md`, PR-Workflow für Audit
- **Payload-Admin**: alle Aktionen werden hier ausgelöst

Submission-Workflow:
1. Submission eingehend → DB, `reviewStatus=pending`, Mail an Redaktion
2. „In Review nehmen" → Branch `submission/<id>` + Markdown-Datei + PR; atomar via Payload-Transaction
3. (Optional) Christoph editiert Submission im Admin → `afterChange`-Hook re-pusht neuen Commit auf den Branch
4. „Annehmen" → `payload.create/update articles` mit `skipMarkdownSync: true` + PR-Merge programmatisch; Mail an Submitter wenn E-Mail vorhanden
5. „Ablehnen" → PR schließen + Branch löschen, kein Article

Article-Direkt-Edit (außerhalb Submission): `Articles.afterChange`-Hook synct als direkter `main`-Commit, wenn `status === 'published'`. Bei Status-Wechsel weg von published wird die Datei gelöscht.

---

## V1.6-Backlog aus dieser Session

Code-side (klein-mittel):
1. **`InlineSectionDiff`-Komponente in Submissions-Collection anbinden** — Komponente + Tests sind aus T14 bereits da, nur nicht als Custom UI-Field verdrahtet
2. **Compensating-Action in `acceptAction`** für seltenen merge-then-DB-commit-fail-Pfad (im Code als Known Limitation dokumentiert)
3. **`payloadId` im Markdown-Frontmatter** via Re-Push nach Article-Create updaten (aktuell `0` beim ersten Push)
4. **Smoke-Test Flow 3 (reject)** und **Flow 4 (article-direct-edit)** noch durchspielen
5. **Lint-Warning-Sweep** — 35 Warnings, fast alle pre-existing, könnten konsolidiert werden

DB-side Cleanup (klein):
6. Article #114 (`test-dekubitus-1781981656336`) hat vom Flow-2-Bug Placeholder-Inhalt in Praxis/Risiken/Quellen-Sektionen + `content/articles/test-dekubitus-1781981656336.md` ist auf main. Beides ist Test-Daten — wenn jemand die DB aufräumt, am besten auch die Markdown-Datei via `gh api -X DELETE` (oder über die Article-Hook-Logik wenn Article archived wird).

---

## Konsolidierte Projektplan-Übersicht

| Track | Was | Pflicht? | V1.6 ready? | Brainstorm? |
|---|---|---|---|---|
| **A — V1.6 Editorial/Auth** | Better-Auth, Rollen, Review-Queue, RichText-Editor für Authors im Admin. Überschneidet sich mit V1.5-PR-Workflow (manche Konzepte können schrumpfen). | nein, aber konsequente Erweiterung | nein | nein |
| **B — DSGVO-Track** | Datenschutzerklärung, Impressum, AVV mit Cloudflare/Resend/Postgres, Aufbewahrungs-Konzept, Auskunft/Löschung | **ja, vor Production-Launch** | nein | nein |
| **C — Meilisearch** | Header-Suchfeld ist Stub, Search-Engine aktivieren | nein | nein | nein |
| **D — Homepage Community-Pull** | 8 Hebel aus Brainstorm vom selben Tag (Haltung-Claim, Mitmach-Card, Christoph-Block, Lebenszeichen, Reibungs-Vergleich, niedrigschwellige Türen, Rollen-Filter, Contributor Stories) — Hebel 8 vorgemerkt bis ≥3 echte externe Autor:innen | nein, aber strategisch wichtig | teils — Hebel 1+2+3 als erste Iteration | ✅ ja, `docs/BRAINSTORM-2026-06-20-homepage-community-pull.md` |
| **E — Hygiene-Sprint** | V1.6-Backlog oben + V1.2-Reste (Wordmark deprecated, IntentCards `aria-labelledby`, mitmachen@-Mail einrichten oder im README abschwächen) | nein | sofort | nein |
| **F — Smoke-Test Reste** | Flow 3 (reject) + Flow 4 (article-direct-edit) am V1.5-main durchklicken — kein Plan nötig, 15 Minuten | nein | sofort | nein |
| **G — V2 QM-Tool** | Proprietäres QM-Tool als eigenes Repo (finanziert das Wiki) | langfristig | nein | nein |

---

## V1.5-Lessons für künftige Plans

Sind alle im `project_pflegeatlas.md` festgehalten, aber hier nochmal die wichtigsten in einem Block:

1. **Payload 3.x Custom UI-Field-Components** brauchen Eintrag in `src/app/(payload)/admin/importMap.js`. Plain-String-Format (`'src/components/x.tsx#Name'`) funktioniert, aber `pnpm payload generate:importmap` muss einmalig laufen.
2. **Custom UI-Fields kriegen NICHT direkt `id`/Form-State als Props** — Wrapper mit `useDocumentInfo()` + `useFormFields(([fields]) => fields['xxx']?.value)` aus `@payloadcms/ui`.
3. **`payload.findByID(..., depth: 0)` populates Relationships trotzdem als Object** — defensive `typeof === 'object' ? .id : value`-Extraction.
4. **`payload.db.beginTransaction()` kann `null` returnen** (Adapter ohne Transactions); `commitTransaction`/`rollbackTransaction` brauchen `if (txn != null)`-Guard.
5. **`import 'server-only'` blockt `pnpm payload generate:importmap`** (tsx-Runtime). Wenn Payload-CLI das Modul transitiv lädt: weglassen.
6. **GitHub-Branch-Ruleset mit required status checks blockt App-Merges** auch wenn CI grün ist — App als Integration in `bypass_actors`.
7. **`@payloadcms/ui` Component-Imports** ziehen `react-image-crop` mit, dessen `.css`-Import jsdom nicht parsen kann — Tests müssen `vi.mock('@payloadcms/ui')` einen Stub setzen.
8. **`next build` setzt `NODE_ENV=production` vor Module-Load** — Boot-Checks brauchen `NEXT_PHASE === 'phase-production-build'`-Guard.
9. **afterChange-Hooks sind eventually-consistent** — Octokit-Failures rollen Payload-DB NICHT zurück. Mitigation: try/catch + console.error.
10. **`isEmpty`-Checks für Lexical-Objekte** müssen den Content-Walker nutzen (z.B. `lexicalToPlainText`), nicht nur null/string.
11. **`createRef` kann 422 „Reference already exists" werfen** beim Retry nach halben Lauf — defensive: catch 422, branch reuse.
12. **Manueller Smoke-Test ist unbezahlbar.** Code-Tests + Build grün haben NULL von den 10 Findings aufgedeckt. Echter Click-Through hat 10 Bugs in 2 Stunden ans Licht gebracht.

---

## Was als nächstes (für nächste Session)

1. **Memory + diesen Handoff lesen** statt im Code zu wühlen
2. **Plan-Wahl mit Oliver klären:** Track A (V1.6 Auth/Editorial), B (DSGVO), C (Meilisearch), D (Homepage-Pull Hebel 1+2+3), E (Hygiene/V1.6-Backlog), F (restliche Smoke-Test-Flows)?
3. **Bei großem Plan:** `superpowers:brainstorming` → `superpowers:writing-plans` → `superpowers:subagent-driven-development`
4. **Bei kleinem Plan (z.B. F oder ein Stück aus E):** direkt im Code

## Sonst kein Erzwungenes

- Stand ist sauber, V1.5 ist auf `main`
- Plan-Wahl in einer Woche völlig offen
- DSGVO-Track ist die einzige strikte Pflicht vor Production-Launch
