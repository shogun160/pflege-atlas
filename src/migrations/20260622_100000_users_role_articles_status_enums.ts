import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * V1.6 Migration 1/3.
 *
 * Erweitert zwei Enums:
 * - `enum_users_role` um `'admin'` (zusätzlich zu editor/reviewer/contributor)
 * - `enum_articles_status` um `'ready_to_publish'` (Reviewer-fertig-Übergang)
 *
 * Pattern aus PR #17 (articles-status-enum-extend). Idempotent via IF NOT EXISTS.
 *
 * Setzt zusätzlich Olivers User-Record auf 'admin', sofern vorhanden.
 * Email-Identifikation: `oliver.wosnitza@gmail.com`. Wenn der Record nicht
 * existiert, ist das ein No-Op (UPDATE 0 rows).
 *
 * `down()` ist Stub — Postgres lässt Enum-Werte nicht trivial entfernen.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE public.enum_users_role ADD VALUE IF NOT EXISTS 'admin';
    ALTER TYPE public.enum_articles_status ADD VALUE IF NOT EXISTS 'ready_to_publish';
  `)

  // Olivers Record auf admin promoten (No-Op wenn Record nicht da)
  await db.execute(sql`
    UPDATE public.users
       SET role = 'admin'
     WHERE email = 'oliver.wosnitza@gmail.com';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    'down() für v1-6 enum extensions nicht supported — Postgres lässt Enum-Werte nicht trivial entfernen.',
  )
}
