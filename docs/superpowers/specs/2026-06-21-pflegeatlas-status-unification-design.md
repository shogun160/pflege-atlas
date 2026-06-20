# PflegeAtlas — Status-Vereinheitlichung (Bug 3 aus Track F)

**Datum:** 2026-06-21
**Status:** Spec
**Vorgänger:** PR #14 (Mystery-Trigger-Fix), `b73adde` auf `main`

## Problem

Die Articles-Collection hat heute zwei parallele Status-Konzepte:

1. **Custom-Feld `status`** (`src/collections/Articles.ts:215–230`) mit vier
   Werten: `draft`, `in_review`, `published`, `archived`. Es steuert die
   Read-Access-Rule, alle Frontend-Queries (`index/page.tsx`,
   `sitemap.ts`, `artikel/[slug]/page.tsx`), die Submission-Server-Actions
   (`submission-actions.ts`, `submission-to-article.ts`, `Submissions.ts`)
   und den V1.5-`afterArticleChangeHook`.
2. **Payloads natives `_status`** aus `versions.drafts: true`
   (`Articles.ts:109–112`). Es bedient den prominenten Draft-/Publish-Toggle
   oben rechts in der Admin-UI. Es wird **nirgendwo** im App-Code gelesen.

Folge: Power-User klickt den prominenten Toggle → `_status` ändert sich,
`status` bleibt → der V1.5-Hook sieht keinen Übergang, das Frontend zeigt
nichts. Oliver ist im V1.5-Smoke-Test (neunte Session, 2026-06-20) zweimal
darauf reingefallen. Christoph wird's auch.

## Entscheidungen (Brainstorm 2026-06-21)

| Frage | Entscheidung |
|---|---|
| Brauchen wir Payloads native Draft-Funktion? | **Nein.** Das 4-Werte-`status`-Feld reicht. Edits sind „live am Datensatz". |
| Versions-History behalten? | **Nein.** Audit-Trail über V1.5-GitHub-PRs + direkte Article-Commits ausreichend. |
| Test-Article-Cleanup im selben Plan? | **Ja.** ~106 Test-Articles (`test-dekubitus-*` und Smoke-Test-Reste) hängen direkt an der `articles_versions`-Tabelle, die ohnehin gedropt wird. |
| Wer gewinnt bei `_status` ≠ `status`-Inkonsistenz? | **`status`** — was die App tatsächlich liest, was Leser:innen gesehen haben. |
| Status-Feld-Position in der Admin-UI? | **`admin.position: 'sidebar'`** — landet dort, wo das Auge nach dem alten Toggle sucht. |

## Architektur

Die Articles-Collection hat genau **ein** Status-Konzept: das Custom-Feld
`status`. Es steuert Read-Access, V1.5-Sync-Hook, alle Frontend-Queries
und Submission-Server-Actions — so wie heute. Payloads `versions.drafts`
und die Versions-Snapshots werden komplett entfernt. Der Sidebar-Toggle
verschwindet. Das `status`-Feld zieht in die Admin-Sidebar an die Stelle,
an der das Auge nach dem alten Toggle sucht. Audit-Trail über GitHub
bleibt unverändert (V1.5-Hook + Submission-PRs).

## Touch-Liste

| Datei | Änderung |
|---|---|
| `src/collections/Articles.ts` | `versions: { drafts: true, maxPerDoc: 50 }`-Block raus. `status`-Feld bekommt `admin.position: 'sidebar'`. Code-Kommentar Z. 97–101 wird aktualisiert (kein „mit V1.6 migrieren" mehr nötig). |
| `src/migrations/<neu>.ts` | Neue Migration: löscht Test-Articles (und ggf. Submissions mit FK), droppt `articles_versions*`-Tabellen, droppt `articles._status`-Spalte. |
| `src/payload-types.ts` | Auto-regeneriert via `pnpm payload generate:types`. `_status` und Versions-Types fallen raus. |
| `tests/integration/articles.test.ts` | Neuer Test: Reader-Access-Regression. `status: 'draft'` ist für unauthenticated Reader unsichtbar, `status: 'published'` sichtbar. |

**Nicht angefasst:** Frontend-Queries, Submission-Server-Actions, V1.5-Hook.
Die lesen alle nur `status` und sind heute schon korrekt.

## Migration

Manuelle Migration analog V1.4-Muster (Payload-CLI hängt auf
non-TTY-stdin, V1.4-Lesson). Reihenfolge im `up()`:

1. **Inventur (informativ).** `SELECT COUNT(*) FROM articles WHERE slug
   LIKE 'test-dekubitus-%' OR slug LIKE '%-smoke-test-%'` als
   `console.log`-Zeile, damit der Migrationslauf zeigt, wie viele
   Test-Articles betroffen sind.
2. **Test-Articles + Folgedaten löschen.** Plan ermittelt via `SELECT`
   auf `submissions.related_article` zuerst, ob noch FK-Refs existieren;
   bei Treffer erst Submissions löschen, dann Articles. Im aktuellen
   Stand sind laut Memory keine Test-Submissions mehr da, aber die
   Migration ist defensiv.
3. **`articles_versions*`-Tabellen droppen.** Exakte Tabellennamen via
   Schema-Inventur (`\dt articles_*`) im Plan-Step ermitteln. Erwartet
   werden `articles_versions` plus zugehörige `_rels`- und ggf.
   `_locales`-Tabellen.
4. **`articles._status`-Spalte droppen.** `ALTER TABLE articles DROP
   COLUMN _status`. Inkonsistenzen bewusst nicht reconciled — `status`
   gewinnt.
5. **`payload_migrations`-Row inserten** (manuelle Auslieferung).

`down()` ist Stub („nicht supported in Production"). Test-Articles und
Versions-History sind nicht rekonstruierbar; das ist der gleiche Ansatz
wie bei der V1-Init-Migration.

**Idempotenz:** `IF EXISTS`-Guards bei jedem `DROP TABLE` / `DROP
COLUMN`, damit CI-Run (leere DB) sauber durchläuft. Migration läuft in
einer Transaktion (PostgreSQL DDL ist transaktional).

**Deploy-Order:** Code zuerst (neue Config `versions: false`), dann
Migration. Bei monolithischem Deploy (`next build` enthält die neue
Config) ist das automatisch atomar.

## Risiken & Error Handling

| Risiko | Mitigation |
|---|---|
| `payload-types.ts` nicht regeneriert → TS-Build-Error | Plan-Schritt: `pnpm payload generate:types` direkt nach Articles-Änderung, vor Migration. Commit als eigener Diff. |
| Migration scheitert mittendrin | Transaktion + `IF EXISTS`-Guards → re-runnable. |
| `_status`-Drop in Production während User speichert | Payload schreibt `_status` nur durch `drafts: true`. Sobald die Code-Änderung deployed ist, wird `_status` nicht mehr beschrieben. Deploy-Order schützt. |
| Submission-FK auf Test-Article | Vor `DELETE FROM articles` ein `SELECT` auf `submissions.related_article`. Bei Treffer Submission zuerst löschen. |
| Versions-Tabellen-Namen unbekannt | Plan-Step 1: `pg_dump --schema-only | grep articles_versions` als Inventur, exakte Namen in Migration. |
| V1.5-Hook feuert bei Test-Article-Delete | Nicht relevant — Migration arbeitet SQL-direkt, umgeht Hooks. MD-Files im Repo existieren nach PR #14 nicht mehr. |

## Testing

| Ebene | Was wird geprüft |
|---|---|
| Bestehende Suite | Alle 231 Tests müssen weiter grün laufen. Insbesondere `tests/integration/articles.test.ts` (V1.5-Hook-Regression aus PR #14) und `tests/integration/article-sync-hook.test.ts`. |
| Neuer Integration-Test | `articles.test.ts` bekommt einen Test, der einen Article mit `status: 'draft'` anlegt und prüft, dass die Reader-Access-Rule (unauthenticated `payload.find`) ihn **nicht** findet. Dann den Article auf `status: 'published'` updaten → wird gefunden. Beweis: `status` ist alleinige Sichtbarkeits-Quelle, kein `_status`-Pfad mehr nötig. |
| Migration-Idempotenz | Migration zweimal hintereinander laufen lassen (lokal). Zweiter Run muss no-op sein dank `IF EXISTS`. |
| Build | `pnpm build` grün mit regeneriertem `payload-types.ts` ohne `_status`/Versions. |
| Lint | 0 errors, Warnings auf Vor-Niveau. |
| Smoke-Test (manuell, im letzten Plan-Step) | Admin-UI: kein `_status`-Toggle mehr sichtbar, `status`-Dropdown sitzt in Sidebar. Frontend: published Article weiterhin sichtbar, draft Article unsichtbar. |

TDD-Disziplin wie in V1.4/V1.5: jeder Implementation-Task fängt mit
einem RED-Test an. Aufbruch im Implementation-Plan.

## Out of Scope

- Umbenennung des `status`-Felds (z.B. zu `publishStatus`/`visibility`).
  Zu großer Migration-Aufwand bei kleinem Klarheits-Gewinn, jetzt wo das
  konkurrierende `_status` weg ist.
- V1.6 Auth/Editorial-Workflow (Roles, Review-Queue, native Drafts mit
  Preview-Mechanik). Dieser Fix entkoppelt das Status-Problem davon —
  V1.6 kann später ohne UX-Falle gestaltet werden.
- DSGVO/Compliance-Track. Dieser Fix räumt nur die ~106 Test-Articles
  weg, nicht das gesamte Compliance-Setup.
- Homepage Community-Pull (drei Hebel aus Brainstorm 2026-06-20).

## Quellen

- Memory: `project_pflegeatlas.md` (Stand neunte Session, Bug 3).
- Code: `src/collections/Articles.ts` (b73adde).
- Brainstorm 2026-06-21 (zehnte/elfte Session).
