import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * V1.6 Migration 3/3.
 *
 * Review-Tracking-Felder:
 * - articles.current_reviewer_id (FK → users)
 * - submissions.submitted_by_id (FK → users, auto-fill bei eingeloggtem create)
 * - submissions.current_reviewer_id (FK → users)
 * - submissions_rels (Payload-M2M-Tabelle für reviewedBy hasMany)
 *   — Payload erzeugt diese Tabelle bei `hasMany: true`-Feldern. Wir
 *     legen sie hier nur an, falls sie nicht schon existiert.
 * - media.purpose (enum: avatar/article_image/other, default 'other')
 * - media.uploaded_by_id (FK → users)
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Articles
    ALTER TABLE public.articles
      ADD COLUMN IF NOT EXISTS current_reviewer_id integer REFERENCES public.users(id) ON DELETE SET NULL;

    -- Submissions
    ALTER TABLE public.submissions
      ADD COLUMN IF NOT EXISTS submitted_by_id integer REFERENCES public.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS current_reviewer_id integer REFERENCES public.users(id) ON DELETE SET NULL;

    -- submissions.reviewedBy (hasMany) wird via submissions_rels-Tabelle gehandelt,
    -- die Payload bei jedem hasMany-Field anlegt. Falls bereits vorhanden (V1.5),
    -- ergänzen wir nur die für reviewedBy nötige Spalte 'users_id' falls fehlt.
    -- Payload-Konvention: submissions_rels(parent_id, path, users_id) — wir prüfen
    -- ob users_id-Column existiert.
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

    -- Media
    DO $$ BEGIN
      CREATE TYPE public.enum_media_purpose AS ENUM ('avatar', 'article_image', 'other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
    ALTER TABLE public.submissions_rels DROP COLUMN IF EXISTS users_id;

    ALTER TABLE public.submissions
      DROP COLUMN IF EXISTS current_reviewer_id,
      DROP COLUMN IF EXISTS submitted_by_id;

    ALTER TABLE public.articles
      DROP COLUMN IF EXISTS current_reviewer_id;
  `)
}
