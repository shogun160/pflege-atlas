import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * V1.7.1 follow-up — FK-Naming-Consistency.
 *
 * Die V1.6-Migrationen `20260622_100200_..._review_fields` und
 * `20260622_100300_..._repair` haben FK-Constraints via inline
 * `REFERENCES public.users(id)` ohne `CONSTRAINT name` angelegt.
 * Postgres-Default-Naming dafür ist `{table}_{column}_fkey`.
 *
 * Drizzle-Code-Schema (Payload-generiert) erwartet aber
 * `{table}_{column}_{refTable}_{refCol}_fk`. Auf Production-DBs die
 * über die Migrationen aufgebaut wurden entstand dadurch ein Schema-
 * Drift, den Payloads Dev-Adapter via stdin-Prompt fixen wollte
 * („Push schema?") — was auf Vercel ohne TTY zum 45-Min-Build-Hang
 * führte (V1.7 Hotfix `push: false`, PR #21).
 *
 * Pikant: Die aktuelle Production-DB hat die Drizzle-Naming-FKs schon
 * (vermutlich weil V1.6-Bring-Up über lokalen `payload migrate` mit
 * Dev-Adapter lief, der via Drizzle-Push die FKs vor den Migrationen
 * erstellt hat → `ADD COLUMN IF NOT EXISTS` not-firing). Diese
 * Migration ist daher **auf der aktuellen Production ein No-Op**.
 *
 * Wert: Future-Proofing für Phase-2-Migration zu Hetzner+Coolify, wo
 * die Migrations gegen eine frische DB laufen — dort würden 100200/
 * 100300 wieder `_fkey`-Namen erzeugen und der Drift wäre zurück.
 *
 * Idempotenz:
 *   - DROP CONSTRAINT IF EXISTS findet die Postgres-Default-Namen
 *     (falls vorhanden) und entfernt sie. No-Op wenn nicht da.
 *   - DO-Block prüft Existenz des Drizzle-Style-Namens vor ADD, weil
 *     Postgres kein `ADD CONSTRAINT IF NOT EXISTS` kennt.
 *
 * Betroffene FKs:
 *   - articles.current_reviewer_id  → users.id
 *   - submissions.submitted_by_id   → users.id
 *   - submissions.current_reviewer_id → users.id
 *   - media.uploaded_by_id          → users.id
 */

type FkRename = {
  table: string
  column: string
  refTable: string
  refColumn: string
  onDelete: 'SET NULL' | 'CASCADE'
}

const RENAMES: FkRename[] = [
  { table: 'articles',    column: 'current_reviewer_id', refTable: 'users', refColumn: 'id', onDelete: 'SET NULL' },
  { table: 'submissions', column: 'submitted_by_id',     refTable: 'users', refColumn: 'id', onDelete: 'SET NULL' },
  { table: 'submissions', column: 'current_reviewer_id', refTable: 'users', refColumn: 'id', onDelete: 'SET NULL' },
  { table: 'media',       column: 'uploaded_by_id',      refTable: 'users', refColumn: 'id', onDelete: 'SET NULL' },
]

const drizzleName = ({ table, column, refTable, refColumn }: FkRename) =>
  `${table}_${column}_${refTable}_${refColumn}_fk`

const postgresDefaultName = ({ table, column }: FkRename) =>
  `${table}_${column}_fkey`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const fk of RENAMES) {
    const drizzle = drizzleName(fk)
    const pgDefault = postgresDefaultName(fk)

    // 1. Drop Postgres-Default-FK if present (no-op on Drizzle-only DBs)
    await db.execute(sql.raw(`
      ALTER TABLE public.${fk.table}
        DROP CONSTRAINT IF EXISTS ${pgDefault};
    `))

    // 2. Conditionally add Drizzle-Style-FK (Postgres has no IF NOT EXISTS for ADD CONSTRAINT)
    await db.execute(sql.raw(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = '${drizzle}'
            AND conrelid = 'public.${fk.table}'::regclass
        ) THEN
          ALTER TABLE public.${fk.table}
            ADD CONSTRAINT ${drizzle}
            FOREIGN KEY (${fk.column}) REFERENCES public.${fk.refTable}(${fk.refColumn}) ON DELETE ${fk.onDelete};
        END IF;
      END $$;
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverse: drop Drizzle-Style-FK + re-add Postgres-Default-FK.
  // Mirror of up() for clean rollback; same idempotency guards.
  for (const fk of RENAMES) {
    const drizzle = drizzleName(fk)
    const pgDefault = postgresDefaultName(fk)

    await db.execute(sql.raw(`
      ALTER TABLE public.${fk.table}
        DROP CONSTRAINT IF EXISTS ${drizzle};
    `))

    await db.execute(sql.raw(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = '${pgDefault}'
            AND conrelid = 'public.${fk.table}'::regclass
        ) THEN
          ALTER TABLE public.${fk.table}
            ADD CONSTRAINT ${pgDefault}
            FOREIGN KEY (${fk.column}) REFERENCES public.${fk.refTable}(${fk.refColumn}) ON DELETE ${fk.onDelete};
        END IF;
      END $$;
    `))
  }
}
