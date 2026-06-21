import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * V1.6 T5 follow-up — Repair-Migration.
 *
 * Die T2-Migration `20260622_100200_submissions_articles_media_review_fields`
 * wurde laut `payload_migrations` als ausgeführt registriert, hat aber im
 * shared Dev-Postgres nur die Articles-Spalten persistiert. Die submissions-
 * + media-Spalten und die `submissions_rels`-Tabelle fehlen. Vermutlich ist
 * der mehrteilige `db.execute`-Block nach dem ersten ALTER abgebrochen
 * (DO $$-Blöcke + ALTER TYPE in derselben Transaktion sind tricky) — der
 * Migration-Runner hat die Row trotzdem als applied markiert (V1.6
 * Mystery-Trigger, vgl. dcb7e7d Folge-Fix).
 *
 * Diese Migration wiederholt die fehlenden Statements idempotent
 * (`IF NOT EXISTS` / `CREATE TYPE` mit EXCEPTION-Handler) — bei einer
 * frischen DB, in der T2 vollständig durchlief, ist sie ein No-Op.
 *
 * Felder, die T5 (Submissions.ts + Media.ts) jetzt braucht:
 * - submissions.submitted_by_id (FK → users)
 * - submissions.current_reviewer_id (FK → users)
 * - submissions_rels (Payload-M2M-Tabelle für reviewedBy hasMany)
 * - media.purpose (enum: avatar/article_image/other, default 'other')
 * - media.uploaded_by_id (FK → users)
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.submissions
      ADD COLUMN IF NOT EXISTS submitted_by_id integer REFERENCES public.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS current_reviewer_id integer REFERENCES public.users(id) ON DELETE SET NULL;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='submissions_rels'
      ) THEN
        CREATE TABLE public.submissions_rels (
          id serial PRIMARY KEY,
          "order" integer,
          parent_id integer NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
          path varchar NOT NULL,
          users_id integer REFERENCES public.users(id) ON DELETE CASCADE
        );
        CREATE INDEX submissions_rels_order_idx ON public.submissions_rels ("order");
        CREATE INDEX submissions_rels_parent_idx ON public.submissions_rels (parent_id);
        CREATE INDEX submissions_rels_path_idx ON public.submissions_rels (path);
        CREATE INDEX submissions_rels_users_id_idx ON public.submissions_rels (users_id);
      ELSE
        ALTER TABLE public.submissions_rels
          ADD COLUMN IF NOT EXISTS users_id integer REFERENCES public.users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS submissions_rels_order_idx ON public.submissions_rels ("order");
        CREATE INDEX IF NOT EXISTS submissions_rels_parent_idx ON public.submissions_rels (parent_id);
        CREATE INDEX IF NOT EXISTS submissions_rels_path_idx ON public.submissions_rels (path);
        CREATE INDEX IF NOT EXISTS submissions_rels_users_id_idx ON public.submissions_rels (users_id);
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE public.enum_media_purpose AS ENUM ('avatar', 'article_image', 'other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await db.execute(sql`
    ALTER TABLE public.media
      ADD COLUMN IF NOT EXISTS purpose public.enum_media_purpose NOT NULL DEFAULT 'other',
      ADD COLUMN IF NOT EXISTS uploaded_by_id integer REFERENCES public.users(id) ON DELETE SET NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.media
      DROP COLUMN IF EXISTS uploaded_by_id,
      DROP COLUMN IF EXISTS purpose;
    DROP TYPE IF EXISTS public.enum_media_purpose;

    DROP INDEX IF EXISTS public.submissions_rels_order_idx;
    DROP INDEX IF EXISTS public.submissions_rels_path_idx;
    DROP INDEX IF EXISTS public.submissions_rels_parent_idx;
    DROP INDEX IF EXISTS public.submissions_rels_users_id_idx;
    DROP TABLE IF EXISTS public.submissions_rels;

    ALTER TABLE public.submissions
      DROP COLUMN IF EXISTS current_reviewer_id,
      DROP COLUMN IF EXISTS submitted_by_id;
  `)
}
