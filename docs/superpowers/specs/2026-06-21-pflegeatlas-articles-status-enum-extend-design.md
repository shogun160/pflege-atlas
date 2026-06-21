# PflegeAtlas — Articles.status Enum-Erweiterung

**Datum:** 2026-06-21
**Status:** Spec
**Vorgänger:** PR #15/#16 (Status-Vereinheitlichung), HEAD `686820f` auf `main`

## Problem

Side-Finding aus dem Status-Unification-Plan (PR #15): Die DB-Enum
`enum_articles_status` enthält nur `{draft, published}`, das Code-Feld
`Articles.ts:222-225` listet aber vier Werte (`draft`, `in_review`,
`published`, `archived`). `in_review` und `archived` sind heute dead
code — Postgres würde Save-Versuche mit diesen Werten als Enum-
Constraint-Violation abweisen.

## Entscheidungen (Brainstorm 2026-06-21)

| Frage | Entscheidung |
|---|---|
| Kürzen oder erweitern? | **Erweitern.** Direkt-Edits an Articles (V1.5-Pfad) haben heute keinen Review-State; ein längerer Review-Zeitraum braucht Sichtbarkeit für andere im Team. `archived` hat klare „war mal published, jetzt nicht mehr"-Semantik, die `draft` nicht trägt. |
| Reihenfolge der Dropdown-Optionen | **Lebenszyklus** (Entwurf → In Review → Veröffentlicht → Archiviert). Status quo in `Articles.ts`, kein Touch. |

## Architektur

Eine Schema-Migration hängt zwei Werte ans bestehende
`enum_articles_status` an. Sonst nichts. Der Code in `Articles.ts`
listet die vier Werte bereits — die Migration macht sie nur DB-seitig
existent.

- **Reader-Access bleibt:** `status === 'published'` ist die einzige
  öffentlich sichtbare Stufe. `draft`, `in_review`, `archived` sind alle
  unsichtbar für anonyme Reader (siehe `Articles.ts:113-119`).
- **V1.5-Hook bleibt:** Der bestehende `afterArticleChangeHook`
  (`Articles.ts:30-89`) behandelt jeden Übergang
  `published → not-published` als Markdown-Delete und jeden Übergang
  `not-published → published` als Upsert. Damit sind alle vier neuen
  Übergangs-Kombinationen (`draft↔in_review`, `published↔archived`,
  `published↔in_review`) korrekt abgedeckt, ohne Hook-Änderung.
- **Submissions-`reviewStatus`** bleibt davon unberührt — das ist ein
  separates Feld auf einer anderen Collection für den PR-zu-Article-
  Flow.

## Touch-Liste

| Datei | Änderung |
|---|---|
| `src/migrations/20260621_140000_articles_status_enum_extend.ts` | Neu. `ALTER TYPE enum_articles_status ADD VALUE IF NOT EXISTS 'in_review'` + `'archived'`. `down()`-Stub. |
| `src/migrations/index.ts` | Migration registrieren (V1.4/V1.5/V1.6-Pattern). |
| `tests/integration/articles.test.ts` | Neuer Test: legt Article mit `status: 'in_review'` an, prüft Hidden-für-Anon, update auf `'archived'`, prüft dasselbe. Beweist DB-Roundtrip. |

**Nicht angefasst:** `Articles.ts`, `payload-types.ts`, Frontend-Queries,
Submission-Server-Actions, V1.5-Hook, `article-sync-hook.test.ts`.

## Migration

Manuelle Migration analog V1.4/V1.5-Muster (Payload-CLI hängt auf
non-TTY-stdin):

```ts
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE public.enum_articles_status ADD VALUE IF NOT EXISTS 'in_review';
    ALTER TYPE public.enum_articles_status ADD VALUE IF NOT EXISTS 'archived';
  `)
}
```

**Postgres-Quirk:** `ALTER TYPE ... ADD VALUE` ist seit PostgreSQL 12 in
Transaktionen erlaubt; ältere Versionen verlangten Außerhalb-der-
Transaktion-Ausführung. Wir laufen auf Postgres 16 (Docker
`pflegecommons-postgres` lokal, GitHub-Actions-Service `postgres:16-
alpine` in CI) — `ADD VALUE` in einer Migration ist sauber.

**`down()`** ist Stub (`throw new Error(...)`): Postgres lässt
Enum-Werte nicht trivial entfernen — man bräuchte einen
Recreate-Type-Replace-Column-Recreate-Index-Tanz, der für ein nicht
benutztes Feature unverhältnismäßig wäre. Analog V1-Init und PR #15.

**Lokale Migration-Auslieferung** wegen Payload-CLI-Hang: wir applien
über `docker exec ... psql -c "ALTER TYPE ..."` und inserten manuell
die `payload_migrations`-Row (V1.4-Lesson). In CI läuft `pnpm payload
migrate` regulär durch.

## Testing

| Ebene | Was wird geprüft |
|---|---|
| Bestehende Suite | Alle 232 Tests müssen weiter grün laufen. |
| Neuer Integration-Test | `articles.test.ts`: Article mit `status: 'in_review'` anlegen → Postgres akzeptiert (kein Constraint-Error), Reader-Access (anon `find`) findet ihn nicht. Update auf `status: 'archived'` → dasselbe. |
| Migration-Idempotenz | Zweimal hintereinander laufen lassen, zweiter Run NO-OP via `IF NOT EXISTS`. |
| Build | `pnpm build` grün. |
| Lint | 0 errors. |

Manuelle UI-Verifikation (optional): Im Admin einen Article auf „In
Review" stellen, speichern → kein Error. Dasselbe für „Archiviert".

## Risiken & Error Handling

| Risiko | Mitigation |
|---|---|
| Migration läuft in CI als Erst-Run gegen frische DB | `IF NOT EXISTS` macht safe; bei frischer DB sind die Werte noch nicht da, werden angelegt. |
| `payload-types.ts` regeneriert sich überraschend | Sollte nicht — die Type-Annotation kommt aus dem Code-Feld in `Articles.ts`, das ist unverändert. Falls doch: `pnpm payload generate:types` als Sanity-Run einsetzen. |
| Dev-Server-Schema-Sync (analog PR #15-Bug) | Nicht relevant: Code und DB driften nicht auseinander — Code listet die vier Werte schon, DB lernt sie dazu. Keine `DATA LOSS WARNING`. |

## Out of Scope

- UI-Polishing (Reihenfolge, Labels).
- V1.6 Auth/Editorial-Workflow.
- Markdown-Sync-Verhalten ändern (Hook bleibt wie er ist).
- DSGVO/Compliance-Track.

## Quellen

- Memory: `project_pflegeatlas.md`, Side-Finding aus PR #15.
- Code: `src/collections/Articles.ts` (`686820f`).
- V1.5-Hook: `Articles.ts:30-89`.
