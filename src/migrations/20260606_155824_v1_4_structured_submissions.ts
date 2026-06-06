import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * V1.4 — Strukturierte Submissions.
 *
 * Replaces `subject` + `body` (single free-text fields) with a type-dependent
 * schema:
 * - `new_article`: proposed_title + optional proposed_intent + optional
 *   proposed_summary + 4 jsonb sections (definition/praxis/risiken/quellen)
 * - `correction`: 4 optional jsonb edited_* sections + optional
 *   correction_reason. `selected_sections` lives only in the form/action
 *   request and is not persisted directly — sections with non-null edited_*
 *   values are the source of truth in the DB.
 * - common: `display_title` is set via beforeChange-Hook for the admin list view.
 *
 * Clean cut: no existing production submissions, lokal vor Migration via
 * TRUNCATE submissions CASCADE geleert.
 *
 * Self-contained against an empty DB once the V1 init migration has run.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE public.enum_submissions_proposed_intent AS ENUM (
      'bedside',
      'background',
      'learning'
    );

    ALTER TABLE public.submissions DROP COLUMN subject;
    ALTER TABLE public.submissions DROP COLUMN body;

    ALTER TABLE public.submissions ADD COLUMN display_title character varying;
    ALTER TABLE public.submissions ADD COLUMN proposed_title character varying;
    ALTER TABLE public.submissions ADD COLUMN proposed_intent public.enum_submissions_proposed_intent;
    ALTER TABLE public.submissions ADD COLUMN proposed_summary character varying;
    ALTER TABLE public.submissions ADD COLUMN proposed_definition jsonb;
    ALTER TABLE public.submissions ADD COLUMN proposed_praxis jsonb;
    ALTER TABLE public.submissions ADD COLUMN proposed_risiken jsonb;
    ALTER TABLE public.submissions ADD COLUMN proposed_quellen jsonb;
    ALTER TABLE public.submissions ADD COLUMN edited_definition jsonb;
    ALTER TABLE public.submissions ADD COLUMN edited_praxis jsonb;
    ALTER TABLE public.submissions ADD COLUMN edited_risiken jsonb;
    ALTER TABLE public.submissions ADD COLUMN edited_quellen jsonb;
    ALTER TABLE public.submissions ADD COLUMN correction_reason character varying;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS correction_reason;
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS edited_quellen;
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS edited_risiken;
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS edited_praxis;
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS edited_definition;
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS proposed_quellen;
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS proposed_risiken;
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS proposed_praxis;
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS proposed_definition;
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS proposed_summary;
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS proposed_intent;
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS proposed_title;
    ALTER TABLE public.submissions DROP COLUMN IF EXISTS display_title;

    ALTER TABLE public.submissions ADD COLUMN subject character varying NOT NULL DEFAULT '';
    ALTER TABLE public.submissions ADD COLUMN body character varying NOT NULL DEFAULT '';

    DROP TYPE IF EXISTS public.enum_submissions_proposed_intent;
  `)
}
