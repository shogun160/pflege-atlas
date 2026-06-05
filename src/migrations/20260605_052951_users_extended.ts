import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('editor', 'reviewer', 'contributor');
  ALTER TABLE "users"
    ADD COLUMN "display_name" varchar NOT NULL DEFAULT '',
    ADD COLUMN "role" "enum_users_role" NOT NULL DEFAULT 'contributor',
    ADD COLUMN "bio" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users"
    DROP COLUMN "display_name",
    DROP COLUMN "role",
    DROP COLUMN "bio";
  DROP TYPE "public"."enum_users_role";`)
}
