import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Initial schema migration — consolidates the V1 collection setup into a single
 * self-contained step. Generated from a schema-only pg_dump of the local dev
 * database.
 *
 * Replaces three earlier ALTER-TABLE-based migrations (users_extended,
 * add_articles, add_submissions) that assumed the base tables already existed
 * and therefore could not run against an empty database (CI).
 *
 * On databases bootstrapped via Payload dev-mode auto-sync, this migration is
 * pre-marked applied in payload_migrations (no-op on existing schema).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`

    CREATE TYPE public.enum__articles_v_version_intent AS ENUM (
        'bedside',
        'background',
        'learning'
    );

    CREATE TYPE public.enum__articles_v_version_status AS ENUM (
        'draft',
        'published'
    );

    CREATE TYPE public.enum_articles_intent AS ENUM (
        'bedside',
        'background',
        'learning'
    );

    CREATE TYPE public.enum_articles_status AS ENUM (
        'draft',
        'published'
    );

    CREATE TYPE public.enum_submissions_review_status AS ENUM (
        'pending',
        'in_review',
        'accepted',
        'rejected'
    );

    CREATE TYPE public.enum_submissions_type AS ENUM (
        'new_article',
        'correction'
    );

    CREATE TYPE public.enum_users_role AS ENUM (
        'editor',
        'reviewer',
        'contributor'
    );

    CREATE TABLE public._articles_v (
        id integer NOT NULL,
        parent_id integer,
        version_title character varying,
        version_slug character varying,
        version_intent public.enum__articles_v_version_intent,
        version_summary character varying,
        version_definition jsonb,
        version_praxis jsonb,
        version_risiken jsonb,
        version_quellen jsonb,
        version_last_reviewed_at timestamp(3) with time zone,
        version_standards_bound boolean DEFAULT false,
        version_status public.enum__articles_v_version_status DEFAULT 'draft'::public.enum__articles_v_version_status,
        version_updated_at timestamp(3) with time zone,
        version_created_at timestamp(3) with time zone,
        version__status public.enum__articles_v_version_status DEFAULT 'draft'::public.enum__articles_v_version_status,
        created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        latest boolean
    );

    CREATE SEQUENCE public._articles_v_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public._articles_v_id_seq OWNED BY public._articles_v.id;

    CREATE TABLE public._articles_v_rels (
        id integer NOT NULL,
        "order" integer,
        parent_id integer NOT NULL,
        path character varying NOT NULL,
        users_id integer
    );

    CREATE SEQUENCE public._articles_v_rels_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public._articles_v_rels_id_seq OWNED BY public._articles_v_rels.id;

    CREATE TABLE public.articles (
        id integer NOT NULL,
        title character varying,
        slug character varying,
        intent public.enum_articles_intent,
        summary character varying,
        definition jsonb,
        praxis jsonb,
        risiken jsonb,
        quellen jsonb,
        last_reviewed_at timestamp(3) with time zone,
        standards_bound boolean DEFAULT false,
        status public.enum_articles_status DEFAULT 'draft'::public.enum_articles_status,
        updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        _status public.enum_articles_status DEFAULT 'draft'::public.enum_articles_status
    );

    CREATE SEQUENCE public.articles_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.articles_id_seq OWNED BY public.articles.id;

    CREATE TABLE public.articles_rels (
        id integer NOT NULL,
        "order" integer,
        parent_id integer NOT NULL,
        path character varying NOT NULL,
        users_id integer
    );

    CREATE SEQUENCE public.articles_rels_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.articles_rels_id_seq OWNED BY public.articles_rels.id;

    CREATE TABLE public.media (
        id integer NOT NULL,
        alt character varying NOT NULL,
        updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        url character varying,
        thumbnail_u_r_l character varying,
        filename character varying,
        mime_type character varying,
        filesize numeric,
        width numeric,
        height numeric,
        focal_x numeric,
        focal_y numeric
    );

    CREATE SEQUENCE public.media_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.media_id_seq OWNED BY public.media.id;

    CREATE TABLE public.payload_kv (
        id integer NOT NULL,
        key character varying NOT NULL,
        data jsonb NOT NULL
    );

    CREATE SEQUENCE public.payload_kv_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.payload_kv_id_seq OWNED BY public.payload_kv.id;

    CREATE TABLE public.payload_locked_documents (
        id integer NOT NULL,
        global_slug character varying,
        updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        created_at timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE SEQUENCE public.payload_locked_documents_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.payload_locked_documents_id_seq OWNED BY public.payload_locked_documents.id;

    CREATE TABLE public.payload_locked_documents_rels (
        id integer NOT NULL,
        "order" integer,
        parent_id integer NOT NULL,
        path character varying NOT NULL,
        users_id integer,
        media_id integer,
        articles_id integer,
        submissions_id integer
    );

    CREATE SEQUENCE public.payload_locked_documents_rels_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.payload_locked_documents_rels_id_seq OWNED BY public.payload_locked_documents_rels.id;

    CREATE TABLE public.payload_migrations (
        id integer NOT NULL,
        name character varying,
        batch numeric,
        updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        created_at timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE SEQUENCE public.payload_migrations_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.payload_migrations_id_seq OWNED BY public.payload_migrations.id;

    CREATE TABLE public.payload_preferences (
        id integer NOT NULL,
        key character varying,
        value jsonb,
        updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        created_at timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE SEQUENCE public.payload_preferences_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.payload_preferences_id_seq OWNED BY public.payload_preferences.id;

    CREATE TABLE public.payload_preferences_rels (
        id integer NOT NULL,
        "order" integer,
        parent_id integer NOT NULL,
        path character varying NOT NULL,
        users_id integer
    );

    CREATE SEQUENCE public.payload_preferences_rels_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.payload_preferences_rels_id_seq OWNED BY public.payload_preferences_rels.id;

    CREATE TABLE public.submissions (
        id integer NOT NULL,
        type public.enum_submissions_type NOT NULL,
        subject character varying NOT NULL,
        related_article_id integer,
        body character varying NOT NULL,
        submitter_name character varying,
        submitter_email character varying,
        review_status public.enum_submissions_review_status DEFAULT 'pending'::public.enum_submissions_review_status,
        reviewer_notes character varying,
        updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        created_at timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE SEQUENCE public.submissions_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.submissions_id_seq OWNED BY public.submissions.id;

    CREATE TABLE public.users (
        id integer NOT NULL,
        updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
        email character varying NOT NULL,
        reset_password_token character varying,
        reset_password_expiration timestamp(3) with time zone,
        salt character varying,
        hash character varying,
        login_attempts numeric DEFAULT 0,
        lock_until timestamp(3) with time zone,
        display_name character varying NOT NULL,
        role public.enum_users_role DEFAULT 'contributor'::public.enum_users_role NOT NULL,
        bio character varying
    );

    CREATE SEQUENCE public.users_id_seq
        AS integer
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1;

    ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

    CREATE TABLE public.users_sessions (
        _order integer NOT NULL,
        _parent_id integer NOT NULL,
        id character varying NOT NULL,
        created_at timestamp(3) with time zone,
        expires_at timestamp(3) with time zone NOT NULL
    );

    ALTER TABLE ONLY public._articles_v ALTER COLUMN id SET DEFAULT nextval('public._articles_v_id_seq'::regclass);

    ALTER TABLE ONLY public._articles_v_rels ALTER COLUMN id SET DEFAULT nextval('public._articles_v_rels_id_seq'::regclass);

    ALTER TABLE ONLY public.articles ALTER COLUMN id SET DEFAULT nextval('public.articles_id_seq'::regclass);

    ALTER TABLE ONLY public.articles_rels ALTER COLUMN id SET DEFAULT nextval('public.articles_rels_id_seq'::regclass);

    ALTER TABLE ONLY public.media ALTER COLUMN id SET DEFAULT nextval('public.media_id_seq'::regclass);

    ALTER TABLE ONLY public.payload_kv ALTER COLUMN id SET DEFAULT nextval('public.payload_kv_id_seq'::regclass);

    ALTER TABLE ONLY public.payload_locked_documents ALTER COLUMN id SET DEFAULT nextval('public.payload_locked_documents_id_seq'::regclass);

    ALTER TABLE ONLY public.payload_locked_documents_rels ALTER COLUMN id SET DEFAULT nextval('public.payload_locked_documents_rels_id_seq'::regclass);

    ALTER TABLE ONLY public.payload_migrations ALTER COLUMN id SET DEFAULT nextval('public.payload_migrations_id_seq'::regclass);

    ALTER TABLE ONLY public.payload_preferences ALTER COLUMN id SET DEFAULT nextval('public.payload_preferences_id_seq'::regclass);

    ALTER TABLE ONLY public.payload_preferences_rels ALTER COLUMN id SET DEFAULT nextval('public.payload_preferences_rels_id_seq'::regclass);

    ALTER TABLE ONLY public.submissions ALTER COLUMN id SET DEFAULT nextval('public.submissions_id_seq'::regclass);

    ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

    ALTER TABLE ONLY public._articles_v
        ADD CONSTRAINT _articles_v_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public._articles_v_rels
        ADD CONSTRAINT _articles_v_rels_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public.articles
        ADD CONSTRAINT articles_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public.articles_rels
        ADD CONSTRAINT articles_rels_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public.media
        ADD CONSTRAINT media_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public.payload_kv
        ADD CONSTRAINT payload_kv_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public.payload_locked_documents
        ADD CONSTRAINT payload_locked_documents_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public.payload_locked_documents_rels
        ADD CONSTRAINT payload_locked_documents_rels_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public.payload_migrations
        ADD CONSTRAINT payload_migrations_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public.payload_preferences
        ADD CONSTRAINT payload_preferences_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public.payload_preferences_rels
        ADD CONSTRAINT payload_preferences_rels_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public.submissions
        ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public.users
        ADD CONSTRAINT users_pkey PRIMARY KEY (id);

    ALTER TABLE ONLY public.users_sessions
        ADD CONSTRAINT users_sessions_pkey PRIMARY KEY (id);

    CREATE INDEX _articles_v_created_at_idx ON public._articles_v USING btree (created_at);

    CREATE INDEX _articles_v_latest_idx ON public._articles_v USING btree (latest);

    CREATE INDEX _articles_v_parent_idx ON public._articles_v USING btree (parent_id);

    CREATE INDEX _articles_v_rels_order_idx ON public._articles_v_rels USING btree ("order");

    CREATE INDEX _articles_v_rels_parent_idx ON public._articles_v_rels USING btree (parent_id);

    CREATE INDEX _articles_v_rels_path_idx ON public._articles_v_rels USING btree (path);

    CREATE INDEX _articles_v_rels_users_id_idx ON public._articles_v_rels USING btree (users_id);

    CREATE INDEX _articles_v_updated_at_idx ON public._articles_v USING btree (updated_at);

    CREATE INDEX _articles_v_version_version__status_idx ON public._articles_v USING btree (version__status);

    CREATE INDEX _articles_v_version_version_created_at_idx ON public._articles_v USING btree (version_created_at);

    CREATE INDEX _articles_v_version_version_slug_idx ON public._articles_v USING btree (version_slug);

    CREATE INDEX _articles_v_version_version_updated_at_idx ON public._articles_v USING btree (version_updated_at);

    CREATE INDEX articles__status_idx ON public.articles USING btree (_status);

    CREATE INDEX articles_created_at_idx ON public.articles USING btree (created_at);

    CREATE INDEX articles_rels_order_idx ON public.articles_rels USING btree ("order");

    CREATE INDEX articles_rels_parent_idx ON public.articles_rels USING btree (parent_id);

    CREATE INDEX articles_rels_path_idx ON public.articles_rels USING btree (path);

    CREATE INDEX articles_rels_users_id_idx ON public.articles_rels USING btree (users_id);

    CREATE UNIQUE INDEX articles_slug_idx ON public.articles USING btree (slug);

    CREATE INDEX articles_updated_at_idx ON public.articles USING btree (updated_at);

    CREATE INDEX media_created_at_idx ON public.media USING btree (created_at);

    CREATE UNIQUE INDEX media_filename_idx ON public.media USING btree (filename);

    CREATE INDEX media_updated_at_idx ON public.media USING btree (updated_at);

    CREATE UNIQUE INDEX payload_kv_key_idx ON public.payload_kv USING btree (key);

    CREATE INDEX payload_locked_documents_created_at_idx ON public.payload_locked_documents USING btree (created_at);

    CREATE INDEX payload_locked_documents_global_slug_idx ON public.payload_locked_documents USING btree (global_slug);

    CREATE INDEX payload_locked_documents_rels_articles_id_idx ON public.payload_locked_documents_rels USING btree (articles_id);

    CREATE INDEX payload_locked_documents_rels_media_id_idx ON public.payload_locked_documents_rels USING btree (media_id);

    CREATE INDEX payload_locked_documents_rels_order_idx ON public.payload_locked_documents_rels USING btree ("order");

    CREATE INDEX payload_locked_documents_rels_parent_idx ON public.payload_locked_documents_rels USING btree (parent_id);

    CREATE INDEX payload_locked_documents_rels_path_idx ON public.payload_locked_documents_rels USING btree (path);

    CREATE INDEX payload_locked_documents_rels_submissions_id_idx ON public.payload_locked_documents_rels USING btree (submissions_id);

    CREATE INDEX payload_locked_documents_rels_users_id_idx ON public.payload_locked_documents_rels USING btree (users_id);

    CREATE INDEX payload_locked_documents_updated_at_idx ON public.payload_locked_documents USING btree (updated_at);

    CREATE INDEX payload_migrations_created_at_idx ON public.payload_migrations USING btree (created_at);

    CREATE INDEX payload_migrations_updated_at_idx ON public.payload_migrations USING btree (updated_at);

    CREATE INDEX payload_preferences_created_at_idx ON public.payload_preferences USING btree (created_at);

    CREATE INDEX payload_preferences_key_idx ON public.payload_preferences USING btree (key);

    CREATE INDEX payload_preferences_rels_order_idx ON public.payload_preferences_rels USING btree ("order");

    CREATE INDEX payload_preferences_rels_parent_idx ON public.payload_preferences_rels USING btree (parent_id);

    CREATE INDEX payload_preferences_rels_path_idx ON public.payload_preferences_rels USING btree (path);

    CREATE INDEX payload_preferences_rels_users_id_idx ON public.payload_preferences_rels USING btree (users_id);

    CREATE INDEX payload_preferences_updated_at_idx ON public.payload_preferences USING btree (updated_at);

    CREATE INDEX submissions_created_at_idx ON public.submissions USING btree (created_at);

    CREATE INDEX submissions_related_article_idx ON public.submissions USING btree (related_article_id);

    CREATE INDEX submissions_updated_at_idx ON public.submissions USING btree (updated_at);

    CREATE INDEX users_created_at_idx ON public.users USING btree (created_at);

    CREATE UNIQUE INDEX users_email_idx ON public.users USING btree (email);

    CREATE INDEX users_sessions_order_idx ON public.users_sessions USING btree (_order);

    CREATE INDEX users_sessions_parent_id_idx ON public.users_sessions USING btree (_parent_id);

    CREATE INDEX users_updated_at_idx ON public.users USING btree (updated_at);

    ALTER TABLE ONLY public._articles_v
        ADD CONSTRAINT _articles_v_parent_id_articles_id_fk FOREIGN KEY (parent_id) REFERENCES public.articles(id) ON DELETE SET NULL;

    ALTER TABLE ONLY public._articles_v_rels
        ADD CONSTRAINT _articles_v_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public._articles_v(id) ON DELETE CASCADE;

    ALTER TABLE ONLY public._articles_v_rels
        ADD CONSTRAINT _articles_v_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;

    ALTER TABLE ONLY public.articles_rels
        ADD CONSTRAINT articles_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.articles(id) ON DELETE CASCADE;

    ALTER TABLE ONLY public.articles_rels
        ADD CONSTRAINT articles_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;

    ALTER TABLE ONLY public.payload_locked_documents_rels
        ADD CONSTRAINT payload_locked_documents_rels_articles_fk FOREIGN KEY (articles_id) REFERENCES public.articles(id) ON DELETE CASCADE;

    ALTER TABLE ONLY public.payload_locked_documents_rels
        ADD CONSTRAINT payload_locked_documents_rels_media_fk FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE CASCADE;

    ALTER TABLE ONLY public.payload_locked_documents_rels
        ADD CONSTRAINT payload_locked_documents_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.payload_locked_documents(id) ON DELETE CASCADE;

    ALTER TABLE ONLY public.payload_locked_documents_rels
        ADD CONSTRAINT payload_locked_documents_rels_submissions_fk FOREIGN KEY (submissions_id) REFERENCES public.submissions(id) ON DELETE CASCADE;

    ALTER TABLE ONLY public.payload_locked_documents_rels
        ADD CONSTRAINT payload_locked_documents_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;

    ALTER TABLE ONLY public.payload_preferences_rels
        ADD CONSTRAINT payload_preferences_rels_parent_fk FOREIGN KEY (parent_id) REFERENCES public.payload_preferences(id) ON DELETE CASCADE;

    ALTER TABLE ONLY public.payload_preferences_rels
        ADD CONSTRAINT payload_preferences_rels_users_fk FOREIGN KEY (users_id) REFERENCES public.users(id) ON DELETE CASCADE;

    ALTER TABLE ONLY public.submissions
        ADD CONSTRAINT submissions_related_article_id_articles_id_fk FOREIGN KEY (related_article_id) REFERENCES public.articles(id) ON DELETE SET NULL;

    ALTER TABLE ONLY public.users_sessions
        ADD CONSTRAINT users_sessions_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.users(id) ON DELETE CASCADE;


  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Initial migration: down() is intentionally a no-op. To roll back, drop the
  // public schema and re-run from scratch.
}
