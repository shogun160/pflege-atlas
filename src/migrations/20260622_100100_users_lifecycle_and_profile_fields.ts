import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * V1.6 Migration 2/3.
 *
 * Users-Profile-Erweiterung:
 * - pflegerische_rolle (enum, optional)
 * - bundesland (enum, optional)
 * - avatar_id (FK auf media.id, optional)
 * - disabled (boolean, default false)
 * - set_password_token (text, indexed)
 * - set_password_token_expires_at (timestamp)
 * - invited_by_id (FK auf users.id, self-reference, optional)
 * - invited_at (timestamp)
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE public.enum_users_pflegerische_rolle AS ENUM (
        'pflegefachkraft', 'pdl', 'wbl', 'auszubildende', 'sonstiges'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE TYPE public.enum_users_bundesland AS ENUM (
        'baden_wuerttemberg', 'bayern', 'berlin', 'brandenburg', 'bremen',
        'hamburg', 'hessen', 'mecklenburg_vorpommern', 'niedersachsen',
        'nordrhein_westfalen', 'rheinland_pfalz', 'saarland', 'sachsen',
        'sachsen_anhalt', 'schleswig_holstein', 'thueringen',
        'oesterreich', 'schweiz', 'sonstiges'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS pflegerische_rolle public.enum_users_pflegerische_rolle,
      ADD COLUMN IF NOT EXISTS bundesland public.enum_users_bundesland,
      ADD COLUMN IF NOT EXISTS avatar_id integer REFERENCES public.media(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS set_password_token text,
      ADD COLUMN IF NOT EXISTS set_password_token_expires_at timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS invited_by_id integer REFERENCES public.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS invited_at timestamp(3) with time zone;

    CREATE INDEX IF NOT EXISTS users_set_password_token_idx
      ON public.users (set_password_token)
      WHERE set_password_token IS NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS public.users_set_password_token_idx;
    ALTER TABLE public.users
      DROP COLUMN IF EXISTS invited_at,
      DROP COLUMN IF EXISTS invited_by_id,
      DROP COLUMN IF EXISTS set_password_token_expires_at,
      DROP COLUMN IF EXISTS set_password_token,
      DROP COLUMN IF EXISTS disabled,
      DROP COLUMN IF EXISTS avatar_id,
      DROP COLUMN IF EXISTS bundesland,
      DROP COLUMN IF EXISTS pflegerische_rolle;
    DROP TYPE IF EXISTS public.enum_users_bundesland;
    DROP TYPE IF EXISTS public.enum_users_pflegerische_rolle;
  `)
}
