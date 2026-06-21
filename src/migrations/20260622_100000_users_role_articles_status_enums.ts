import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * V1.6 Migration 1/4.
 *
 * Erweitert zwei Enums:
 * - `enum_users_role` um `'admin'` (zusätzlich zu editor/reviewer/contributor)
 * - `enum_articles_status` um `'ready_to_publish'` (Reviewer-fertig-Übergang)
 *
 * Pattern aus PR #17 (articles-status-enum-extend). Idempotent via IF NOT EXISTS.
 *
 * Die Promotion des initialen Admin-Records (Email `oliver.wosnitza@gmail.com`)
 * auf `role = 'admin'` erfolgt in einer separaten Folgemigration
 * (`20260622_100400_promote_initial_admin`), weil Postgres neue Enum-Werte erst
 * akzeptiert, nachdem die `ALTER TYPE ... ADD VALUE`-Transaktion committet ist.
 *
 * `down()` ist Stub — Postgres lässt Enum-Werte nicht trivial entfernen.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE public.enum_users_role ADD VALUE IF NOT EXISTS 'admin';
    ALTER TYPE public.enum_articles_status ADD VALUE IF NOT EXISTS 'ready_to_publish';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    'down() für v1-6 enum extensions nicht supported — Postgres lässt Enum-Werte nicht trivial entfernen.',
  )
}
