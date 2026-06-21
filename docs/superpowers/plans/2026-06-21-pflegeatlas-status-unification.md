# PflegeAtlas — Status-Vereinheitlichung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bug 3 aus Track F beseitigen — Payloads natives `versions.drafts` raus, Custom-`status` wird alleinige Quelle für Sichtbarkeit. Im selben Zug 108 alte Test-Articles aus der DB löschen.

**Architecture:** `src/collections/Articles.ts` verliert den `versions`-Block. Status-Feld zieht in die Admin-Sidebar. Eine manuell geschriebene SQL-Migration droppt `_articles_v`, `_articles_v_rels` und die `articles._status`-Spalte und löscht Test-Articles inkl. defensivem FK-Check. Ein neuer Regression-Test zementiert, dass `status` die alleinige Sichtbarkeits-Quelle ist.

**Tech Stack:** Payload CMS 3.85, PostgreSQL 16 (Docker via OrbStack, Container `pflegecommons-postgres`), Vitest 4, Next.js 16.

**Pre-Inventur-Befunde (Stand 2026-06-21):**
- DB-Tabellen für Drafts: `_articles_v`, `_articles_v_rels` (Underscore-V-Prefix, nicht `articles_versions*`).
- `_status`-Spalte mit Index `articles__status_idx`.
- DB-Enum `enum_articles_status` enthält nur `{draft, published}` — `in_review`/`archived` aus Articles.ts sind dead code; **out of scope dieses Plans**, im PR-Body als Side-Finding vermerken.
- 108 Test-Articles (`test-dekubitus-%` und `%-smoke-test-%`), 0 FK-Refs in `submissions`.

**Branch:** `fix/status-unification` (bereits angelegt, HEAD nach Spec-Commit `0842ac9`).

---

## Task 1: Reader-Access-Regression-Test als grüne Baseline

**Goal:** Test schreiben, der nach dem Refactor beweist, dass `status` die alleinige Sichtbarkeits-Quelle ist. Heute schon grün, weil Reader-Access-Rule bereits nur `status` liest — dient als „Safety Net" für die folgenden Tasks.

**Files:**
- Modify: `tests/integration/articles.test.ts` (Ende des `describe`-Blocks)

- [ ] **Step 1: Test schreiben**

Im bestehenden `describe('Articles Collection', ...)` am Ende, vor dem schließenden `});`:

```ts
  it('Reader-Access: unauthenticated find sieht nur status=published', async () => {
    const ts = Date.now();
    const draftSlug = `reader-access-draft-${ts}`;
    const publishedSlug = `reader-access-pub-${ts}`;

    const user = await payload.create({
      collection: 'users',
      data: {
        email: `reader-access-${ts}@example.com`,
        password: 'test-pw-12345!',
        displayName: 'Test Autor',
        role: 'editor',
      },
    });

    await payload.create({
      collection: 'articles',
      data: {
        title: `Reader-Access-Draft-${ts}`,
        slug: draftSlug,
        intent: 'bedside',
        summary: 'draft',
        definition: makeLexicalDoc('d') as any,
        praxis: makeLexicalDoc('d') as any,
        risiken: makeLexicalDoc('d') as any,
        quellen: makeLexicalDoc('d') as any,
        authors: [user.id],
        status: 'draft',
      },
    });

    await payload.create({
      collection: 'articles',
      data: {
        title: `Reader-Access-Pub-${ts}`,
        slug: publishedSlug,
        intent: 'bedside',
        summary: 'pub',
        definition: makeLexicalDoc('p') as any,
        praxis: makeLexicalDoc('p') as any,
        risiken: makeLexicalDoc('p') as any,
        quellen: makeLexicalDoc('p') as any,
        authors: [user.id],
        status: 'published',
      },
    });

    const anonResult = await payload.find({
      collection: 'articles',
      where: { slug: { in: [draftSlug, publishedSlug] } },
      overrideAccess: false,
    });

    const slugs = anonResult.docs.map((d) => d.slug);
    expect(slugs).toContain(publishedSlug);
    expect(slugs).not.toContain(draftSlug);
  });
```

- [ ] **Step 2: Test laufen lassen, muss grün sein**

Run: `pnpm test tests/integration/articles.test.ts`

Expected: alle drei Tests in `Articles Collection` PASS (inkl. neuer Reader-Access-Test).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/articles.test.ts
git commit -m "test(articles): reader-access baseline guard before status unification

Beweist dass die Read-Access-Rule (Articles.ts:113-119) bereits heute
nur \`status\` liest. Sicherheitsnetz für die kommenden versions-raus-
Schritte: bricht dieser Test, ist die Drop-Migration zu aggressiv
oder Articles.ts hat noch eine _status-Spur."
```

---

## Task 2: Articles.ts — versions-Block raus, status in Sidebar

**Goal:** Code-seitig den Drafts-Workflow deaktivieren und `status`-Feld in die Admin-Sidebar verschieben.

**Files:**
- Modify: `src/collections/Articles.ts:96-112` (Kommentar + versions-Block)
- Modify: `src/collections/Articles.ts:215-230` (status-Feld)

- [ ] **Step 1: Kommentar Z. 96-101 und versions-Block Z. 109-112 entfernen**

Alter Inhalt Z. 96-112:

```ts
  // V1: `status` (Entwurf/In Review/Veröffentlicht/Archiviert) ist die
  // alleinige Visibility-Quelle für die Read-Access-Rule unten. Payloads
  // natives `_status` aus dem drafts-Workflow bleibt für interne Versionen
  // erhalten, wird aber im Editorial-Flow nicht benutzt. Auf den nativen
  // Draft-Workflow wechseln wir später mit dem Auth/Editorial-Plan.
  hooks: {
    afterChange: [
      async (args) => {
        await afterArticleChangeHook(args as never);
      },
    ],
  },
  versions: {
    drafts: true,
    maxPerDoc: 50,
  },
```

Neuer Inhalt:

```ts
  // `status` ist die alleinige Sichtbarkeits-Quelle (siehe Read-Access-
  // Rule unten). Payloads native Draft-Funktion (`versions.drafts`) ist
  // bewusst deaktiviert: ein zweites paralleles Status-Konzept (`_status`)
  // hat im Smoke-Test wiederholt zur UX-Falle geführt (Bug 3, Track F
  // 2026-06-20). Audit-Trail kommt über V1.5-GitHub-Sync.
  hooks: {
    afterChange: [
      async (args) => {
        await afterArticleChangeHook(args as never);
      },
    ],
  },
```

- [ ] **Step 2: status-Feld in Sidebar verschieben (Z. 215-230)**

Alter Inhalt:

```ts
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      defaultValue: 'draft',
      admin: {
        description:
          'Dieses Feld steuert die öffentliche Sichtbarkeit. Nur "Veröffentlicht" ist für Leser:innen sichtbar.',
      },
      options: [
        { label: 'Entwurf', value: 'draft' },
        { label: 'In Review', value: 'in_review' },
        { label: 'Veröffentlicht', value: 'published' },
        { label: 'Archiviert', value: 'archived' },
      ],
    },
```

Neuer Inhalt:

```ts
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      defaultValue: 'draft',
      admin: {
        position: 'sidebar',
        description:
          'Steuert die öffentliche Sichtbarkeit. Nur "Veröffentlicht" ist für Leser:innen sichtbar — kein zweiter Toggle nötig.',
      },
      options: [
        { label: 'Entwurf', value: 'draft' },
        { label: 'In Review', value: 'in_review' },
        { label: 'Veröffentlicht', value: 'published' },
        { label: 'Archiviert', value: 'archived' },
      ],
    },
```

- [ ] **Step 3: Tests laufen lassen**

Run: `pnpm test`

Expected: 232/232 PASS (231 vor Task 1, +1 Reader-Access-Baseline aus Task 1).

- [ ] **Step 4: Commit**

```bash
git add src/collections/Articles.ts
git commit -m "fix(articles): drop versions.drafts, move status to sidebar

Schaltet Payloads nativen Draft-Toggle (Wurzel von Bug 3, Track F)
ab. \`status\` bleibt alleinige Sichtbarkeits-Quelle und zieht in die
Admin-Sidebar, damit Power-User dort weiterhin den Status-Schalter
finden, wo zuvor der irreführende _status-Toggle saß.

DB-Migration für \`_articles_v\`, \`_articles_v_rels\` und
\`articles._status\` folgt im nächsten Commit."
```

---

## Task 3: payload-types.ts regenerieren

**Goal:** TypeScript-Types ohne `_status` und Versions-Types.

**Files:**
- Modify: `src/payload-types.ts` (auto-generated)

- [ ] **Step 1: Types regenerieren**

Run: `pnpm payload generate:types`

Expected: Befehl läuft ohne Error, schreibt `src/payload-types.ts` neu. Diff zeigt:
- `_status` aus dem `Article`-Type weg
- Versions-bezogene Types (`ArticleVersion`) weg, falls vorhanden

- [ ] **Step 2: TS-Compile-Check**

Run: `pnpm exec tsc --noEmit 2>&1 | head -50`

Expected: Keine Type-Errors. Falls Errors auftauchen, sind sie in Files, die `_status` oder Versions-Types lesen — unerwartet, weil Code-Search (Spec) keine Konsumenten gezeigt hat. Bei Treffern: zurück zur Spec, Annahme prüfen.

- [ ] **Step 3: Commit**

```bash
git add src/payload-types.ts
git commit -m "chore: regenerate payload types after versions.drafts removal"
```

---

## Task 4: SQL-Migration schreiben

**Goal:** Manuelle Migration nach V1.4-Muster, weil `pnpm payload migrate:create` auf non-TTY-stdin hängt (V1.4-Lesson).

**Files:**
- Create: `src/migrations/20260621_120000_drop_versions_and_status.ts`

- [ ] **Step 1: Migration-Datei anlegen**

Neue Datei `src/migrations/20260621_120000_drop_versions_and_status.ts`:

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Status-Vereinheitlichung (Bug 3 aus Track F, 2026-06-20).
 *
 * - Löscht ~108 Test-Articles (`test-dekubitus-%`, `%-smoke-test-%`).
 *   Vorab geprüft: 0 FK-Refs auf diese Articles in submissions.
 * - Droppt Payloads native Versions-Tabellen `_articles_v` und
 *   `_articles_v_rels` (Folge von `versions.drafts: true` in
 *   Articles.ts, das mit diesem Plan entfernt wurde).
 * - Droppt `articles._status`-Spalte und den dazugehörigen Index.
 *
 * Idempotent: alle Operationen mit IF EXISTS-Guards, sodass die
 * Migration gegen leere DB (CI) sauber durchläuft und ein zweiter
 * lokaler Run no-op ist.
 *
 * `down()` ist Stub — Test-Articles und Versions-History sind nicht
 * rekonstruierbar (analog V1-Init-Migration).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      test_article_count INTEGER;
      fk_ref_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO test_article_count
        FROM articles
        WHERE slug LIKE 'test-dekubitus-%'
           OR slug LIKE '%-smoke-test-%';

      SELECT COUNT(*) INTO fk_ref_count
        FROM submissions
        WHERE related_article_id IN (
          SELECT id FROM articles
          WHERE slug LIKE 'test-dekubitus-%'
             OR slug LIKE '%-smoke-test-%'
        );

      RAISE NOTICE 'status-unification migration: % test articles, % submissions referencing them',
        test_article_count, fk_ref_count;

      IF fk_ref_count > 0 THEN
        DELETE FROM submissions
          WHERE related_article_id IN (
            SELECT id FROM articles
            WHERE slug LIKE 'test-dekubitus-%'
               OR slug LIKE '%-smoke-test-%'
          );
      END IF;

      DELETE FROM articles
        WHERE slug LIKE 'test-dekubitus-%'
           OR slug LIKE '%-smoke-test-%';
    END $$;

    DROP TABLE IF EXISTS public._articles_v_rels CASCADE;
    DROP TABLE IF EXISTS public._articles_v CASCADE;

    DROP TYPE IF EXISTS public.enum__articles_v_version_intent;
    DROP TYPE IF EXISTS public.enum__articles_v_version_status;

    DROP INDEX IF EXISTS public.articles__status_idx;
    ALTER TABLE public.articles DROP COLUMN IF EXISTS _status;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  throw new Error(
    'down() für status-unification ist nicht supported — Versions-History und Test-Articles sind nicht rekonstruierbar.',
  )
}
```

- [ ] **Step 2: TS-Check der Migration**

Run: `pnpm exec tsc --noEmit 2>&1 | head -20`

Expected: 0 Errors.

- [ ] **Step 3: Commit (Migration noch nicht angewendet)**

```bash
git add src/migrations/20260621_120000_drop_versions_and_status.ts
git commit -m "feat(migration): drop versions tables, _status column, test articles"
```

---

## Task 5: Migration lokal applien + verifizieren

**Goal:** Migration gegen die lokale Dev-DB laufen lassen, Schema und Daten verifizieren.

**Files:** keine

- [ ] **Step 1: DB-Container prüfen**

Run: `docker ps --filter name=pflegecommons-postgres --format '{{.Status}}'`

Expected: `Up ...` (Container läuft).

- [ ] **Step 2: Migration applien**

Run: `pnpm payload migrate`

Expected:
- Migration `20260621_120000_drop_versions_and_status` wird ausgeführt.
- Im Output erscheint die `RAISE NOTICE`-Zeile mit Test-Article-Count (erwartet ~108) und FK-Ref-Count (erwartet 0).

Falls `pnpm payload migrate` auf stdin hängt (V1.4-Lesson), Fallback:

```bash
docker exec -i pflegecommons-postgres psql -U pflege -d pflegecommons < src/migrations/20260621_120000_drop_versions_and_status.ts.sql
```

(Vor diesem Fallback: SQL-Body manuell aus der `up()`-Funktion in eine `.sql`-Datei extrahieren — analog V1.4-Muster.)

- [ ] **Step 3: Schema verifizieren**

Run:

```bash
docker exec pflegecommons-postgres psql -U pflege -d pflegecommons -c "\dt articles*"
docker exec pflegecommons-postgres psql -U pflege -d pflegecommons -c "\dt _articles_v*"
docker exec pflegecommons-postgres psql -U pflege -d pflegecommons -c "\d articles" | grep -i status
```

Expected:
- `\dt articles*` zeigt nur `articles` und `articles_rels`.
- `\dt _articles_v*` zeigt **keine** Treffer (Did not find any relation).
- `\d articles` zeigt `status`, aber **kein** `_status`.

- [ ] **Step 4: Test-Articles weg verifizieren**

Run:

```bash
docker exec pflegecommons-postgres psql -U pflege -d pflegecommons -c \
  "SELECT COUNT(*) AS test_count FROM articles WHERE slug LIKE 'test-dekubitus-%' OR slug LIKE '%-smoke-test-%';"
docker exec pflegecommons-postgres psql -U pflege -d pflegecommons -c \
  "SELECT COUNT(*) AS total FROM articles;"
```

Expected:
- `test_count`: 0
- `total`: ehemals ~115, jetzt ~7 (übrige Nicht-Test-Articles).

- [ ] **Step 5: Idempotenz prüfen — Migration nochmal laufen lassen**

Run: `pnpm payload migrate`

Expected: Migration wird als „already applied" übersprungen (steht in `payload_migrations`-Tabelle).

Sollte sie nicht eingetragen sein und erneut laufen: die `IF EXISTS`/`IF NOT EXISTS`-Guards müssen NO-OP liefern. Falls Fehler: Migration ist nicht idempotent — beheben und neu schreiben.

- [ ] **Step 6: payload_migrations-Tabelle prüfen**

Run:

```bash
docker exec pflegecommons-postgres psql -U pflege -d pflegecommons -c \
  "SELECT name, batch, created_at FROM payload_migrations ORDER BY batch DESC LIMIT 5;"
```

Expected: Eintrag `20260621_120000_drop_versions_and_status` mit aktuellem Timestamp.

---

## Task 6: Full Test-Suite + Build + Lint

**Goal:** Regression-Schutz nach Migration verifizieren.

**Files:** keine

- [ ] **Step 1: Tests laufen lassen**

Run: `pnpm test`

Expected: 232/232 PASS. Insbesondere:
- `tests/integration/articles.test.ts` — Reader-Access-Baseline + V1.5-Hook-Regression
- `tests/integration/article-sync-hook.test.ts` — alle Hook-Pfade

- [ ] **Step 2: Lint**

Run: `pnpm lint 2>&1 | tail -10`

Expected: `0 errors`. Warnings dürfen auf Vor-Niveau bleiben (max ±2).

- [ ] **Step 3: Build**

Run: `pnpm build 2>&1 | tail -20`

Expected: `✓ Compiled successfully` oder Payload-Build-Output ohne Errors.

Falls Build-Errors: typischerweise `_status` oder `ArticleVersion` in einem File, das Code-Search der Spec übersehen hat. Bei Treffer: kurz fixen, Commit anhängen.

- [ ] **Step 4: Commit (falls Build-Fixes nötig waren)**

Skip wenn keine Fixes. Sonst:

```bash
git add <betroffene Files>
git commit -m "fix: tidy up after versions removal"
```

---

## Task 7: Manueller Smoke-Test im Dev-Server

**Goal:** UI-Verhalten verifizieren — kein `_status`-Toggle, `status` in Sidebar, Reader-Access wirkt.

**Files:** keine

- [ ] **Step 1: Dev-Server starten**

Run (in eigenem Terminal): `pnpm dev`

Warten bis `Local: http://localhost:3000` erscheint.

- [ ] **Step 2: Admin-UI prüfen**

Browser: http://localhost:3000/admin → Login → Articles

- Liste öffnet sich.
- Einen vorhandenen Article öffnen.
- **Verifizieren:** Kein Toggle „Draft / Published" oben rechts.
- **Verifizieren:** Rechts in der Sidebar steht das `Status`-Dropdown mit den vier Werten (Entwurf, In Review, Veröffentlicht, Archiviert).
- **Verifizieren:** Description „Steuert die öffentliche Sichtbarkeit…" sichtbar.

- [ ] **Step 3: Status-Wechsel testen**

- Article auf `Entwurf` setzen, speichern.
- Browser-Tab Inkognito öffnen → `http://localhost:3000/artikel/<slug>` → **erwartet 404** (Article ist nicht published).
- Zurück im Admin, Article auf `Veröffentlicht` setzen, speichern.
- Inkognito-Tab reload → Article wird angezeigt.

- [ ] **Step 4: Dev-Server-Logs prüfen**

Im Dev-Server-Terminal: keine Errors zu `_status`, `articles_v`, undefined columns.

- [ ] **Step 5: Dev-Server stoppen**

Im Dev-Server-Terminal: `Ctrl+C`.

---

## Task 8: PR auf GitHub

**Goal:** Branch pushen, PR mit aussagekräftiger Beschreibung, CI grün, Merge.

**Files:** keine

- [ ] **Step 1: Branch pushen**

Run: `git push -u origin fix/status-unification`

Expected: Branch ist remote, URL für PR-Create wird ausgegeben.

- [ ] **Step 2: PR erstellen**

Run:

```bash
gh pr create --title "fix(articles): unify status — drop versions.drafts and _status" --body "$(cat <<'EOF'
## Bug 3 aus Track F gelöst

Memory-Vermerk (neunte Session, 2026-06-20):
> Power-User klickt den prominenten Toggle → \`_status\` ändert sich,
> \`status\` bleibt → der V1.5-Hook sieht keinen Übergang. Oliver ist
> zweimal in der UI darauf reingefallen.

### Was sich ändert

- \`versions: { drafts: true, maxPerDoc: 50 }\` raus aus \`Articles.ts\`.
- \`status\`-Feld bekommt \`admin.position: 'sidebar'\`.
- Migration \`20260621_120000_drop_versions_and_status\` droppt
  \`_articles_v\`, \`_articles_v_rels\` und \`articles._status\`.
- Im selben Schritt: 108 Test-Articles (\`test-dekubitus-%\`,
  \`%-smoke-test-%\`) aus der DB gelöscht. 0 FK-Refs in submissions
  vorab verifiziert.

### Was nicht angefasst wird

- Frontend-Queries, Submission-Server-Actions, V1.5-Hook — die lesen
  alle nur \`status\` und sind heute schon korrekt.
- Audit-Trail bleibt über V1.5-GitHub-Sync + Submission-PRs.

### Side-Finding (Out of Scope)

Die DB-Enum \`enum_articles_status\` enthält nur \`{draft, published}\`.
Die im Code definierten Werte \`in_review\` und \`archived\` sind dead
code — Payload würde sie beim Save als Enum-Constraint-Violation
abweisen. Dieser Plan ändert nichts daran (out of scope). Folge-
Entscheidung: entweder Enum erweitern oder Code-Optionen kürzen.

### Verifikation

- [x] 232/232 Tests grün (231 Baseline + 1 Reader-Access-Regression)
- [x] \`pnpm lint\` 0 errors
- [x] \`pnpm build\` grün
- [x] Migration idempotent (zweimal lokal laufen lassen, zweiter Run no-op)
- [x] Manueller Smoke-Test: kein \`_status\`-Toggle, \`status\` in Sidebar, Reader-Access greift
- [ ] CI grün

### Test plan

- [ ] CI prüft \`pnpm lint\`, \`pnpm payload migrate\`, \`pnpm test\`, \`pnpm build\` (siehe \`.github/workflows/ci.yml\`)
- [ ] Nach Merge: kurzer Production-Smoke wenn deployed (analog V1.5-Merge-Pattern)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR-URL wird ausgegeben (z.B. `https://github.com/shogun160/pflege-atlas/pull/15`).

- [ ] **Step 3: CI grün abwarten**

Run: `gh pr checks <PR-Nummer> --watch`

Expected: `ci pass` nach ~1-2 min (analog V1.4/V1.5/PR-#14-Erfahrung).

- [ ] **Step 4: Merge**

Nur nach User-Bestätigung mergen. Erwarteter Befehl:

```bash
gh pr merge <PR-Nummer> --merge --delete-branch
```

Expected: Fast-Forward Merge auf main, Branch lokal+remote gelöscht, Working-Tree clean.

- [ ] **Step 5: Lokal main aktualisieren**

```bash
git checkout main
git pull origin main
```

Expected: main HEAD ist der neue Merge-Commit.

- [ ] **Step 6: Memory aktualisieren**

Update `/Users/oliverwosnitza/.claude/projects/-Users-oliverwosnitza/memory/project_pflegeatlas.md`:
- Bug 3 als gelöst markieren mit PR-Nummer und Merge-Commit-SHA.
- 108-Test-Article-Cleanup als erledigt vermerken.
- Side-Finding (Enum-Mismatch) als neuen Track-E-Backlog-Item notieren.

Update `MEMORY.md` Index-Zeile: HEAD-SHA, Bug-3-Status, neue Backlog-Notiz.

---

## Out of Scope (für diesen Plan)

- Enum-Erweiterung von `enum_articles_status` um `in_review`/`archived` (Side-Finding aus Inventur).
- V1.6 Auth/Editorial-Workflow.
- DSGVO/Compliance-Track.
- Homepage Community-Pull (Brainstorm 2026-06-20).
- Meilisearch.

## Quellen

- Spec: `docs/superpowers/specs/2026-06-21-pflegeatlas-status-unification-design.md`
- Memory: `project_pflegeatlas.md` (Stand neunte Session, Bug 3)
- V1.4-Migration-Pattern: `src/migrations/20260605_140707_init.ts`
- V1.4-Lesson (Payload-CLI hängt non-TTY): Memory `project_pflegeatlas.md`
