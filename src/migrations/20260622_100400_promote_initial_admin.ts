import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * V1.6 Migration 4/4 (Daten-Seed, idempotent).
 *
 * Promotet den initialen Admin-Record (Email `oliver.wosnitza@gmail.com`) auf
 * `role = 'admin'`. Läuft in eigener Transaktion NACH der enum-Erweiterung in
 * `20260622_100000_users_role_articles_status_enums`, damit Postgres den neuen
 * Enum-Wert akzeptiert.
 *
 * Wenn der Record nicht existiert (z.B. frische CI-DB), ist das ein No-Op
 * (UPDATE 0 rows).
 *
 * `down()` ist Stub — Daten-Seeds werden nicht rollback-fähig gehalten.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE public.users
       SET role = 'admin'
     WHERE email = 'oliver.wosnitza@gmail.com';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // No-op — initial-admin promotion ist Daten-Seed, kein Schema-Change.
}
