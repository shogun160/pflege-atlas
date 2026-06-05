import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_submissions_type" AS ENUM('new_article', 'correction');
  CREATE TYPE "public"."enum_submissions_review_status" AS ENUM('pending', 'in_review', 'accepted', 'rejected');
  CREATE TABLE "submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_submissions_type" NOT NULL,
  	"subject" varchar NOT NULL,
  	"related_article_id" integer,
  	"body" varchar NOT NULL,
  	"submitter_name" varchar,
  	"submitter_email" varchar,
  	"review_status" "enum_submissions_review_status" DEFAULT 'pending',
  	"reviewer_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "submissions_id" integer;
  ALTER TABLE "submissions" ADD CONSTRAINT "submissions_related_article_id_articles_id_fk" FOREIGN KEY ("related_article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "submissions_related_article_idx" ON "submissions" USING btree ("related_article_id");
  CREATE INDEX "submissions_updated_at_idx" ON "submissions" USING btree ("updated_at");
  CREATE INDEX "submissions_created_at_idx" ON "submissions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_submissions_fk" FOREIGN KEY ("submissions_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("submissions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "submissions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "submissions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_submissions_fk";
  
  DROP INDEX "payload_locked_documents_rels_submissions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "submissions_id";
  DROP TYPE "public"."enum_submissions_type";
  DROP TYPE "public"."enum_submissions_review_status";`)
}
