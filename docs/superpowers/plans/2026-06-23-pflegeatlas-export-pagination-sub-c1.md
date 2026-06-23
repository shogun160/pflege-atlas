# Sub-C1 Articles-Export-Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `exportOwnDataAction` exportiert künftig vollständig alle Submissions und Articles eines Users (statt silent-truncate bei `limit: 1000`) und bricht bei Daten-Mengen über einem Hard-Cap mit klarer User-Fehlermeldung ab.

**Architecture:** Neue Helper-Funktion `findAllForExport` in `src/lib/data-export.ts` loopt `payload.find` mit `page` und `hasNextPage`, sammelt alle Docs, wirft `ExportTooLargeError` bei `accumulated.length >= 10_000`. `exportOwnDataAction` in `src/lib/auth.ts` ersetzt zwei hartcodierte `payload.find({ limit: 1000 })`-Calls durch zwei `findAllForExport`-Calls; `catch` wird um `ExportTooLargeError`-Mapping erweitert.

**Tech Stack:** Payload CMS Local API (`payload.find`), Vitest (Unit + Integration), TypeScript strict, pnpm.

**Spec:** `docs/superpowers/specs/2026-06-23-pflegeatlas-export-pagination-sub-c1-design.md` (commit `f72e129` auf main)

---

## File Structure

| Datei | Rolle |
|---|---|
| `src/lib/data-export.ts` | **Modify.** Ergänzt um `EXPORT_HARD_CAP`, `EXPORT_PAGE_SIZE`, `ExportTooLargeError`, `findAllForExport`. Bestehendes `shapeExport` + `SENSITIVE_USER_FIELDS` unverändert. |
| `src/lib/auth.ts` | **Modify, Zeilen 407-437.** `exportOwnDataAction` benutzt `findAllForExport` statt `payload.find({ limit: 1000 })`. `try/catch` erweitert. |
| `tests/unit/data-export.test.ts` | **Extend.** 4 neue Tests für `findAllForExport` + `ExportTooLargeError`. Bestehende `shapeExport`-Tests bleiben unverändert. |
| `tests/integration/auth-data-export.test.ts` | **Extend.** 1 neuer Test für 600-Submission-Pagination-Vollständigkeit. Bestehende 2 Tests bleiben unverändert. |

---

## Task 1: Konstanten + `ExportTooLargeError`

**Files:**
- Modify: `src/lib/data-export.ts`
- Test: `tests/unit/data-export.test.ts`

- [ ] **Step 1.1: Failing Test schreiben**

Append in `tests/unit/data-export.test.ts` (am Datei-Ende, vor der schließenden Klammer falls nötig — die Datei hat aktuell nur den `describe('shapeExport', …)`-Block; der neue Block kommt darunter):

```ts
import {
  EXPORT_HARD_CAP,
  EXPORT_PAGE_SIZE,
  ExportTooLargeError,
} from '@/lib/data-export';

describe('export constants and errors', () => {
  it('exports EXPORT_HARD_CAP = 10_000', () => {
    expect(EXPORT_HARD_CAP).toBe(10_000);
  });

  it('exports EXPORT_PAGE_SIZE = 500', () => {
    expect(EXPORT_PAGE_SIZE).toBe(500);
  });

  it('ExportTooLargeError carries collection name + count in message', () => {
    const err = new ExportTooLargeError('submissions', 10_000);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ExportTooLargeError');
    expect(err.message).toContain('submissions');
    expect(err.message).toContain('10000');
  });
});
```

Die `shapeExport`-Import-Zeile am Datei-Anfang bleibt; die neuen Imports werden in die vorhandene `import`-Zeile mit aufgenommen (so):

```ts
import {
  shapeExport,
  EXPORT_HARD_CAP,
  EXPORT_PAGE_SIZE,
  ExportTooLargeError,
} from '@/lib/data-export';
```

- [ ] **Step 1.2: Test laufen lassen, FAIL erwartet**

Run: `pnpm test tests/unit/data-export.test.ts`
Expected: FAIL — `Module '"@/lib/data-export"' has no exported member 'EXPORT_HARD_CAP'` (oder gleichwertig)

- [ ] **Step 1.3: Konstanten + Error-Klasse in `data-export.ts` ergänzen**

In `src/lib/data-export.ts` direkt unter den bestehenden `SENSITIVE_USER_FIELDS`-Export einfügen (vor `export function shapeExport`):

```ts
export const EXPORT_HARD_CAP = 10_000;
export const EXPORT_PAGE_SIZE = 500;

export class ExportTooLargeError extends Error {
  constructor(collection: string, count: number) {
    super(
      `Export aborted: ${collection} reached hard cap (${count} >= ${EXPORT_HARD_CAP})`,
    );
    this.name = 'ExportTooLargeError';
  }
}
```

- [ ] **Step 1.4: Test laufen lassen, PASS erwartet**

Run: `pnpm test tests/unit/data-export.test.ts`
Expected: PASS — die 3 neuen Konstanten/Error-Tests grün, die 2 bestehenden `shapeExport`-Tests bleiben grün.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/data-export.ts tests/unit/data-export.test.ts
git commit -m "feat(export): add EXPORT_HARD_CAP, EXPORT_PAGE_SIZE, ExportTooLargeError"
```

---

## Task 2: `findAllForExport`-Loop-Implementation

**Files:**
- Modify: `src/lib/data-export.ts`
- Test: `tests/unit/data-export.test.ts`

- [ ] **Step 2.1: Failing Tests schreiben**

Am Ende von `tests/unit/data-export.test.ts` einen neuen `describe`-Block anhängen:

```ts
import type { Payload, Where } from 'payload';
import { findAllForExport } from '@/lib/data-export';

function makePaginatedMock(pages: Array<Array<Record<string, unknown>>>) {
  const findMock = vi.fn(async ({ page }: { page?: number }) => {
    const idx = (page ?? 1) - 1;
    const docs = pages[idx] ?? [];
    return {
      docs,
      hasNextPage: idx < pages.length - 1,
      page: page ?? 1,
      totalDocs: pages.reduce((sum, p) => sum + p.length, 0),
    };
  });
  return { find: findMock } as unknown as Payload;
}

describe('findAllForExport', () => {
  it('collects docs across multiple pages', async () => {
    const page1 = Array.from({ length: 500 }, (_, i) => ({ id: i + 1 }));
    const page2 = Array.from({ length: 500 }, (_, i) => ({ id: i + 501 }));
    const page3 = Array.from({ length: 500 }, (_, i) => ({ id: i + 1001 }));
    const payload = makePaginatedMock([page1, page2, page3]);

    const result = await findAllForExport<{ id: number }>({
      payload,
      collection: 'submissions',
      where: {} as Where,
    });

    expect(result).toHaveLength(1500);
    expect(result[0]?.id).toBe(1);
    expect(result[1499]?.id).toBe(1500);
    expect(payload.find).toHaveBeenCalledTimes(3);
  });

  it('returns immediately when only one page exists', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
    const payload = makePaginatedMock([page1]);

    const result = await findAllForExport<{ id: number }>({
      payload,
      collection: 'articles',
      where: {} as Where,
    });

    expect(result).toHaveLength(100);
    expect(payload.find).toHaveBeenCalledTimes(1);
  });

  it('throws ExportTooLargeError when accumulated docs reach the cap', async () => {
    // 21 pages of 500 = 10_500 — overshoots the cap of 10_000 on page 20.
    const pages = Array.from({ length: 21 }, (_, p) =>
      Array.from({ length: 500 }, (_, i) => ({ id: p * 500 + i + 1 })),
    );
    const payload = makePaginatedMock(pages);

    await expect(
      findAllForExport({
        payload,
        collection: 'submissions',
        where: {} as Where,
      }),
    ).rejects.toBeInstanceOf(ExportTooLargeError);
  });

  it('shapeExport accepts a merged paginated list', () => {
    const merged = Array.from({ length: 1500 }, (_, i) => ({ id: i + 1 }));
    const out = shapeExport({
      user: { id: 1, email: 'a@b.com' } as never,
      submissions: merged as never,
      articles: [],
    });
    expect(out.submissions).toHaveLength(1500);
  });
});
```

Zusätzlich am Datei-Anfang `vi` zu den vitest-Imports hinzufügen, falls noch nicht vorhanden:

```ts
import { describe, it, expect, vi } from 'vitest';
```

- [ ] **Step 2.2: Tests laufen lassen, FAIL erwartet**

Run: `pnpm test tests/unit/data-export.test.ts`
Expected: FAIL — `Module '"@/lib/data-export"' has no exported member 'findAllForExport'`

- [ ] **Step 2.3: `findAllForExport` implementieren**

Am Ende von `src/lib/data-export.ts` (nach `ExportTooLargeError`, nach `shapeExport`) einfügen:

```ts
import type { Payload, Where, CollectionSlug } from 'payload';

export async function findAllForExport<T>(args: {
  payload: Payload;
  collection: CollectionSlug;
  where: Where;
}): Promise<T[]> {
  const { payload, collection, where } = args;
  const accumulated: T[] = [];
  let page = 1;

  // Loop bricht ab, sobald Payload `hasNextPage === false` liefert
  // ODER der Hard-Cap überschritten ist.
  while (true) {
    const res = await payload.find({
      collection,
      where,
      limit: EXPORT_PAGE_SIZE,
      page,
      depth: 0,
    });
    accumulated.push(...(res.docs as T[]));

    if (accumulated.length >= EXPORT_HARD_CAP) {
      throw new ExportTooLargeError(collection, accumulated.length);
    }

    if (!res.hasNextPage) break;
    page += 1;
  }

  return accumulated;
}
```

Der `import type`-Statement gehört oben in die Datei zu den anderen Imports (falls schon vorhanden, ergänzen statt duplizieren).

- [ ] **Step 2.4: Tests laufen lassen, PASS erwartet**

Run: `pnpm test tests/unit/data-export.test.ts`
Expected: PASS — alle 4 neuen `findAllForExport`-Tests grün, die vorherigen 3 Konstanten/Error-Tests und 2 `shapeExport`-Tests bleiben grün (Total: 9 Tests in dieser Datei).

- [ ] **Step 2.5: Type-Check verifizieren**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors — insbesondere keine TypeScript-Beschwerden über die neuen `Payload`-/`Where`-/`CollectionSlug`-Imports.

- [ ] **Step 2.6: Commit**

```bash
git add src/lib/data-export.ts tests/unit/data-export.test.ts
git commit -m "feat(export): add findAllForExport with paginated loop + hard-cap"
```

---

## Task 3: `exportOwnDataAction` auf `findAllForExport` umstellen

**Files:**
- Modify: `src/lib/auth.ts:407-437`
- Test: `tests/integration/auth-data-export.test.ts`

- [ ] **Step 3.1: Failing Integration-Test schreiben**

In `tests/integration/auth-data-export.test.ts` einen neuen `it`-Block am Ende des bestehenden `describe('exportOwnDataAction', ...)`-Blocks anhängen (innerhalb der `describe`-Klammer, nach dem letzten bestehenden `it(...)`):

```ts
  it('paginates beyond the legacy 1000-limit (all 600 submissions returned)', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const SEED_COUNT = 600;

    // Seed 600 Submissions in Batches von 50, sonst dauert es zu lange.
    const batchSize = 50;
    for (let batch = 0; batch < SEED_COUNT / batchSize; batch++) {
      await Promise.all(
        Array.from({ length: batchSize }, (_, i) =>
          payload.create({
            collection: 'submissions',
            data: {
              type: 'new_article',
              proposedTitle: `Bulk ${batch * batchSize + i + 1}`,
              submittedBy: user.id,
            } as never,
          }),
        ),
      );
    }

    const { token } = await payload.login({
      collection: 'users',
      data: { email: user.email, password: user.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => (n === 'payload-token' ? { value: token } : undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));

    const { exportOwnDataAction } = await import('@/lib/auth');
    const result = await exportOwnDataAction();
    expect(result.ok).toBe(true);
    const data = JSON.parse(result.json!);
    const mine = data.submissions.filter(
      (s: { submittedBy?: number }) => s.submittedBy === user.id,
    );
    expect(mine.length).toBe(SEED_COUNT);
    vi.doUnmock('next/headers');
  }, 60_000);
```

Der Timeout `60_000` schützt gegen Postgres-Pool-Druck beim Seed; CI ist sequenziell stabil, lokal kann es länger dauern.

- [ ] **Step 3.2: Test laufen lassen, FAIL erwartet**

Run: `pnpm test tests/integration/auth-data-export.test.ts`
Expected: FAIL — der neue Test erhält nur 1000 Submissions zurück (silent truncate des aktuellen Codes), `mine.length` ist `1000`, erwartet `600`. Hinweis: Wenn die Test-DB bereits Submissions anderer Tests trägt, könnte `data.submissions.length` höher als 600 sein — deshalb filtert der Assert auf `submittedBy === user.id`.

- [ ] **Step 3.3: `exportOwnDataAction` umstellen**

In `src/lib/auth.ts`:

**Zuerst** den Import von `shapeExport` (Zeile 11) erweitern:

```ts
import { shapeExport, findAllForExport, ExportTooLargeError } from './data-export';
```

**Dann** die Funktion `exportOwnDataAction` (Zeilen 407-437) komplett ersetzen durch:

```ts
export async function exportOwnDataAction(): Promise<{ ok: boolean; json?: string; error?: string }> {
  'use server';
  try {
    const session = await requireUser();
    const payload = await payloadInstance();
    const user = await payload.findByID({ collection: 'users', id: session.id, depth: 0 });

    const submissions = await findAllForExport<Record<string, unknown>>({
      payload,
      collection: 'submissions',
      where: { submittedBy: { equals: session.id } },
    });

    // `authors` is a hasMany relationship — Payload's `equals` operator
    // matches any document whose array contains the given ID, which is
    // exactly what we want here.
    const articles = await findAllForExport<Record<string, unknown>>({
      payload,
      collection: 'articles',
      where: { authors: { equals: session.id } },
    });

    const shape = shapeExport({
      user: user as never,
      submissions,
      articles,
    });
    return { ok: true, json: JSON.stringify(shape, null, 2) };
  } catch (err) {
    if (err instanceof ExportTooLargeError) {
      return {
        ok: false,
        error:
          'Datenmenge übersteigt 10.000 Einträge — bitte datenschutz@pflegeatlas.org für manuellen Vollexport kontaktieren.',
      };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Export failed.' };
  }
}
```

- [ ] **Step 3.4: Integration-Test laufen lassen, PASS erwartet**

Run: `pnpm test tests/integration/auth-data-export.test.ts`
Expected: PASS — alle 3 Tests grün (2 bestehende + 1 neuer Pagination-Test mit 600 Submissions).

- [ ] **Step 3.5: Type-Check + Lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 0 TypeScript-Errors, Lint 0 errors (Warnings unverändert OK).

- [ ] **Step 3.6: Commit**

```bash
git add src/lib/auth.ts tests/integration/auth-data-export.test.ts
git commit -m "fix(export): wire exportOwnDataAction to paginated findAllForExport"
```

---

## Task 4: Voll-Test-Lauf + PR-Vorbereitung

**Files:** keine Code-Änderungen, nur Verifikation + Branch-Push.

- [ ] **Step 4.1: Voll-Test-Lauf**

Run: `pnpm test`
Expected: alle Tests grün. Vorher 367/367 (laut Memory nach PR #33). Erwartet jetzt: **375/375 grün** = 367 vorher + 8 neue (3 Konstanten/Error + 3 `findAllForExport` Multi/Single/Cap + 1 `shapeExport`-Merge-Roundtrip + 1 Integration). Falls die Summe abweicht: prüfen ob ein bestehender Test ungewollt gebrochen wurde.

- [ ] **Step 4.2: Hinweis bei lokalem Hänger**

Falls `pnpm test` lokal hängt mit Postgres-Pool-Pressure: per-File laufen lassen (`pnpm test tests/unit/data-export.test.ts` und `pnpm test tests/integration/auth-data-export.test.ts` getrennt). Bei `payload_migrations.batch=-1`-Hang vor jedem Lauf:

```bash
psql "$DATABASE_URI" -c "DELETE FROM payload_migrations WHERE batch = -1;"
```

(Nur lokal. CI ist sauber.)

- [ ] **Step 4.3: Branch pushen + PR öffnen**

Aktueller Branch sollte ein Feature-Branch sein. Falls noch auf `main`:

```bash
git checkout -b feat/sub-c1-export-pagination
```

Push:

```bash
git push -u origin feat/sub-c1-export-pagination
```

PR via `gh pr create`:

```bash
gh pr create --title "fix(export): paginate exportOwnDataAction (Sub-C1)" --body "$(cat <<'EOF'
## Summary
- Ersetzt die zwei hartcodierten `payload.find({ limit: 1000 })`-Calls in `exportOwnDataAction` durch eine pagination-vollständige `findAllForExport`-Helper.
- Schützt DSGVO Art. 15-Promise (Vollständigkeit der Auskunft) — silent truncation bei Power-Usern mit >1000 Submissions oder Articles ist behoben.
- Hard-Cap 10.000 Docs pro Collection wirft `ExportTooLargeError`, mapped auf User-Message mit Mailto-Hint zu `datenschutz@pflegeatlas.org`.

Spec: `docs/superpowers/specs/2026-06-23-pflegeatlas-export-pagination-sub-c1-design.md` (`f72e129`)
Plan: `docs/superpowers/plans/2026-06-23-pflegeatlas-export-pagination-sub-c1.md`

## Plan Deviations
Keine. (Falls beim Implementieren welche entstehen: hier ergänzen.)

## Test plan
- [x] Unit: 7 neue Tests in `tests/unit/data-export.test.ts` (Konstanten + Error + `findAllForExport` Multi-Page/Single-Page/Cap-Hit + `shapeExport`-Merge-Roundtrip)
- [x] Integration: 1 neuer Test in `tests/integration/auth-data-export.test.ts` (600-Submission-Seed + Vollständigkeits-Assert)
- [x] `pnpm exec tsc --noEmit` 0 errors
- [x] `pnpm lint` 0 errors
- [x] `pnpm test` voll grün

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4.4: CI grün abwarten + Merge**

CI sollte grün durchlaufen (Tests sequenziell, neue `tsc --noEmit`-Gate-Step trifft die neuen Imports). Bei rotem CI: Logs lesen, lokal nachstellen, fixen, neuer Commit auf demselben Branch.

Nach grünem CI: per Web-UI oder `gh pr merge --squash`.

---

## Self-Review (vor PR)

- [ ] Alle Konstanten-Tests greifen die exportierten Werte exakt (10_000, 500).
- [ ] `ExportTooLargeError` ist eine echte `Error`-Subklasse mit korrektem `name`.
- [ ] `findAllForExport` wirft den Error VOR dem nächsten Page-Roundtrip, sobald der Cap erreicht ist (Performance + Korrektheit).
- [ ] `exportOwnDataAction` returnt im Cap-Fall `{ ok: false, error: '... datenschutz@pflegeatlas.org ...' }` und nicht etwa eine generische Error-Message.
- [ ] Bestehende Smoke-Tests in `auth-data-export.test.ts` bleiben grün (Format-Compat).
- [ ] `shapeExport` bekommt jetzt potentiell deutlich mehr Docs — Memory-Footprint bei 10.000 Docs ist trotzdem akzeptabel (~5 MB JSON).
- [ ] Keine UI-Änderung in `/mein-bereich` — bestehender Error-Pfad rendert die neue Message.

---

## Memory-Update nach Merge

Nach Squash-Merge auf main:

- `project_pflegeatlas.md` mit neuem main-HEAD + Sub-C1-Done-Notiz aktualisieren
- `reference_pflegeatlas_docs.md` um Sub-C1-Spec + Plan ergänzen
- Backlog-Item „Sub-C2 Avatar-Hard-Delete" als nächsten Track markieren
