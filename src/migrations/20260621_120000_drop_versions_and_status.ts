import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Status-Vereinheitlichung (Bug 3 aus Track F, 2026-06-20).
 *
 * - Löscht ~108 Test-Articles (`test-dekubitus-%`, `%-smoke-test-%`).
 *   Vorab geprüft: 0 FK-Refs auf diese Articles in submissions.
 * - Droppt Payloads native Versions-Tabellen `_articles_v` und
 *   `_articles_v_rels` (Folge von `versions.drafts: true` in
 *   Articles.ts, das mit diesem Plan entfernt wurde).
 * - Droppt `articles._status`-Spalte und den dazugehörigen Index.
 *
 * Idempotent: alle Operationen mit IF EXISTS-Guards, sodass die
 * Migration gegen leere DB (CI) sauber durchläuft und ein zweiter
 * lokaler Run no-op ist.
 *
 * `down()` ist Stub — Test-Articles und Versions-History sind nicht
 * rekonstruierbar (analog V1-Init-Migration).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      test_article_count INTEGER;
      fk_ref_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO test_article_count
        FROM articles
        WHERE slug LIKE 'test-dekubitus-%'
           OR slug LIKE '%-smoke-test-%';

      SELECT COUNT(*) INTO fk_ref_count
        FROM submissions
        WHERE related_article_id IN (
          SELECT id FROM articles
          WHERE slug LIKE 'test-dekubitus-%'
             OR slug LIKE '%-smoke-test-%'
        );

      RAISE NOTICE 'status-unification migration: % test articles, % submissions referencing them',
        test_article_count, fk_ref_count;

      IF fk_ref_count > 0 THEN
        DELETE FROM submissions
          WHERE related_article_id IN (
            SELECT id FROM articles
            WHERE slug LIKE 'test-dekubitus-%'
               OR slug LIKE '%-smoke-test-%'
          );
      END IF;

      DELETE FROM articles
        WHERE slug LIKE 'test-dekubitus-%'
           OR slug LIKE '%-smoke-test-%';
    END $$;

    DROP TABLE IF EXISTS public._articles_v_rels CASCADE;
    DROP TABLE IF EXISTS public._articles_v CASCADE;

    DROP TYPE IF EXISTS public.enum__articles_v_version_intent;
    DROP TYPE IF EXISTS public.enum__articles_v_version_status;

    DROP INDEX IF EXISTS public.articles__status_idx;
    ALTER TABLE public.articles DROP COLUMN IF EXISTS _status;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  throw new Error(
    'down() für status-unification ist nicht supported — Versions-History und Test-Articles sind nicht rekonstruierbar.',
  )
}
