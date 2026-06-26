import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Sub-C3 T2 — AuditLogs collection.
 *
 * Sicherheits- und Kontoverwaltungs-Protokoll (Read-only, 90-Tage-Retention via Cron T7).
 *
 * Schema-Entscheidungen:
 *   - Integer-PK (Payload-Default mit @payloadcms/db-postgres), KEINE UUIDs
 *     — projektweit konsistent (siehe `20260605_140707_init.ts`).
 *   - actor_user_id / subject_user_id sind nullable INT mit FK auf users.id
 *     und ON DELETE SET NULL. Wir wollen Audit-Records auch nach User-Löschung
 *     erhalten (subject_email + actor_email bleiben als Fallback-Identität).
 *   - 4 explizite Indizes für die Query-Patterns aus dem Spec:
 *       * created_at        → Cron-Cleanup (DELETE WHERE created_at < now()-90d)
 *       * event_type        → Filter im Admin-List-View
 *       * actor_user_id     → "Was hat User X getan"
 *       * subject_user_id   → "Was wurde User Y angetan"
 *   - FK-Naming folgt V1.7.1-Pattern: <table>_<col>_<refTable>_<refCol>_fk
 *     (siehe `20260623_100000_fk_naming_consistency.ts`). Drizzle erwartet
 *     genau diese Form, sonst Schema-Drift im Vercel-Build.
 *
 * Manuell geschrieben (statt `payload migrate:create`-Generierung) weil:
 *   1. Payloads Generator promptet interaktiv bei mehrdeutigen Enum-Diffs
 *      und ist im Headless-Run nicht steuerbar.
 *   2. Der Generator hätte ohnehin nachgebessert werden müssen (FK-Naming
 *      via inline `REFERENCES` ohne `CONSTRAINT name` — siehe V1.7.1-Notes).
 *   3. Hand-geschrieben ist es kürzer, lesbarer und folgt 1:1 dem Init-
 *      Migration-Stil.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`

    CREATE TABLE public.audit_logs (
        id integer NOT NULL,
        event_type character varying NOT NULL,
        actor_user_id integer,
        actor_email character varying,
        subject_user_id integer,
        subject_email character varying,
        metadata jsonb,
        ip_hash character varying(64),
        user_agent character varying(200),
        updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        created_at timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE SEQUENCE public.audit_logs_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;

    ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);

    ALTER TABLE ONLY public.audit_logs
        ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

    CREATE INDEX audit_logs_created_at_idx       ON public.audit_logs USING btree (created_at);
    CREATE INDEX audit_logs_updated_at_idx       ON public.audit_logs USING btree (updated_at);
    CREATE INDEX audit_logs_event_type_idx       ON public.audit_logs USING btree (event_type);
    CREATE INDEX audit_logs_actor_user_id_idx    ON public.audit_logs USING btree (actor_user_id);
    CREATE INDEX audit_logs_subject_user_id_idx  ON public.audit_logs USING btree (subject_user_id);

    ALTER TABLE ONLY public.audit_logs
        ADD CONSTRAINT audit_logs_actor_user_id_users_id_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

    ALTER TABLE ONLY public.audit_logs
        ADD CONSTRAINT audit_logs_subject_user_id_users_id_fk
        FOREIGN KEY (subject_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

    -- Payload-Lock-Mechanik: payload_locked_documents_rels.audit_logs_id
    -- Ohne diese Spalte würden Admin-Edit-Locks (die Payload für alle Collections
    -- führt) fehlschlagen. Wir folgen dem Pattern aus 20260605_140707_init.ts.
    ALTER TABLE public.payload_locked_documents_rels
        ADD COLUMN IF NOT EXISTS audit_logs_id integer;

    CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_audit_logs_id_idx
        ON public.payload_locked_documents_rels USING btree (audit_logs_id);

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'payload_locked_documents_rels_audit_logs_fk'
          AND conrelid = 'public.payload_locked_documents_rels'::regclass
      ) THEN
        ALTER TABLE public.payload_locked_documents_rels
          ADD CONSTRAINT payload_locked_documents_rels_audit_logs_fk
          FOREIGN KEY (audit_logs_id) REFERENCES public.audit_logs(id) ON DELETE CASCADE;
      END IF;
    END $$;

  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`

    ALTER TABLE public.payload_locked_documents_rels
        DROP CONSTRAINT IF EXISTS payload_locked_documents_rels_audit_logs_fk;

    DROP INDEX IF EXISTS public.payload_locked_documents_rels_audit_logs_id_idx;

    ALTER TABLE public.payload_locked_documents_rels
        DROP COLUMN IF EXISTS audit_logs_id;

    DROP TABLE IF EXISTS public.audit_logs CASCADE;

  `)
}
