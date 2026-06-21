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
