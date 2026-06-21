# PflegeAtlas — Articles.status Enum-Erweiterung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Side-Finding aus PR #15 beseitigen — DB-Enum `enum_articles_status` um `'in_review'` und `'archived'` erweitern, damit das Articles.ts-Feld (das die vier Werte schon listet) sie auch tatsächlich speichern kann.

**Architecture:** Eine Migration `ALTER TYPE enum_articles_status ADD VALUE IF NOT EXISTS ...`. Kein Code-Touch (`Articles.ts`, `payload-types.ts`, Frontend-Queries, V1.5-Hook bleiben unverändert). Ein neuer Integration-Test bewahrt den DB-Roundtrip.

**Tech Stack:** Payload CMS 3.85, PostgreSQL 16 (Docker `pflegecommons-postgres`), Vitest 4, Next.js 16.

**Lessons aus PR #15 (relevant hier):**
- Payload-CLI `pnpm payload migrate` hängt non-TTY-stdin. Migration via `docker exec ... psql -f` applien, `payload_migrations`-Row separat inserten (V1.4-Lesson).
- Neue Migration **muss** in `src/migrations/index.ts` registriert sein (V1.5-Lesson, war Issue I1 im Final-Review).
- TDD-RED ist hier echt: vor Migration wirft `payload.create({status: 'in_review'})` Postgres-Enum-Constraint-Violation.

**Branch:** `fix/articles-status-enum-extend` (bereits angelegt, HEAD nach Spec-Commit `b876536`).

---

## Task 1: Failing Integration-Test schreiben (TDD-RED)

**Goal:** Test schreiben, der den Bug demonstriert: `payload.create({status: 'in_review'})` schlägt aktuell mit Enum-Constraint-Violation fehl. Nach der Migration (T2/T4) muss er grün laufen.

**Files:**
- Modify: `tests/integration/articles.test.ts` (Ende des `describe`-Blocks)

- [ ] **Step 1: Test schreiben**

Im bestehenden `describe('Articles Collection', ...)` am Ende, vor dem schließenden `});`:

```ts
  it('akzeptiert status=in_review und status=archived (post enum extend)', async () => {
    const ts = Date.now();
    const inReviewSlug = `enum-in-review-${ts}`;
    const archivedSlug = `enum-archived-${ts}`;

    const user = await payload.create({
      collection: 'users',
      data: {
        email: `enum-extend-${ts}@example.com`,
        password: 'test-pw-12345!',
        displayName: 'Test Autor',
        role: 'editor',
      },
    });

    const inReviewArticle = await payload.create({
      collection: 'articles',
      data: {
        title: `Enum-In-Review-${ts}`,
        slug: inReviewSlug,
        intent: 'bedside',
        summary: 'in_review',
        definition: makeLexicalDoc('d') as any,
        praxis: makeLexicalDoc('d') as any,
        risiken: makeLexicalDoc('d') as any,
        quellen: makeLexicalDoc('d') as any,
        authors: [user.id],
        status: 'in_review',
      },
    });

    expect(inReviewArticle.status).toBe('in_review');

    const updated = await payload.update({
      collection: 'articles',
      id: inReviewArticle.id,
      data: { status: 'archived', slug: archivedSlug },
    });

    expect(updated.status).toBe('archived');

    const anonResult = await payload.find({
      collection: 'articles',
      where: { slug: { in: [inReviewSlug, archivedSlug] } },
      overrideAccess: false,
    });

    expect(anonResult.docs.map((d) => d.slug)).toEqual([]);
  });
```

- [ ] **Step 2: Test laufen lassen — muss FAILEN**

Run: `pnpm test tests/integration/articles.test.ts`

Expected: der neue Test schlägt fehl mit einem Postgres-Enum-Constraint-Fehler beim ersten `payload.create({..., status: 'in_review'})`. Fehlermeldung enthält typischerweise `invalid input value for enum enum_articles_status: "in_review"` oder `Error: ... enum`.

**Wichtig:** Die anderen drei Tests in der Datei müssen weiter PASS sein. Wenn die fail, hat der neue Test einen DB-State hinterlassen, der die anderen kaputt macht — Subagent berichtet das als BLOCKED.

- [ ] **Step 3: Commit (RED-State festhalten)**

```bash
git add tests/integration/articles.test.ts
git commit -m "test(articles): failing test for status=in_review and status=archived (RED)

Demonstriert dass Postgres aktuell Enum-Constraint-Violation wirft,
weil enum_articles_status nur {draft, published} kennt. Migration
in nächstem Commit erweitert das Enum, Test geht dann GREEN."
```

---

## Task 2: Migration schreiben

**Goal:** Manuelle SQL-Migration nach V1.4/V1.5-Muster (Payload-CLI hängt non-TTY).

**Files:**
- Create: `src/migrations/20260621_140000_articles_status_enum_extend.ts`

- [ ] **Step 1: Migration-Datei anlegen**

Neue Datei `src/migrations/20260621_140000_articles_status_enum_extend.ts`:

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Erweitert `enum_articles_status` um `'in_review'` und `'archived'`.
 *
 * Side-Finding aus PR #15: `Articles.ts:222-225` listet vier Status-
 * Werte, aber das DB-Enum kannte nur `{draft, published}`. Wer in der
 * Admin-UI `In Review` oder `Archiviert` wählte, kassierte beim Save
 * eine Postgres-Enum-Constraint-Violation.
 *
 * Reader-Access bleibt unverändert: nur `status === 'published'` ist
 * öffentlich sichtbar. V1.5-Hook behandelt die neuen Werte korrekt
 * über die bestehenden `published ↔ not-published`-Übergänge.
 *
 * `ALTER TYPE ... ADD VALUE` ist seit PostgreSQL 12 in Transaktionen
 * erlaubt. CI/Prod laufen auf Postgres 16.
 *
 * Idempotent via `IF NOT EXISTS`. `down()` ist Stub — Postgres lässt
 * Enum-Werte nicht trivial entfernen.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE public.enum_articles_status ADD VALUE IF NOT EXISTS 'in_review';
    ALTER TYPE public.enum_articles_status ADD VALUE IF NOT EXISTS 'archived';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  throw new Error(
    'down() für articles-status-enum-extend ist nicht supported — Postgres lässt Enum-Werte nicht trivial entfernen.',
  )
}
```

- [ ] **Step 2: TS-Check der Migration**

Run: `pnpm exec tsc --noEmit 2>&1 | grep "src/" | head -10`

Expected: 0 Treffer in `src/`. node_modules-Errors aus drizzle-kit sind pre-existing und werden gefiltert.

- [ ] **Step 3: Commit (Migration noch nicht angewendet)**

```bash
git add src/migrations/20260621_140000_articles_status_enum_extend.ts
git commit -m "feat(migration): extend articles status enum with in_review + archived"
```

---

## Task 3: Migration in index.ts registrieren

**Goal:** Pattern-Treue zu V1.4/V1.5/PR #15. Migration muss in `index.ts` stehen, sonst überspringt eine künftige `prodMigrations`-Adapter-Konfiguration sie (PR #15-Lesson, Issue I1).

**Files:**
- Modify: `src/migrations/index.ts`

- [ ] **Step 1: Import + Registry-Entry hinzufügen**

Alter Inhalt:

```ts
import * as migration_20260605_140707_init from './20260605_140707_init';
import * as migration_20260606_155824_v1_4_structured_submissions from './20260606_155824_v1_4_structured_submissions';
import * as migration_20260620_165037_v1_5_submissions_pr_fields from './20260620_165037_v1_5_submissions_pr_fields';
import * as migration_20260621_120000_drop_versions_and_status from './20260621_120000_drop_versions_and_status';

export const migrations = [
  {
    up: migration_20260605_140707_init.up,
    down: migration_20260605_140707_init.down,
    name: '20260605_140707_init'
  },
  {
    up: migration_20260606_155824_v1_4_structured_submissions.up,
    down: migration_20260606_155824_v1_4_structured_submissions.down,
    name: '20260606_155824_v1_4_structured_submissions'
  },
  {
    up: migration_20260620_165037_v1_5_submissions_pr_fields.up,
    down: migration_20260620_165037_v1_5_submissions_pr_fields.down,
    name: '20260620_165037_v1_5_submissions_pr_fields'
  },
  {
    up: migration_20260621_120000_drop_versions_and_status.up,
    down: migration_20260621_120000_drop_versions_and_status.down,
    name: '20260621_120000_drop_versions_and_status'
  },
];
```

Neuer Inhalt:

```ts
import * as migration_20260605_140707_init from './20260605_140707_init';
import * as migration_20260606_155824_v1_4_structured_submissions from './20260606_155824_v1_4_structured_submissions';
import * as migration_20260620_165037_v1_5_submissions_pr_fields from './20260620_165037_v1_5_submissions_pr_fields';
import * as migration_20260621_120000_drop_versions_and_status from './20260621_120000_drop_versions_and_status';
import * as migration_20260621_140000_articles_status_enum_extend from './20260621_140000_articles_status_enum_extend';

export const migrations = [
  {
    up: migration_20260605_140707_init.up,
    down: migration_20260605_140707_init.down,
    name: '20260605_140707_init'
  },
  {
    up: migration_20260606_155824_v1_4_structured_submissions.up,
    down: migration_20260606_155824_v1_4_structured_submissions.down,
    name: '20260606_155824_v1_4_structured_submissions'
  },
  {
    up: migration_20260620_165037_v1_5_submissions_pr_fields.up,
    down: migration_20260620_165037_v1_5_submissions_pr_fields.down,
    name: '20260620_165037_v1_5_submissions_pr_fields'
  },
  {
    up: migration_20260621_120000_drop_versions_and_status.up,
    down: migration_20260621_120000_drop_versions_and_status.down,
    name: '20260621_120000_drop_versions_and_status'
  },
  {
    up: migration_20260621_140000_articles_status_enum_extend.up,
    down: migration_20260621_140000_articles_status_enum_extend.down,
    name: '20260621_140000_articles_status_enum_extend'
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/migrations/index.ts
git commit -m "chore(migrations): register articles-status-enum-extend in index.ts"
```

---

## Task 4: Migration lokal applien

**Goal:** Lokale Dev-DB ans neue Schema bringen, damit der Test grün läuft und Dev-Server ohne Schema-Sync-Konflikt bootet.

**Files:** keine

- [ ] **Step 1: DB-Container prüfen**

Run: `docker ps --filter name=pflegecommons-postgres --format '{{.Status}}'`

Expected: `Up ...`.

- [ ] **Step 2: Migration via psql applien**

Helper-Script `/tmp/articles-status-enum-extend.sql` schreiben:

```sql
ALTER TYPE public.enum_articles_status ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE public.enum_articles_status ADD VALUE IF NOT EXISTS 'archived';

INSERT INTO public.payload_migrations (name, batch, created_at, updated_at)
SELECT '20260621_140000_articles_status_enum_extend',
       COALESCE((SELECT MAX(batch) FROM public.payload_migrations), 0) + 1,
       NOW(),
       NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.payload_migrations
  WHERE name = '20260621_140000_articles_status_enum_extend'
);
```

Dann:

```bash
docker cp /tmp/articles-status-enum-extend.sql pflegecommons-postgres:/tmp/migration.sql
docker exec pflegecommons-postgres psql -U pflege -d pflegecommons -f /tmp/migration.sql
```

Expected:
```
ALTER TYPE
ALTER TYPE
INSERT 0 1
```

- [ ] **Step 3: Enum-Werte verifizieren**

Run:

```bash
docker exec pflegecommons-postgres psql -U pflege -d pflegecommons -c \
  "SELECT enum_range(NULL::enum_articles_status);"
```

Expected:
```
              enum_range              
--------------------------------------
 {draft,published,in_review,archived}
```

(Reihenfolge ist `pg_dump`-Reihenfolge — `in_review` und `archived` werden ans Ende angefügt.)

- [ ] **Step 4: payload_migrations-Eintrag verifizieren**

Run:

```bash
docker exec pflegecommons-postgres psql -U pflege -d pflegecommons -c \
  "SELECT name, batch, created_at FROM payload_migrations WHERE name LIKE '%status_enum%';"
```

Expected: ein Eintrag `20260621_140000_articles_status_enum_extend` mit aktuellem Timestamp.

- [ ] **Step 5: Idempotenz testen**

Migration nochmal applien:

```bash
docker exec pflegecommons-postgres psql -U pflege -d pflegecommons -f /tmp/migration.sql
```

Expected:
```
NOTICE:  enum label "in_review" already exists, skipping
ALTER TYPE
NOTICE:  enum label "archived" already exists, skipping
ALTER TYPE
INSERT 0 0
```

(Die `INSERT 0 0` zeigt: `WHERE NOT EXISTS` greift, keine Duplikat-Row.)

---

## Task 5: Test verifizieren — RED → GREEN

**Goal:** Der Failing-Test aus T1 muss nach Migration grün sein.

**Files:** keine

- [ ] **Step 1: Test laufen lassen**

Run: `pnpm test tests/integration/articles.test.ts`

Expected: 4/4 PASS. Der neue Enum-Test grün, die drei Vortests weiter grün.

- [ ] **Step 2: Sanity-Check via psql**

Articles, die der Test angelegt hat:

```bash
docker exec pflegecommons-postgres psql -U pflege -d pflegecommons -c \
  "SELECT slug, status FROM articles WHERE slug LIKE 'enum-%' ORDER BY id DESC LIMIT 5;"
```

Expected: mindestens eine Row mit `status='archived'` (der Update aus dem Test) — beweist, dass Postgres die neuen Enum-Werte akzeptiert.

---

## Task 6: Full Suite + Build + Lint

**Goal:** Regression-Schutz nach Migration verifizieren.

**Files:** keine

- [ ] **Step 1: Tests laufen lassen**

Run: `pnpm test`

Expected: 233/233 PASS (232 vor T1 + 1 Enum-Test).

- [ ] **Step 2: Lint**

Run: `pnpm lint 2>&1 | tail -5`

Expected: `0 errors`. Warnings auf Vor-Niveau ±5.

- [ ] **Step 3: Build**

Run: `pnpm build 2>&1 | tail -10`

Expected: Build grün, alle Routes generiert.

---

## Task 7: PR + Merge + Memory

**Goal:** Branch pushen, PR, CI grün, Merge, Memory-Update.

**Files:** keine

- [ ] **Step 1: Branch pushen**

Run: `git push -u origin fix/articles-status-enum-extend`

Expected: Branch ist remote, PR-URL wird ausgegeben.

- [ ] **Step 2: PR erstellen**

Run:

```bash
gh pr create --title "feat(articles): extend status enum with in_review + archived" --body "$(cat <<'EOF'
## Side-Finding aus PR #15 gelöst

`Articles.ts:222-225` listet vier Status-Werte (`draft`, `in_review`, `published`, `archived`), die DB-Enum `enum_articles_status` kannte aber nur `{draft, published}`. Wer in der Admin-UI `In Review` oder `Archiviert` wählte, kassierte beim Save eine Postgres-Enum-Constraint-Violation.

### Was sich ändert

- Migration `20260621_140000_articles_status_enum_extend` führt zwei `ALTER TYPE ... ADD VALUE IF NOT EXISTS`-Statements aus.
- Migration in `src/migrations/index.ts` registriert (Pattern-Treue zu V1.4/V1.5/PR #15).
- Neuer Integration-Test in `tests/integration/articles.test.ts` beweist DB-Roundtrip für `in_review` + `archived` und verifiziert, dass beide Werte für anonyme Reader nicht sichtbar sind.

### Was nicht angefasst wird

- `Articles.ts` — die vier Optionen sind seit V1 im Code.
- `payload-types.ts` — die Type-Union zeigt schon vier Werte.
- Reader-Access-Rule, V1.5-Hook, Frontend-Queries, Submission-Code — alles unverändert.
- Submissions-`reviewStatus`-Feld — eigenes Workflow-Konzept, hier nicht relevant.

### Brainstorm-Entscheidungen

- **Erweitern statt kürzen.** Direkt-Edits an Articles (V1.5-Pfad) haben heute keinen Review-State; ein längerer Review braucht Sichtbarkeit für andere im Team. `archived` hat klare „war mal published, jetzt nicht mehr"-Semantik.
- **Lebenszyklus-Reihenfolge** im Dropdown (Entwurf → In Review → Veröffentlicht → Archiviert), wie schon im Code.

### Verifikation

- [x] 233/233 Tests grün (232 Baseline + 1 Enum-Roundtrip)
- [x] `pnpm lint` 0 errors
- [x] `pnpm build` grün
- [x] Migration idempotent verifiziert (zweiter Run NO-OP via `IF NOT EXISTS`)

### Test plan

- [ ] CI prüft `pnpm lint`, `pnpm payload migrate`, `pnpm test`, `pnpm build`
- [ ] Nach Merge: optional Admin-UI-Smoke (Status auf `In Review` / `Archiviert` setzen → kein Error)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR-URL.

- [ ] **Step 3: CI grün abwarten**

Run: `gh pr checks <PR-Nummer> --watch`

Expected: `ci pass` nach ~1-2 min.

- [ ] **Step 4: Merge (nur nach User-Bestätigung)**

```bash
gh pr merge <PR-Nummer> --merge --delete-branch
```

Expected: Fast-Forward Merge, Branch lokal+remote weg, working tree clean.

- [ ] **Step 5: Lokal main aktualisieren**

```bash
git checkout main
git pull origin main
```

- [ ] **Step 6: Memory aktualisieren**

Update `/Users/oliverwosnitza/.claude/projects/-Users-oliverwosnitza/memory/project_pflegeatlas.md`:
- Side-Finding-Item als erledigt markieren mit PR-Nummer und Merge-Commit-SHA.
- Track-E-Backlog kürzen.

Update `MEMORY.md` Index-Zeile: HEAD-SHA, neuer Status.

Update `reference_pflegeatlas_docs.md`: Spec + Plan referenzieren.

---

## Out of Scope

- UI-Polishing (Reihenfolge/Labels im Dropdown).
- V1.6 Auth/Editorial-Workflow.
- Verändertes Markdown-Sync-Verhalten (V1.5-Hook bleibt).
- DSGVO/Compliance-Track.
- Homepage Community-Pull.

## Quellen

- Spec: `docs/superpowers/specs/2026-06-21-pflegeatlas-articles-status-enum-extend-design.md`
- Memory: `project_pflegeatlas.md` (Side-Finding aus PR #15)
- V1.4-Migration-Pattern: `src/migrations/20260605_140707_init.ts`
- V1.5-Lesson (Migration in index.ts): PR #15-Review I1
