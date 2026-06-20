import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * V1.5 — adds PR-tracking columns to submissions:
 *   - proposed_slug (text, nullable, new_article only)
 *   - pr_number (integer, nullable)
 *   - pr_branch (text, nullable)
 *   - pr_state (enum 'open'/'merged'/'closed', nullable)
 *
 * Hand-written because `pnpm payload migrate:create` hangs on non-TTY stdin
 * in this shell (V1.4-lesson).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_submissions_pr_state" AS ENUM ('open', 'merged', 'closed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await db.execute(sql`
    ALTER TABLE "submissions"
      ADD COLUMN IF NOT EXISTS "proposed_slug" varchar,
      ADD COLUMN IF NOT EXISTS "pr_number" numeric,
      ADD COLUMN IF NOT EXISTS "pr_branch" varchar,
      ADD COLUMN IF NOT EXISTS "pr_state" "enum_submissions_pr_state";
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "submissions"
      DROP COLUMN IF EXISTS "proposed_slug",
      DROP COLUMN IF EXISTS "pr_number",
      DROP COLUMN IF EXISTS "pr_branch",
      DROP COLUMN IF EXISTS "pr_state";
  `);
  await db.execute(sql`DROP TYPE IF EXISTS "enum_submissions_pr_state";`);
}
