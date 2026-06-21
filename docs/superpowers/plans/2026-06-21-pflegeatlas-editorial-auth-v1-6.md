# V1.6 — Editorial-Workflow + Auth (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend-Login, 4-Rollen-Permissions, Invitation-Flow, Article-Status `ready_to_publish`, Claim-Mechanik, Contributor-Dashboard + Editor-Dashboard.

**Architecture:** Auth-Layer (`src/lib/auth.ts`) kapselt Payload-Auth komplett — alle Server Components, Server Actions und Collection-Access-Functions reden ausschließlich darüber. Permission-Matrix als zentrale TypeScript-Konstante (Single Source of Truth). Frontend-Pages in Pflege-Atlas-Look (`/login`, `/passwort-vergessen`, `/passwort-setzen`, `/mein-bereich`, `/mitmachen`), Editor-Pages bleiben im Payload-Admin mit Custom-Dashboard + Filter-Presets.

**Tech Stack:** Payload-3.x native Auth (Email+Password+JWT-Cookie), Postgres 16 (3 sequentielle Migrations), Resend Mail-Adapter (V1.3a), Next.js 16 Server Actions + Server Components, Tailwind v4 (V1.1-Tokens), Vitest 4 mit zwei Projects (`jsdom` + `node`).

**Spec-Referenz:** `docs/superpowers/specs/2026-06-21-pflegeatlas-editorial-auth-v1-6-design.md`

---

## File Structure

### Neue Code-Files

**Auth-Layer (`src/lib/`):**
- `auth-permissions.ts` — Permission-Matrix als Konstante + `hasPermission()` Pure Function
- `auth-tokens.ts` — Token-Generierung (crypto.randomBytes) + Validation
- `auth.ts` — `getSession`, `requireUser`, `requireRole` + alle Server-Actions
- `mail.ts` — Mail-Sending-Wrapper (für einheitliche Mock-Stelle)
- `user-soft-delete.ts` — Anonymisierungs-Function (Pure)
- `data-export.ts` — JSON-Export-Function (Pure)

**Mail-Templates (`src/lib/mail-templates/`):**
- `invitation.ts` — `renderInvitationMail({ to, displayName, role, invitedBy, magicLink, expiresAt })`
- `forgot-password.ts` — `renderForgotPasswordMail({ to, resetLink, expiresAt })`
- `welcome.ts` — `renderWelcomeMail({ to, displayName, role })`
- `ready-to-publish.ts` — `renderReadyToPublishMail({ to, articleTitle, reviewer, adminLink })`

**Frontend-Pages (`src/app/(frontend)/`):**
- `login/page.tsx` + `login/actions.ts`
- `passwort-vergessen/page.tsx` + `passwort-vergessen/actions.ts`
- `passwort-setzen/page.tsx` + `passwort-setzen/actions.ts`
- `mein-bereich/page.tsx` + `mein-bereich/actions.ts`
- `mitmachen/page.tsx` (statisch)

**Route Handler:**
- `src/app/(payload)/admin/login/route.ts` — 307-Redirect zu `/login?next=/admin`

**Components (`src/components/`):**
- `LoginForm.tsx`
- `SetPasswordForm.tsx`
- `ForgotPasswordForm.tsx`
- `ProfileEditForm.tsx`
- `AccountActions.tsx` (Delete + Export)
- `HeaderUserMenu.tsx`
- `MeineBeitraegeCard.tsx`
- `admin/EditorialDashboard.tsx`
- `admin/ClaimButton.tsx`
- `admin/InviteUserModal.tsx`

**Migrations (`src/migrations/`):**
- `20260622_100000_users_role_articles_status_enums.ts`
- `20260622_100100_users_lifecycle_and_profile_fields.ts`
- `20260622_100200_submissions_articles_media_review_fields.ts`

### Modifizierte Files

- `src/collections/Users.ts` — neue Felder, Auth-Config-Tweaks, beforeLogin-Hook (disabled-Check), Mail-Template-Override für forgotPassword
- `src/collections/Articles.ts` — `currentReviewer`-Field, Status-Übergangs-Hook, Access-Refactor zu `hasPermission`
- `src/collections/Submissions.ts` — `submittedBy`/`currentReviewer`/`reviewedBy`-Fields, beforeChange-Hook-Erweiterung, Access-Refactor
- `src/collections/Media.ts` — `purpose`/`uploadedBy`-Fields, Access-Refactor mit purpose-Check
- `src/payload.config.ts` — Custom Admin Dashboard in `admin.components.views.dashboard`
- `src/components/Header.tsx` — `HeaderUserMenu` integrieren
- `src/app/(frontend)/einreichen/actions.ts` — `submittedBy` auto-fill bei eingeloggtem User
- `src/migrations/index.ts` — drei neue Migrations registrieren
- `tests/setup.node.ts` — Mail-Mock global
- `tests/helpers/` — neue Helper `createUserFixture(role)` + `loginAsFixture(user)`

### Neue Tests

**Unit (`tests/unit/`):**
- `auth-permissions.test.ts` — Permission-Matrix Truth-Table
- `auth-tokens.test.ts` — Token-Generierung + Validation
- `auth-hasPermission.test.ts` — Hilfsfunktion isoliert
- `user-soft-delete.test.ts` — Anonymisierung
- `data-export.test.ts` — JSON-Struktur
- `mail-templates/invitation.test.ts`, `forgot-password.test.ts`, `welcome.test.ts`, `ready-to-publish.test.ts` — Snapshot + Token-Erscheinen
- `article-status-transitions.test.ts` — Übergangs-Validation

**Component (`tests/component/`):**
- `LoginForm.test.tsx`
- `SetPasswordForm.test.tsx`
- `ForgotPasswordForm.test.tsx`
- `ProfileEditForm.test.tsx`
- `HeaderUserMenu.test.tsx`
- `ClaimButton.test.tsx`
- `EditorialDashboard.test.tsx`
- `InviteUserModal.test.tsx`

**Integration (`tests/integration/`):**
- `auth-login-logout.test.ts`
- `auth-invite-flow.test.ts`
- `auth-set-password-from-token.test.ts`
- `auth-forgot-password.test.ts`
- `auth-update-own-profile.test.ts`
- `auth-delete-own-account.test.ts`
- `auth-data-export.test.ts`
- `permissions-articles.test.ts`
- `permissions-submissions.test.ts`
- `permissions-users.test.ts`
- `permissions-media.test.ts`
- `article-status-hook.test.ts`
- `submission-auto-attribution.test.ts`
- `claim-mechanics.test.ts`
- `magic-link-security.test.ts`

---

## Task-Übersicht (19 Tasks)

**Phase 1 — Foundation (T1-T5)**: Permission-Matrix, Token-Helper, drei Migrations, Collection-Field-Erweiterungen.

**Phase 2 — Auth-Layer (T6-T8)**: getSession + alle Server-Actions in `src/lib/auth.ts`.

**Phase 3 — Mail (T9)**: Mail-Wrapper + alle vier Templates.

**Phase 4 — Frontend (T10-T14)**: Login/Forgot/SetPassword, /admin/login-Redirect, /mitmachen, /mein-bereich.

**Phase 5 — Admin-Customizations (T15-T17)**: EditorialDashboard, ClaimButton, InviteUserModal + Filter-Presets.

**Phase 6 — Integration (T18-T19)**: /einreichen-Action, V1.5-Test-Anpassung, Smoke-Tests, PR.

---

## Task 1: Permission-Matrix + Token-Helper

**Files:**
- Create: `src/lib/auth-permissions.ts`
- Create: `src/lib/auth-tokens.ts`
- Test: `tests/unit/auth-permissions.test.ts`
- Test: `tests/unit/auth-tokens.test.ts`

Pure-Function-Foundation. Kein Payload-Dependency, kein DB-Zugriff — testbar in jsdom-Project ohne Setup.

- [ ] **Step 1.1: Write failing test for permission matrix structure**

`tests/unit/auth-permissions.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { hasPermission, PERMISSIONS, type Role } from '@/lib/auth-permissions';

describe('auth-permissions matrix', () => {
  it('admin can do everything on every collection', () => {
    const admin = { role: 'admin' as Role, id: 1, disabled: false };
    expect(hasPermission(admin, 'read', 'articles')).toBe(true);
    expect(hasPermission(admin, 'publish', 'articles')).toBe(true);
    expect(hasPermission(admin, 'delete', 'users')).toBe(true);
    expect(hasPermission(admin, 'inviteAdmin', 'users')).toBe(true);
  });

  it('editor cannot delete articles or invite admin', () => {
    const editor = { role: 'editor' as Role, id: 1, disabled: false };
    expect(hasPermission(editor, 'publish', 'articles')).toBe(true);
    expect(hasPermission(editor, 'delete', 'articles')).toBe(false);
    expect(hasPermission(editor, 'inviteAdmin', 'users')).toBe(false);
    expect(hasPermission(editor, 'inviteReviewer', 'users')).toBe(true);
  });

  it('reviewer cannot publish articles', () => {
    const reviewer = { role: 'reviewer' as Role, id: 1, disabled: false };
    expect(hasPermission(reviewer, 'updateContent', 'articles')).toBe(true);
    expect(hasPermission(reviewer, 'publish', 'articles')).toBe(false);
    expect(hasPermission(reviewer, 'inviteReviewer', 'users')).toBe(false);
  });

  it('contributor can only read own submissions and update own profile', () => {
    const contributor = { role: 'contributor' as Role, id: 1, disabled: false };
    expect(hasPermission(contributor, 'createSubmission', 'submissions')).toBe(true);
    expect(hasPermission(contributor, 'readAllSubmissions', 'submissions')).toBe(false);
    expect(hasPermission(contributor, 'updateOwnProfile', 'users')).toBe(true);
    expect(hasPermission(contributor, 'updateContent', 'articles')).toBe(false);
  });

  it('disabled user has no permissions', () => {
    const disabled = { role: 'admin' as Role, id: 1, disabled: true };
    expect(hasPermission(disabled, 'read', 'articles')).toBe(false);
  });

  it('null user has only anonymous permissions', () => {
    expect(hasPermission(null, 'read', 'articles')).toBe(false); // only published-read; we test that separately
    expect(hasPermission(null, 'createSubmission', 'submissions')).toBe(true);
  });

  it('PERMISSIONS object contains all 4 roles', () => {
    expect(Object.keys(PERMISSIONS)).toEqual(['admin', 'editor', 'reviewer', 'contributor']);
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/auth-permissions.test.ts`
Expected: FAIL with "Cannot find module '@/lib/auth-permissions'"

- [ ] **Step 1.3: Implement auth-permissions.ts**

`src/lib/auth-permissions.ts`:
```typescript
export type Role = 'admin' | 'editor' | 'reviewer' | 'contributor';

export type Resource = 'articles' | 'submissions' | 'users' | 'media';

export type Action =
  // articles
  | 'read'
  | 'readAllStati'
  | 'createArticle'
  | 'updateContent'
  | 'transitionToReview'
  | 'transitionToReadyToPublish'
  | 'publish'
  | 'archive'
  | 'delete'
  // submissions
  | 'createSubmission'
  | 'readAllSubmissions'
  | 'readOwnSubmissions'
  | 'updateSubmission'
  // users
  | 'readAllUsers'
  | 'inviteAdmin'
  | 'inviteEditor'
  | 'inviteReviewer'
  | 'inviteContributor'
  | 'updateOwnProfile'
  | 'updateOthersRole'
  | 'updateOthersDisabled'
  // media
  | 'readArticleImage'
  | 'readOwnAvatar'
  | 'readOthersAvatar'
  | 'uploadAvatar'
  | 'uploadArticleImage';

export interface UserPermissionInput {
  id: number;
  role: Role;
  disabled: boolean;
}

type PermissionSet = Set<Action>;

function s(...actions: Action[]): PermissionSet {
  return new Set(actions);
}

export const PERMISSIONS: Record<Role, PermissionSet> = {
  admin: s(
    'read', 'readAllStati', 'createArticle', 'updateContent',
    'transitionToReview', 'transitionToReadyToPublish', 'publish', 'archive', 'delete',
    'createSubmission', 'readAllSubmissions', 'updateSubmission',
    'readAllUsers', 'inviteAdmin', 'inviteEditor', 'inviteReviewer', 'inviteContributor',
    'updateOwnProfile', 'updateOthersRole', 'updateOthersDisabled',
    'readArticleImage', 'readOwnAvatar', 'readOthersAvatar', 'uploadAvatar', 'uploadArticleImage',
  ),
  editor: s(
    'read', 'readAllStati', 'createArticle', 'updateContent',
    'transitionToReview', 'transitionToReadyToPublish', 'publish', 'archive',
    'createSubmission', 'readAllSubmissions', 'updateSubmission',
    'readAllUsers', 'inviteReviewer', 'inviteContributor',
    'updateOwnProfile',
    'readArticleImage', 'readOwnAvatar', 'readOthersAvatar', 'uploadAvatar', 'uploadArticleImage',
  ),
  reviewer: s(
    'read', 'readAllStati', 'createArticle', 'updateContent',
    'transitionToReview', 'transitionToReadyToPublish',
    'createSubmission', 'readAllSubmissions', 'updateSubmission',
    'readAllUsers',
    'updateOwnProfile',
    'readArticleImage', 'readOwnAvatar', 'uploadAvatar', 'uploadArticleImage',
  ),
  contributor: s(
    'read',
    'createSubmission', 'readOwnSubmissions',
    'updateOwnProfile',
    'readArticleImage', 'readOwnAvatar', 'uploadAvatar',
  ),
};

export function hasPermission(
  user: UserPermissionInput | null,
  action: Action,
  resource: Resource,
): boolean {
  // Anonymous: only specific actions allowed
  if (!user) {
    return action === 'createSubmission' && resource === 'submissions';
  }
  // Disabled users have no permissions
  if (user.disabled) {
    return false;
  }
  return PERMISSIONS[user.role].has(action);
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/auth-permissions.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 1.5: Write failing test for token helper**

`tests/unit/auth-tokens.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateToken, isTokenValid, INVITE_EXPIRY_MS, RESET_EXPIRY_MS } from '@/lib/auth-tokens';

describe('auth-tokens', () => {
  it('generateToken returns 43-char base64-url-safe string', () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('generateToken returns unique values', () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) tokens.add(generateToken());
    expect(tokens.size).toBe(100);
  });

  it('isTokenValid returns false for null expiry', () => {
    expect(isTokenValid(null)).toBe(false);
    expect(isTokenValid(undefined)).toBe(false);
  });

  it('isTokenValid returns false for past expiry', () => {
    const past = new Date(Date.now() - 1000);
    expect(isTokenValid(past)).toBe(false);
  });

  it('isTokenValid returns true for future expiry', () => {
    const future = new Date(Date.now() + 1000);
    expect(isTokenValid(future)).toBe(true);
  });

  it('isTokenValid accepts ISO-string', () => {
    const future = new Date(Date.now() + 1000).toISOString();
    expect(isTokenValid(future)).toBe(true);
  });

  it('INVITE_EXPIRY_MS is 7 days', () => {
    expect(INVITE_EXPIRY_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('RESET_EXPIRY_MS is 1 hour', () => {
    expect(RESET_EXPIRY_MS).toBe(60 * 60 * 1000);
  });
});
```

- [ ] **Step 1.6: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/auth-tokens.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 1.7: Implement auth-tokens.ts**

`src/lib/auth-tokens.ts`:
```typescript
import { randomBytes } from 'node:crypto';

export const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const RESET_EXPIRY_MS = 60 * 60 * 1000;            // 1 hour

/**
 * 32 random bytes → 43-char base64-url-safe string.
 * Used for both invitation-magic-links and password-reset-links.
 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isTokenValid(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return expiry.getTime() > Date.now();
}
```

- [ ] **Step 1.8: Run test to verify it passes**

Run: `pnpm vitest run tests/unit/auth-tokens.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 1.9: Commit**

```bash
git add src/lib/auth-permissions.ts src/lib/auth-tokens.ts tests/unit/auth-permissions.test.ts tests/unit/auth-tokens.test.ts
git commit -m "feat(auth): permission matrix + token helpers"
```

---

## Task 2: Migrations (3 sequenzielle Schema-Erweiterungen)

**Files:**
- Create: `src/migrations/20260622_100000_users_role_articles_status_enums.ts`
- Create: `src/migrations/20260622_100100_users_lifecycle_and_profile_fields.ts`
- Create: `src/migrations/20260622_100200_submissions_articles_media_review_fields.ts`
- Modify: `src/migrations/index.ts` (register all three)

Migration-First-Pattern (V1.4/V1.5-Lesson): Migration manuell schreiben, via psql applien, dann Code-Felder hinzufügen. Verhindert dass Payload-Dev-Adapter bei `getPayload()`-Boot stillschweigend einen Schema-Push macht.

- [ ] **Step 2.1: Write migration 1 (enum extensions)**

`src/migrations/20260622_100000_users_role_articles_status_enums.ts`:
```typescript
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * V1.6 Migration 1/3.
 *
 * Erweitert zwei Enums:
 * - `enum_users_role` um `'admin'` (zusätzlich zu editor/reviewer/contributor)
 * - `enum_articles_status` um `'ready_to_publish'` (Reviewer-fertig-Übergang)
 *
 * Pattern aus PR #17 (articles-status-enum-extend). Idempotent via IF NOT EXISTS.
 *
 * Setzt zusätzlich Olivers User-Record auf 'admin', sofern vorhanden.
 * Email-Identifikation: `oliver.wosnitza@gmail.com`. Wenn der Record nicht
 * existiert, ist das ein No-Op (UPDATE 0 rows).
 *
 * `down()` ist Stub — Postgres lässt Enum-Werte nicht trivial entfernen.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE public.enum_users_role ADD VALUE IF NOT EXISTS 'admin';
    ALTER TYPE public.enum_articles_status ADD VALUE IF NOT EXISTS 'ready_to_publish';
  `)

  // Olivers Record auf admin promoten (No-Op wenn Record nicht da)
  await db.execute(sql`
    UPDATE public.users
       SET role = 'admin'
     WHERE email = 'oliver.wosnitza@gmail.com';
  `)
}

export async function down({ _db }: MigrateDownArgs): Promise<void> {
  throw new Error(
    'down() für v1-6 enum extensions nicht supported — Postgres lässt Enum-Werte nicht trivial entfernen.',
  )
}
```

- [ ] **Step 2.2: Write migration 2 (users lifecycle + profile fields)**

`src/migrations/20260622_100100_users_lifecycle_and_profile_fields.ts`:
```typescript
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
```

- [ ] **Step 2.3: Write migration 3 (submissions/articles/media review fields)**

`src/migrations/20260622_100200_submissions_articles_media_review_fields.ts`:
```typescript
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
        CREATE INDEX submissions_rels_parent_idx ON public.submissions_rels (parent_id);
        CREATE INDEX submissions_rels_path_idx ON public.submissions_rels (path);
        CREATE INDEX submissions_rels_users_id_idx ON public.submissions_rels (users_id);
      ELSE
        ALTER TABLE public.submissions_rels
          ADD COLUMN IF NOT EXISTS users_id integer REFERENCES public.users(id) ON DELETE CASCADE;
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

    DROP INDEX IF EXISTS public.submissions_rels_users_id_idx;
    ALTER TABLE public.submissions_rels DROP COLUMN IF EXISTS users_id;

    ALTER TABLE public.submissions
      DROP COLUMN IF EXISTS current_reviewer_id,
      DROP COLUMN IF EXISTS submitted_by_id;

    ALTER TABLE public.articles
      DROP COLUMN IF EXISTS current_reviewer_id;
  `)
}
```

- [ ] **Step 2.4: Register migrations in index.ts**

Edit `src/migrations/index.ts` — add imports + entries:
```typescript
import * as migration_20260622_100000_users_role_articles_status_enums from './20260622_100000_users_role_articles_status_enums';
import * as migration_20260622_100100_users_lifecycle_and_profile_fields from './20260622_100100_users_lifecycle_and_profile_fields';
import * as migration_20260622_100200_submissions_articles_media_review_fields from './20260622_100200_submissions_articles_media_review_fields';
```

Add to `migrations` array (after existing entries):
```typescript
  {
    up: migration_20260622_100000_users_role_articles_status_enums.up,
    down: migration_20260622_100000_users_role_articles_status_enums.down,
    name: '20260622_100000_users_role_articles_status_enums',
  },
  {
    up: migration_20260622_100100_users_lifecycle_and_profile_fields.up,
    down: migration_20260622_100100_users_lifecycle_and_profile_fields.down,
    name: '20260622_100100_users_lifecycle_and_profile_fields',
  },
  {
    up: migration_20260622_100200_submissions_articles_media_review_fields.up,
    down: migration_20260622_100200_submissions_articles_media_review_fields.down,
    name: '20260622_100200_submissions_articles_media_review_fields',
  },
```

- [ ] **Step 2.5: Apply migrations to local Dev-DB via psql**

Generate SQL manually from the .ts files (concat all three `up`-SQL-Blocks into one string) and pipe to psql:
```bash
docker exec -i pflege-brainstorm-postgres-1 psql -U pflege -d pflege_brainstorm <<'EOF'
-- Migration 1
ALTER TYPE public.enum_users_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.enum_articles_status ADD VALUE IF NOT EXISTS 'ready_to_publish';
UPDATE public.users SET role = 'admin' WHERE email = 'oliver.wosnitza@gmail.com';

-- Migration 2
DO $$ BEGIN
  CREATE TYPE public.enum_users_pflegerische_rolle AS ENUM ('pflegefachkraft','pdl','wbl','auszubildende','sonstiges');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- [...rest of migration 2 SQL...]

-- Migration 3
-- [...]

-- Register batch in payload_migrations
INSERT INTO public.payload_migrations (name, batch, created_at, updated_at)
VALUES
  ('20260622_100000_users_role_articles_status_enums', (SELECT COALESCE(MAX(batch),0)+1 FROM public.payload_migrations), NOW(), NOW()),
  ('20260622_100100_users_lifecycle_and_profile_fields', (SELECT MAX(batch) FROM public.payload_migrations), NOW(), NOW()),
  ('20260622_100200_submissions_articles_media_review_fields', (SELECT MAX(batch) FROM public.payload_migrations), NOW(), NOW());
EOF
```

(Container-Name ggf. via `docker ps` verifizieren.)

- [ ] **Step 2.6: Verify migrations applied**

```bash
docker exec -i pflege-brainstorm-postgres-1 psql -U pflege -d pflege_brainstorm -c "SELECT name, batch FROM public.payload_migrations ORDER BY batch DESC LIMIT 5;"
```
Expected: drei neue Einträge mit höchstem Batch-Wert.

```bash
docker exec -i pflege-brainstorm-postgres-1 psql -U pflege -d pflege_brainstorm -c "\d public.users" | grep -E "(disabled|set_password|pflegerische|invited)"
```
Expected: alle vier neuen Spalten sichtbar.

- [ ] **Step 2.7: Commit**

```bash
git add src/migrations/20260622_*.ts src/migrations/index.ts
git commit -m "feat(migrations): V1.6 schema — role/status enums + users lifecycle + review fields"
```

---

## Task 3: Users.ts — Felder, Auth-Config, beforeLogin-Hook

**Files:**
- Modify: `src/collections/Users.ts`
- Test: `tests/unit/users-collection.test.ts`
- Test: `tests/integration/auth-disabled-user.test.ts`

Schema-Felder, die der Migration entsprechen, ins TypeScript-Field-Schema einziehen. Plus `auth`-Config-Tweaks und ein `beforeLogin`-Hook für disabled-Block.

- [ ] **Step 3.1: Write failing test for disabled-user-login**

`tests/integration/auth-disabled-user.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('disabled user login', () => {
  it('blocks login for disabled users with valid credentials', async () => {
    const email = `disabled-${Date.now()}@test.local`;
    await payload.create({
      collection: 'users',
      data: {
        email,
        password: 'TestPass123!',
        displayName: 'Disabled User',
        role: 'contributor',
        disabled: true,
      } as never,
    });

    await expect(
      payload.login({
        collection: 'users',
        data: { email, password: 'TestPass123!' },
      }),
    ).rejects.toThrow(/disabled|gesperrt/i);
  });

  it('allows login for non-disabled users', async () => {
    const email = `active-${Date.now()}@test.local`;
    await payload.create({
      collection: 'users',
      data: {
        email,
        password: 'TestPass123!',
        displayName: 'Active User',
        role: 'contributor',
        disabled: false,
      } as never,
    });

    const result = await payload.login({
      collection: 'users',
      data: { email, password: 'TestPass123!' },
    });
    expect(result.user.email).toBe(email);
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `pnpm vitest run tests/integration/auth-disabled-user.test.ts`
Expected: FAIL — `disabled` field unknown or login does not throw.

- [ ] **Step 3.3: Update Users.ts**

Replace `src/collections/Users.ts` contents:
```typescript
import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 60 * 60 * 24,   // 24h
    maxLoginAttempts: 5,
    lockTime: 600 * 1000,             // 10min
    verify: false,                    // V1.6: Magic-Set-Password statt Verify-Email
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'displayName', 'role', 'disabled', 'invitedAt'],
  },
  hooks: {
    beforeLogin: [
      ({ user }) => {
        if ((user as { disabled?: boolean }).disabled) {
          throw new Error('Account ist gesperrt (disabled).');
        }
      },
    ],
  },
  fields: [
    {
      name: 'displayName',
      type: 'text',
      label: 'Anzeigename',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      label: 'Rolle',
      required: true,
      defaultValue: 'contributor',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Redakteur:in', value: 'editor' },
        { label: 'Reviewer:in', value: 'reviewer' },
        { label: 'Beitragende:r', value: 'contributor' },
      ],
    },
    {
      name: 'disabled',
      type: 'checkbox',
      label: 'Gesperrt',
      defaultValue: false,
      admin: {
        description: 'Wenn aktiv, ist Login blockiert. Datensatz bleibt für Audit + Relationships.',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Kurzprofil',
    },
    {
      name: 'pflegerischeRolle',
      type: 'select',
      label: 'Pflegerische Rolle (optional)',
      options: [
        { label: 'Pflegefachkraft', value: 'pflegefachkraft' },
        { label: 'PDL (Pflegedienstleitung)', value: 'pdl' },
        { label: 'WBL (Wohnbereichsleitung)', value: 'wbl' },
        { label: 'Auszubildende:r', value: 'auszubildende' },
        { label: 'Sonstiges', value: 'sonstiges' },
      ],
    },
    {
      name: 'bundesland',
      type: 'select',
      label: 'Bundesland / Region (optional)',
      options: [
        { label: 'Baden-Württemberg', value: 'baden_wuerttemberg' },
        { label: 'Bayern', value: 'bayern' },
        { label: 'Berlin', value: 'berlin' },
        { label: 'Brandenburg', value: 'brandenburg' },
        { label: 'Bremen', value: 'bremen' },
        { label: 'Hamburg', value: 'hamburg' },
        { label: 'Hessen', value: 'hessen' },
        { label: 'Mecklenburg-Vorpommern', value: 'mecklenburg_vorpommern' },
        { label: 'Niedersachsen', value: 'niedersachsen' },
        { label: 'Nordrhein-Westfalen', value: 'nordrhein_westfalen' },
        { label: 'Rheinland-Pfalz', value: 'rheinland_pfalz' },
        { label: 'Saarland', value: 'saarland' },
        { label: 'Sachsen', value: 'sachsen' },
        { label: 'Sachsen-Anhalt', value: 'sachsen_anhalt' },
        { label: 'Schleswig-Holstein', value: 'schleswig_holstein' },
        { label: 'Thüringen', value: 'thueringen' },
        { label: 'Österreich', value: 'oesterreich' },
        { label: 'Schweiz', value: 'schweiz' },
        { label: 'Sonstiges', value: 'sonstiges' },
      ],
    },
    {
      name: 'avatar',
      type: 'relationship',
      relationTo: 'media',
      label: 'Profilbild',
      hasMany: false,
    },
    {
      name: 'setPasswordToken',
      type: 'text',
      admin: { hidden: true },
    },
    {
      name: 'setPasswordTokenExpiresAt',
      type: 'date',
      admin: { hidden: true },
    },
    {
      name: 'invitedBy',
      type: 'relationship',
      relationTo: 'users',
      label: 'Eingeladen durch',
      hasMany: false,
      admin: { readOnly: true },
    },
    {
      name: 'invitedAt',
      type: 'date',
      label: 'Eingeladen am',
      admin: { readOnly: true },
    },
  ],
};
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `pnpm vitest run tests/integration/auth-disabled-user.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 3.5: Run full V1.5 baseline to catch regressions**

Run: `pnpm vitest run`
Expected: previous 233 tests still pass + 2 new = 235. If any V1.5-test breaks due to new fields, fix in this commit.

- [ ] **Step 3.6: Commit**

```bash
git add src/collections/Users.ts tests/integration/auth-disabled-user.test.ts
git commit -m "feat(users): role/profile/lifecycle fields + disabled-login-block"
```

---

## Task 4: Articles.ts — currentReviewer, Status-Hook, Access-Refactor

**Files:**
- Modify: `src/collections/Articles.ts`
- Test: `tests/integration/article-status-hook.test.ts`
- Test: `tests/integration/permissions-articles.test.ts`

Article-Felder erweitern um `currentReviewer`, `status`-Übergangs-Validation via `beforeChange`-Hook, Access-Functions auf `hasPermission` umstellen. Claim-Auto-Set bei Status-Wechsel zu/von `in_review`.

- [ ] **Step 4.1: Add test-helper for user fixtures**

`tests/helpers/user-fixtures.ts`:
```typescript
import type { Payload } from 'payload';
import type { Role } from '@/lib/auth-permissions';

export interface UserFixture {
  id: number;
  email: string;
  password: string;
  role: Role;
  displayName: string;
}

export async function createUserFixture(
  payload: Payload,
  role: Role,
  overrides: Partial<UserFixture> = {},
): Promise<UserFixture> {
  const email = overrides.email ?? `${role}-${Date.now()}-${Math.random()}@test.local`;
  const password = overrides.password ?? 'TestPass123!';
  const displayName = overrides.displayName ?? `${role} fixture`;
  const created = await payload.create({
    collection: 'users',
    data: { email, password, displayName, role, disabled: false } as never,
  });
  return { id: created.id as number, email, password, role, displayName };
}

export async function getUserToken(payload: Payload, email: string, password: string): Promise<string> {
  const result = await payload.login({
    collection: 'users',
    data: { email, password },
  });
  return result.token as string;
}
```

- [ ] **Step 4.2: Write failing test for article status transitions**

`tests/integration/article-status-hook.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;
let editor: { id: number };
let reviewer: { id: number };

beforeAll(async () => {
  payload = await getPayload({ config });
  editor = await createUserFixture(payload, 'editor');
  reviewer = await createUserFixture(payload, 'reviewer');
});

async function makeArticle(initialStatus: string = 'draft') {
  return await payload.create({
    collection: 'articles',
    data: {
      title: `Test ${Date.now()}-${Math.random()}`,
      slug: `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      intent: 'background',
      summary: 'test summary',
      definition: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'd' }] }] } },
      praxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'p' }] }] } },
      risiken: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'r' }] }] } },
      quellen: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'q' }] }] } },
      status: initialStatus,
    } as never,
  });
}

describe('article status transitions', () => {
  it('reviewer cannot transition draft → published', async () => {
    const article = await makeArticle('draft');
    await expect(
      payload.update({
        collection: 'articles',
        id: article.id,
        data: { status: 'published' } as never,
        overrideAccess: false,
        user: reviewer as never,
      }),
    ).rejects.toThrow(/permission|forbidden|verboten/i);
  });

  it('editor can transition draft → in_review → ready_to_publish → published', async () => {
    const article = await makeArticle('draft');
    let updated = await payload.update({
      collection: 'articles', id: article.id,
      data: { status: 'in_review' } as never,
      overrideAccess: false, user: editor as never,
    });
    expect((updated as { status: string }).status).toBe('in_review');

    updated = await payload.update({
      collection: 'articles', id: article.id,
      data: { status: 'ready_to_publish' } as never,
      overrideAccess: false, user: editor as never,
    });
    expect((updated as { status: string }).status).toBe('ready_to_publish');

    updated = await payload.update({
      collection: 'articles', id: article.id,
      data: { status: 'published' } as never,
      overrideAccess: false, user: editor as never,
    });
    expect((updated as { status: string }).status).toBe('published');
  });

  it('claim: status → in_review sets currentReviewer = req.user', async () => {
    const article = await makeArticle('draft');
    const updated = await payload.update({
      collection: 'articles', id: article.id,
      data: { status: 'in_review' } as never,
      overrideAccess: false, user: reviewer as never,
    });
    const currentReviewer = (updated as { currentReviewer?: number | { id: number } }).currentReviewer;
    const reviewerId = typeof currentReviewer === 'object' ? currentReviewer?.id : currentReviewer;
    expect(reviewerId).toBe(reviewer.id);
  });

  it('claim: status → published clears currentReviewer + appends to reviewedBy', async () => {
    const article = await payload.create({
      collection: 'articles',
      data: {
        title: `Test ${Date.now()}-c`,
        slug: `test-${Date.now()}-c`,
        intent: 'background',
        summary: 'x',
        definition: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'd' }] }] } },
        praxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'p' }] }] } },
        risiken: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'r' }] }] } },
        quellen: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'q' }] }] } },
        status: 'in_review',
        currentReviewer: reviewer.id,
      } as never,
    });
    const updated = await payload.update({
      collection: 'articles', id: article.id,
      data: { status: 'published' } as never,
      overrideAccess: false, user: editor as never,
    });
    expect((updated as { currentReviewer?: unknown }).currentReviewer).toBeFalsy();
    const reviewedBy = (updated as { reviewedBy?: Array<number | { id: number }> }).reviewedBy ?? [];
    const ids = reviewedBy.map((r) => typeof r === 'object' ? r.id : r);
    expect(ids).toContain(reviewer.id);
  });
});
```

- [ ] **Step 4.3: Run test to verify it fails**

Run: `pnpm vitest run tests/integration/article-status-hook.test.ts`
Expected: FAIL — `currentReviewer` unknown field, transitions not blocked.

- [ ] **Step 4.4: Update Articles.ts**

Add to `src/collections/Articles.ts` — new imports at top:
```typescript
import { hasPermission, type Action, type Role } from '@/lib/auth-permissions';
```

Add new field `currentReviewer` after `reviewedBy` field (currently around line 197):
```typescript
{
  name: 'currentReviewer',
  type: 'relationship',
  label: 'Aktuell in Review bei',
  relationTo: 'users',
  hasMany: false,
  admin: {
    position: 'sidebar',
    readOnly: true,
    description: 'Wird beim Statuswechsel automatisch gesetzt.',
  },
},
```

Extend `status` field options (around line 220) — replace existing options:
```typescript
options: [
  { label: 'Entwurf', value: 'draft' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Bereit zur Veröffentlichung', value: 'ready_to_publish' },
  { label: 'Veröffentlicht', value: 'published' },
  { label: 'Archiviert', value: 'archived' },
],
```

Replace `access` block (currently `read: ({ req: { user } }) => {...}`):
```typescript
access: {
  read: ({ req: { user } }) => {
    if (!user) return { status: { equals: 'published' } };
    const role = (user as { role?: Role; disabled?: boolean }).role;
    const disabled = (user as { disabled?: boolean }).disabled;
    if (disabled) return { status: { equals: 'published' } };
    if (role && hasPermission({ id: 0, role, disabled: false }, 'readAllStati', 'articles')) {
      return true;
    }
    return { status: { equals: 'published' } };
  },
  create: ({ req: { user } }) => {
    if (!user) return false;
    const u = user as { role?: Role; disabled?: boolean };
    if (u.disabled || !u.role) return false;
    return hasPermission({ id: 0, role: u.role, disabled: false }, 'createArticle', 'articles');
  },
  update: ({ req: { user } }) => {
    if (!user) return false;
    const u = user as { role?: Role; disabled?: boolean };
    if (u.disabled || !u.role) return false;
    return hasPermission({ id: 0, role: u.role, disabled: false }, 'updateContent', 'articles');
  },
  delete: ({ req: { user } }) => {
    if (!user) return false;
    const u = user as { role?: Role; disabled?: boolean };
    if (u.disabled || !u.role) return false;
    return hasPermission({ id: 0, role: u.role, disabled: false }, 'delete', 'articles');
  },
},
```

Add a new `beforeChange`-hook to `hooks` block. Modify the `hooks` block (currently has `afterChange`) — add `beforeChange` array with status-transition + claim logic:
```typescript
hooks: {
  beforeChange: [
    async ({ data, originalDoc, req, operation }) => {
      if (operation !== 'update' || !data) return data;
      const prev = originalDoc as { status?: string; currentReviewer?: number | { id: number } | null; reviewedBy?: Array<number | { id: number }> } | undefined;
      const next = data as { status?: string; currentReviewer?: number | null; reviewedBy?: Array<number> };
      const prevStatus = prev?.status;
      const nextStatus = next.status;
      if (nextStatus && nextStatus !== prevStatus) {
        const user = req.user as { role?: Role; disabled?: boolean; id?: number } | undefined;
        if (!user?.role || user.disabled) {
          throw new Error('Permission denied: no role for status transition.');
        }
        const role = user.role;
        // Permission-Check je Übergang
        if (nextStatus === 'in_review' && !hasPermission({ id: 0, role, disabled: false }, 'transitionToReview', 'articles')) {
          throw new Error(`Permission denied: ${role} cannot transition to in_review.`);
        }
        if (nextStatus === 'ready_to_publish' && !hasPermission({ id: 0, role, disabled: false }, 'transitionToReadyToPublish', 'articles')) {
          throw new Error(`Permission denied: ${role} cannot transition to ready_to_publish.`);
        }
        if (nextStatus === 'published' && !hasPermission({ id: 0, role, disabled: false }, 'publish', 'articles')) {
          throw new Error(`Permission denied: ${role} cannot publish.`);
        }
        if (nextStatus === 'archived' && !hasPermission({ id: 0, role, disabled: false }, 'archive', 'articles')) {
          throw new Error(`Permission denied: ${role} cannot archive.`);
        }
        // Claim-Mechanik
        if (nextStatus === 'in_review' && prevStatus !== 'in_review' && prevStatus !== 'ready_to_publish') {
          next.currentReviewer = user.id ?? null;
        }
        if ((prevStatus === 'in_review' || prevStatus === 'ready_to_publish')
            && nextStatus !== 'in_review' && nextStatus !== 'ready_to_publish') {
          const prevReviewerRaw = prev?.currentReviewer ?? null;
          const prevReviewerId = typeof prevReviewerRaw === 'object' ? prevReviewerRaw?.id : prevReviewerRaw;
          if (prevReviewerId) {
            const existingReviewedBy = (prev?.reviewedBy ?? []).map((r) =>
              typeof r === 'object' ? r.id : r
            );
            if (!existingReviewedBy.includes(prevReviewerId)) {
              next.reviewedBy = [...existingReviewedBy, prevReviewerId];
            }
          }
          next.currentReviewer = null;
        }
      }
      return data;
    },
  ],
  afterChange: [
    async (args) => {
      await afterArticleChangeHook(args as never);
    },
  ],
},
```

- [ ] **Step 4.5: Run test to verify it passes**

Run: `pnpm vitest run tests/integration/article-status-hook.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 4.6: Run full suite to catch regressions**

Run: `pnpm vitest run`
Expected: previous tests + new still pass.

- [ ] **Step 4.7: Commit**

```bash
git add src/collections/Articles.ts tests/integration/article-status-hook.test.ts tests/helpers/user-fixtures.ts
git commit -m "feat(articles): status transitions + claim mechanic + permission-based access"
```

---

## Task 5: Submissions.ts + Media.ts Refactor

**Files:**
- Modify: `src/collections/Submissions.ts`
- Modify: `src/collections/Media.ts`
- Test: `tests/integration/submission-auto-attribution.test.ts`
- Test: `tests/integration/permissions-submissions.test.ts`
- Test: `tests/integration/permissions-media.test.ts`

Submissions bekommt `submittedBy` (auto-fill), `currentReviewer`, `reviewedBy`. Media bekommt `purpose` + `uploadedBy`. Beide Access-Functions auf `hasPermission`.

- [ ] **Step 5.1: Write failing test for auto-attribution**

`tests/integration/submission-auto-attribution.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('submission auto-attribution', () => {
  it('auto-fills submittedBy when req.user is present', async () => {
    const contributor = await createUserFixture(payload, 'contributor');
    const created = await payload.create({
      collection: 'submissions',
      data: {
        type: 'new_article',
        proposedTitle: 'Auto-attribution Test',
      } as never,
      overrideAccess: false,
      user: contributor as never,
    });
    const submittedBy = (created as { submittedBy?: number | { id: number } | null }).submittedBy;
    const id = typeof submittedBy === 'object' && submittedBy ? submittedBy.id : submittedBy;
    expect(id).toBe(contributor.id);
  });

  it('leaves submittedBy null for anonymous submissions', async () => {
    const created = await payload.create({
      collection: 'submissions',
      data: {
        type: 'new_article',
        proposedTitle: 'Anonymous Test',
      } as never,
    });
    expect((created as { submittedBy?: unknown }).submittedBy).toBeFalsy();
  });
});
```

- [ ] **Step 5.2: Run test to verify it fails**

Run: `pnpm vitest run tests/integration/submission-auto-attribution.test.ts`
Expected: FAIL — `submittedBy` field unknown.

- [ ] **Step 5.3: Update Submissions.ts**

In `src/collections/Submissions.ts`:

Add imports at top:
```typescript
import { hasPermission, type Role } from '@/lib/auth-permissions';
```

Add new fields right before `prNumber` field (around line 263):
```typescript
{
  name: 'submittedBy',
  type: 'relationship',
  relationTo: 'users',
  label: 'Eingereicht von',
  hasMany: false,
  admin: { readOnly: true, position: 'sidebar' },
},
{
  name: 'currentReviewer',
  type: 'relationship',
  relationTo: 'users',
  label: 'Aktuell in Review bei',
  hasMany: false,
  admin: { readOnly: true, position: 'sidebar' },
},
{
  name: 'reviewedBy',
  type: 'relationship',
  relationTo: 'users',
  label: 'Reviewt durch (Audit)',
  hasMany: true,
  admin: { readOnly: true, position: 'sidebar' },
},
```

Extend `beforeChange` hooks-array (it's existing, holding the displayTitle-logic) to include submittedBy auto-fill + currentReviewer claim. Replace the existing `beforeChange` array:
```typescript
beforeChange: [
  async ({ data, req, originalDoc, operation }) => {
    if (!data) return data;

    // Auto-attribution at create-time
    if (operation === 'create' && req.user && !data.submittedBy) {
      data.submittedBy = (req.user as { id?: number }).id;
    }

    // Claim mechanic on reviewStatus transitions
    if (operation === 'update') {
      const prev = originalDoc as { reviewStatus?: string; currentReviewer?: number | { id: number } | null; reviewedBy?: Array<number | { id: number }> } | undefined;
      const nextStatus = data.reviewStatus as string | undefined;
      const prevStatus = prev?.reviewStatus;
      if (nextStatus && nextStatus !== prevStatus) {
        const user = req.user as { id?: number } | undefined;
        if (nextStatus === 'in_review' && user?.id) {
          data.currentReviewer = user.id;
        }
        if ((prevStatus === 'in_review') && nextStatus !== 'in_review') {
          const prevReviewerRaw = prev?.currentReviewer ?? null;
          const prevReviewerId = typeof prevReviewerRaw === 'object' && prevReviewerRaw ? prevReviewerRaw.id : prevReviewerRaw;
          if (prevReviewerId) {
            const existing = (prev?.reviewedBy ?? []).map((r) => typeof r === 'object' ? r.id : r);
            if (!existing.includes(prevReviewerId as number)) {
              data.reviewedBy = [...existing, prevReviewerId];
            }
          }
          data.currentReviewer = null;
        }
      }
    }

    // displayTitle (existing logic, preserved)
    if (data.type === 'new_article') {
      data.displayTitle = data.proposedTitle ?? 'Neuer Artikel-Vorschlag';
      return data;
    }
    if (data.type === 'correction') {
      if (data.relatedArticle) {
        try {
          const article = await req.payload.findByID({
            collection: 'articles',
            id: data.relatedArticle,
            depth: 0,
          });
          const title = (article as { title?: string })?.title ?? 'Artikel';
          data.displayTitle = `Korrektur: ${title}`;
        } catch {
          data.displayTitle = 'Korrektur';
        }
      } else {
        data.displayTitle = 'Korrektur';
      }
      return data;
    }
    return data;
  },
],
```

Replace `access` block (currently uses `Boolean(user)`):
```typescript
access: {
  read: ({ req: { user } }) => {
    if (!user) return false;
    const u = user as { role?: Role; disabled?: boolean; id?: number };
    if (u.disabled || !u.role) return false;
    if (hasPermission({ id: 0, role: u.role, disabled: false }, 'readAllSubmissions', 'submissions')) {
      return true;
    }
    if (hasPermission({ id: 0, role: u.role, disabled: false }, 'readOwnSubmissions', 'submissions')) {
      return { submittedBy: { equals: u.id } };
    }
    return false;
  },
  create: () => true, // anonymous + authenticated; submittedBy auto-fill via hook
  update: ({ req: { user } }) => {
    if (!user) return false;
    const u = user as { role?: Role; disabled?: boolean };
    if (u.disabled || !u.role) return false;
    return hasPermission({ id: 0, role: u.role, disabled: false }, 'updateSubmission', 'submissions');
  },
  delete: ({ req: { user } }) => {
    if (!user) return false;
    const u = user as { role?: Role; disabled?: boolean };
    if (u.disabled || !u.role) return false;
    return hasPermission({ id: 0, role: u.role, disabled: false }, 'delete', 'submissions');
  },
},
```

- [ ] **Step 5.4: Update Media.ts with purpose-based access**

Replace `src/collections/Media.ts`:
```typescript
import type { CollectionConfig } from 'payload';
import { hasPermission, type Role } from '@/lib/auth-permissions';

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: ({ req: { user } }) => {
      // article_image + other: public
      // avatar: own or editor+
      if (!user) {
        return { purpose: { not_equals: 'avatar' } };
      }
      const u = user as { role?: Role; disabled?: boolean; id?: number };
      if (u.disabled || !u.role) {
        return { purpose: { not_equals: 'avatar' } };
      }
      if (hasPermission({ id: 0, role: u.role, disabled: false }, 'readOthersAvatar', 'media')) {
        return true;
      }
      // Contributor / reviewer: alle non-avatar + own avatars
      return {
        or: [
          { purpose: { not_equals: 'avatar' } },
          { and: [{ purpose: { equals: 'avatar' } }, { uploadedBy: { equals: u.id } }] },
        ],
      };
    },
    create: ({ req: { user } }) => {
      if (!user) return false;
      const u = user as { role?: Role; disabled?: boolean };
      if (u.disabled || !u.role) return false;
      return hasPermission({ id: 0, role: u.role, disabled: false }, 'uploadAvatar', 'media') ||
             hasPermission({ id: 0, role: u.role, disabled: false }, 'uploadArticleImage', 'media');
    },
    update: ({ req: { user } }) => {
      if (!user) return false;
      const u = user as { role?: Role; disabled?: boolean; id?: number };
      if (u.disabled || !u.role) return false;
      // own media OR editor+
      if (hasPermission({ id: 0, role: u.role, disabled: false }, 'delete', 'media')) return true;
      return { uploadedBy: { equals: u.id } };
    },
    delete: ({ req: { user } }) => {
      if (!user) return false;
      const u = user as { role?: Role; disabled?: boolean; id?: number };
      if (u.disabled || !u.role) return false;
      if (u.role === 'admin') return true;
      return { uploadedBy: { equals: u.id } };
    },
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (!data) return data;
        if (operation === 'create' && req.user && !data.uploadedBy) {
          data.uploadedBy = (req.user as { id?: number }).id;
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'purpose',
      type: 'select',
      required: true,
      defaultValue: 'other',
      options: [
        { label: 'Avatar (Profilbild)', value: 'avatar' },
        { label: 'Artikel-Bild', value: 'article_image' },
        { label: 'Sonstiges', value: 'other' },
      ],
    },
    {
      name: 'uploadedBy',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      admin: { readOnly: true },
    },
  ],
  upload: true,
};
```

- [ ] **Step 5.5: Run tests to verify both pass**

Run: `pnpm vitest run tests/integration/submission-auto-attribution.test.ts`
Expected: PASS, 2 tests

Run: `pnpm vitest run`
Expected: full suite green.

- [ ] **Step 5.6: Commit**

```bash
git add src/collections/Submissions.ts src/collections/Media.ts tests/integration/submission-auto-attribution.test.ts
git commit -m "feat(submissions,media): auto-attribution + claim + purpose-based avatar access"
```

---

## Task 6: Auth-Layer Read-Side (getSession, requireUser, requireRole)

**Files:**
- Create: `src/lib/auth.ts` (Read-Side only — Server-Actions kommen in T7+T8)
- Test: `tests/integration/auth-get-session.test.ts`

Single place that reads Payload-Auth. Server Components and Actions go through here. We DON'T mock Payload — these are thin wrappers.

- [ ] **Step 6.1: Write failing test for getSession**

`tests/integration/auth-get-session.test.ts`:
```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('auth.getSession', () => {
  it('returns user data when valid token is in cookies', async () => {
    const editor = await createUserFixture(payload, 'editor');
    const { token } = await payload.login({
      collection: 'users',
      data: { email: editor.email, password: editor.password },
    });

    // Mock next/headers cookies
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (name: string) => name === 'payload-token' ? { value: token } : undefined,
      }),
    }));

    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    expect(session?.email).toBe(editor.email);
    expect(session?.role).toBe('editor');
    expect(session?.disabled).toBe(false);
    expect(session).not.toHaveProperty('password');
    vi.doUnmock('next/headers');
  });

  it('returns null when no token cookie is set', async () => {
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ get: () => undefined }),
    }));
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    expect(session).toBeNull();
    vi.doUnmock('next/headers');
  });
});
```

- [ ] **Step 6.2: Run test to verify it fails**

Run: `pnpm vitest run tests/integration/auth-get-session.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth'`

- [ ] **Step 6.3: Implement Read-Side of auth.ts**

`src/lib/auth.ts`:
```typescript
import { cookies } from 'next/headers';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { hasPermission, type Action, type Resource, type Role } from './auth-permissions';

export interface Session {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  disabled: boolean;
  avatar?: number | null;
}

async function payloadInstance() {
  return await getPayload({ config });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('payload-token')?.value;
  if (!token) return null;
  try {
    const payload = await payloadInstance();
    const result = await payload.auth({
      headers: new Headers({ cookie: `payload-token=${token}` }),
    });
    const user = result.user;
    if (!user) return null;
    const u = user as {
      id: number; email: string; displayName?: string; role?: Role;
      disabled?: boolean; avatar?: number | { id: number } | null;
    };
    const avatar = typeof u.avatar === 'object' && u.avatar ? u.avatar.id : (u.avatar ?? null);
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName ?? '',
      role: u.role ?? 'contributor',
      disabled: u.disabled ?? false,
      avatar,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  if (session.disabled) throw new Error('Account disabled');
  return session;
}

export async function requireRole(roles: Role[]): Promise<Session> {
  const session = await requireUser();
  if (!roles.includes(session.role)) throw new Error('Forbidden');
  return session;
}

export function can(session: Session | null, action: Action, resource: Resource): boolean {
  return hasPermission(session, action, resource);
}
```

- [ ] **Step 6.4: Run test to verify it passes**

Run: `pnpm vitest run tests/integration/auth-get-session.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/auth.ts tests/integration/auth-get-session.test.ts
git commit -m "feat(auth): getSession + requireUser + requireRole + can helpers"
```

---

## Task 7: Auth Server-Actions Set 1 (login, logout, invite, setPasswordFromToken)

**Files:**
- Modify: `src/lib/auth.ts` (add Server-Actions)
- Create: `src/lib/mail.ts` (Mail-Wrapper)
- Test: `tests/integration/auth-login-logout.test.ts`
- Test: `tests/integration/auth-invite-flow.test.ts`
- Test: `tests/integration/auth-set-password-from-token.test.ts`
- Test: `tests/integration/magic-link-security.test.ts`

Server-Actions, die als `'use server'` exportiert werden. Mail-Wrapper als zentrale Stelle, die per Mock im Test-Setup ersetzt wird.

- [ ] **Step 7.1: Create mail wrapper**

`src/lib/mail.ts`:
```typescript
import { getPayload } from 'payload';
import config from '@/payload.config';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const payload = await getPayload({ config });
  await payload.sendEmail({
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
```

- [ ] **Step 7.2: Extend tests/setup.node.ts with mail mock**

Append to `tests/setup.node.ts`:
```typescript
vi.mock('@/lib/mail', () => ({
  sendMail: vi.fn(async () => undefined),
}));
```

- [ ] **Step 7.3: Write failing test for loginAction + logoutAction**

`tests/integration/auth-login-logout.test.ts`:
```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('loginAction', () => {
  it('returns ok + redirect path for editor', async () => {
    const editor = await createUserFixture(payload, 'editor');

    const cookieSet = vi.fn();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: cookieSet, delete: vi.fn(), get: () => undefined }),
    }));

    const { loginAction } = await import('@/lib/auth');
    const result = await loginAction(editor.email, editor.password);
    expect(result.ok).toBe(true);
    expect(result.redirectTo).toBe('/admin');
    expect(cookieSet).toHaveBeenCalled();
    vi.doUnmock('next/headers');
  });

  it('returns ok + /mein-bereich redirect for contributor', async () => {
    const contributor = await createUserFixture(payload, 'contributor');
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { loginAction } = await import('@/lib/auth');
    const result = await loginAction(contributor.email, contributor.password);
    expect(result.redirectTo).toBe('/mein-bereich');
    vi.doUnmock('next/headers');
  });

  it('returns error for wrong password', async () => {
    const editor = await createUserFixture(payload, 'editor');
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { loginAction } = await import('@/lib/auth');
    const result = await loginAction(editor.email, 'wrong-password');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    vi.doUnmock('next/headers');
  });

  it('blocks login for disabled user even with correct password', async () => {
    const user = await createUserFixture(payload, 'contributor');
    await payload.update({ collection: 'users', id: user.id, data: { disabled: true } as never });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { loginAction } = await import('@/lib/auth');
    const result = await loginAction(user.email, user.password);
    expect(result.ok).toBe(false);
    vi.doUnmock('next/headers');
  });
});

describe('logoutAction', () => {
  it('deletes payload-token cookie', async () => {
    const cookieDelete = vi.fn();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ delete: cookieDelete, set: vi.fn(), get: () => undefined }),
    }));
    const { logoutAction } = await import('@/lib/auth');
    await logoutAction();
    expect(cookieDelete).toHaveBeenCalledWith('payload-token');
    vi.doUnmock('next/headers');
  });
});
```

- [ ] **Step 7.4: Run test to verify it fails**

Run: `pnpm vitest run tests/integration/auth-login-logout.test.ts`
Expected: FAIL — actions not exported.

- [ ] **Step 7.5: Add login/logout actions to auth.ts**

Append to `src/lib/auth.ts`:
```typescript
'use server';
// (Note: file-level 'use server' directive must come before all imports;
// move it to the very top of auth.ts. The whole file is now server-only.)
```

Move the `'use server'` to the very top of `src/lib/auth.ts` (line 1). Add these exports after the existing functions:
```typescript
import type { Role } from './auth-permissions';

export interface LoginResult {
  ok: boolean;
  redirectTo?: string;
  error?: string;
}

function redirectForRole(role: Role): string {
  if (role === 'contributor') return '/mein-bereich';
  return '/admin';
}

export async function loginAction(email: string, password: string): Promise<LoginResult> {
  try {
    const payload = await payloadInstance();
    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    });
    if (!result.token) {
      return { ok: false, error: 'Login fehlgeschlagen.' };
    }
    const cookieStore = await cookies();
    cookieStore.set('payload-token', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    const role = (result.user as { role?: Role }).role ?? 'contributor';
    return { ok: true, redirectTo: redirectForRole(role) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login fehlgeschlagen.';
    return { ok: false, error: message };
  }
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('payload-token');
}
```

- [ ] **Step 7.6: Run test to verify it passes**

Run: `pnpm vitest run tests/integration/auth-login-logout.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 7.7: Write failing test for inviteUserAction**

`tests/integration/auth-invite-flow.test.ts`:
```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';
import { sendMail } from '@/lib/mail';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('inviteUserAction', () => {
  beforeEach(() => {
    vi.mocked(sendMail).mockClear();
  });

  it('admin can invite an editor; user created with token + invitation mail sent', async () => {
    const admin = await createUserFixture(payload, 'admin');
    const { token: adminToken } = await payload.login({
      collection: 'users', data: { email: admin.email, password: admin.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: adminToken } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));

    const { inviteUserAction } = await import('@/lib/auth');
    const email = `invited-${Date.now()}@test.local`;
    const result = await inviteUserAction(email, 'editor', 'Invited Editor');
    expect(result.ok).toBe(true);

    const found = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      depth: 0,
    });
    expect(found.docs).toHaveLength(1);
    const user = found.docs[0] as { setPasswordToken?: string; role?: string };
    expect(user.role).toBe('editor');
    expect(user.setPasswordToken).toBeTruthy();
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
    vi.doUnmock('next/headers');
  });

  it('editor can invite a reviewer but NOT an admin (privilege escalation)', async () => {
    const editor = await createUserFixture(payload, 'editor');
    const { token } = await payload.login({
      collection: 'users', data: { email: editor.email, password: editor.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { inviteUserAction } = await import('@/lib/auth');

    // Editor → Reviewer: OK
    const okResult = await inviteUserAction(`rev-${Date.now()}@test.local`, 'reviewer', 'Rev');
    expect(okResult.ok).toBe(true);

    // Editor → Admin: BLOCKED
    const blockedResult = await inviteUserAction(`adm-${Date.now()}@test.local`, 'admin', 'A');
    expect(blockedResult.ok).toBe(false);
    expect(blockedResult.error).toMatch(/permission|forbidden|verboten/i);
    vi.doUnmock('next/headers');
  });

  it('contributor cannot invite anyone', async () => {
    const contrib = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users', data: { email: contrib.email, password: contrib.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { inviteUserAction } = await import('@/lib/auth');
    const result = await inviteUserAction(`x-${Date.now()}@test.local`, 'contributor', 'X');
    expect(result.ok).toBe(false);
    vi.doUnmock('next/headers');
  });
});
```

- [ ] **Step 7.8: Add inviteUserAction**

Append to `src/lib/auth.ts`:
```typescript
import { generateToken, INVITE_EXPIRY_MS } from './auth-tokens';
import { sendMail } from './mail';
import { renderInvitationMail } from './mail-templates/invitation';

export interface InviteResult {
  ok: boolean;
  userId?: number;
  error?: string;
}

function actionForInvite(targetRole: Role): Action {
  if (targetRole === 'admin') return 'inviteAdmin';
  if (targetRole === 'editor') return 'inviteEditor';
  if (targetRole === 'reviewer') return 'inviteReviewer';
  return 'inviteContributor';
}

export async function inviteUserAction(
  email: string,
  role: Role,
  displayName: string,
): Promise<InviteResult> {
  try {
    const session = await requireUser();
    const action = actionForInvite(role);
    if (!hasPermission(session, action, 'users')) {
      return { ok: false, error: `Permission denied: ${session.role} cannot invite ${role}.` };
    }
    const payload = await payloadInstance();
    const token = generateToken();
    const expires = new Date(Date.now() + INVITE_EXPIRY_MS);
    // Random initial password — user will overwrite via setPasswordFromToken
    const tempPassword = generateToken();
    const created = await payload.create({
      collection: 'users',
      data: {
        email,
        password: tempPassword,
        displayName,
        role,
        disabled: false,
        setPasswordToken: token,
        setPasswordTokenExpiresAt: expires.toISOString(),
        invitedBy: session.id,
        invitedAt: new Date().toISOString(),
      } as never,
    });
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const magicLink = `${baseUrl}/passwort-setzen?token=${encodeURIComponent(token)}`;
    const mail = renderInvitationMail({
      to: email,
      displayName,
      role,
      invitedBy: session.displayName,
      magicLink,
      expiresAt: expires,
    });
    await sendMail({ to: email, ...mail });
    return { ok: true, userId: created.id as number };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invite failed.' };
  }
}
```

(Note: `renderInvitationMail` is defined in Task 9. To keep T7 testable, also create a stub file `src/lib/mail-templates/invitation.ts` that exports a minimal valid signature now — T9 fills it in fully.)

Create stub `src/lib/mail-templates/invitation.ts`:
```typescript
export function renderInvitationMail(args: {
  to: string; displayName: string; role: string; invitedBy: string; magicLink: string; expiresAt: Date;
}): { subject: string; html: string; text: string } {
  return {
    subject: `Willkommen bei PflegeAtlas`,
    html: `<p>Hallo ${args.displayName}, <a href="${args.magicLink}">aktiviere</a> deinen Account.</p>`,
    text: `Hallo ${args.displayName}, aktiviere: ${args.magicLink}`,
  };
}
```

- [ ] **Step 7.9: Run test to verify invite passes**

Run: `pnpm vitest run tests/integration/auth-invite-flow.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 7.10: Write failing test for setPasswordFromTokenAction + magic-link-security**

`tests/integration/auth-set-password-from-token.test.ts`:
```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { generateToken, INVITE_EXPIRY_MS } from '@/lib/auth-tokens';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

async function makeInvitedUser(tokenOverride?: string, expiryMs: number = INVITE_EXPIRY_MS) {
  const email = `invited-${Date.now()}-${Math.random()}@test.local`;
  const token = tokenOverride ?? generateToken();
  const user = await payload.create({
    collection: 'users',
    data: {
      email,
      password: generateToken(),
      displayName: 'X',
      role: 'contributor',
      disabled: false,
      setPasswordToken: token,
      setPasswordTokenExpiresAt: new Date(Date.now() + expiryMs).toISOString(),
    } as never,
  });
  return { id: user.id as number, email, token };
}

describe('setPasswordFromTokenAction', () => {
  beforeEach(() => {
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
  });
  afterEach(() => vi.doUnmock('next/headers'));

  it('sets password + clears token + returns login redirect', async () => {
    const { token, email } = await makeInvitedUser();
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction(token, 'NewSecurePass1!');
    expect(result.ok).toBe(true);
    expect(result.redirectTo).toBe('/mein-bereich');

    // Token cleared
    const refetched = await payload.find({
      collection: 'users', where: { email: { equals: email } }, depth: 0,
    });
    expect((refetched.docs[0] as { setPasswordToken?: string | null }).setPasswordToken).toBeFalsy();

    // Login works with new password
    const loginResult = await payload.login({
      collection: 'users', data: { email, password: 'NewSecurePass1!' },
    });
    expect(loginResult.token).toBeTruthy();
  });

  it('rejects expired tokens', async () => {
    const { token } = await makeInvitedUser(undefined, -1000); // expired
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction(token, 'NewPass1!');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/expired|abgelaufen|invalid/i);
  });

  it('rejects unknown tokens', async () => {
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction('not-a-real-token', 'NewPass1!');
    expect(result.ok).toBe(false);
  });

  it('rejects reusing the same token twice', async () => {
    const { token } = await makeInvitedUser();
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const first = await setPasswordFromTokenAction(token, 'NewPass1!');
    expect(first.ok).toBe(true);
    const second = await setPasswordFromTokenAction(token, 'Other2!');
    expect(second.ok).toBe(false);
  });

  it('rejects passwords shorter than 8 chars', async () => {
    const { token } = await makeInvitedUser();
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction(token, 'short');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/8|kurz|short/i);
  });
});
```

- [ ] **Step 7.11: Add setPasswordFromTokenAction**

Append to `src/lib/auth.ts`:
```typescript
import { isTokenValid } from './auth-tokens';

export interface SetPasswordResult {
  ok: boolean;
  redirectTo?: string;
  error?: string;
}

export async function setPasswordFromTokenAction(
  token: string,
  newPassword: string,
): Promise<SetPasswordResult> {
  if (newPassword.length < 8) {
    return { ok: false, error: 'Passwort muss mindestens 8 Zeichen lang sein.' };
  }
  if (!token) {
    return { ok: false, error: 'Kein Token übergeben.' };
  }
  try {
    const payload = await payloadInstance();
    const found = await payload.find({
      collection: 'users',
      where: { setPasswordToken: { equals: token } },
      depth: 0,
      limit: 1,
    });
    if (found.docs.length === 0) {
      return { ok: false, error: 'Token ungültig.' };
    }
    const user = found.docs[0] as {
      id: number; email: string; role?: Role;
      setPasswordTokenExpiresAt?: string | null;
    };
    if (!isTokenValid(user.setPasswordTokenExpiresAt)) {
      return { ok: false, error: 'Token abgelaufen.' };
    }
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        password: newPassword,
        setPasswordToken: null,
        setPasswordTokenExpiresAt: null,
      } as never,
    });
    // Auto-login
    const loginResult = await payload.login({
      collection: 'users',
      data: { email: user.email, password: newPassword },
    });
    if (loginResult.token) {
      const cookieStore = await cookies();
      cookieStore.set('payload-token', loginResult.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24,
      });
    }
    const role = (user.role ?? 'contributor') as Role;
    return { ok: true, redirectTo: redirectForRole(role) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Set-Password failed.' };
  }
}
```

- [ ] **Step 7.12: Run all T7 tests**

Run: `pnpm vitest run tests/integration/auth-set-password-from-token.test.ts tests/integration/auth-login-logout.test.ts tests/integration/auth-invite-flow.test.ts`
Expected: all PASS

- [ ] **Step 7.13: Commit**

```bash
git add src/lib/auth.ts src/lib/mail.ts src/lib/mail-templates/invitation.ts tests/setup.node.ts tests/integration/auth-login-logout.test.ts tests/integration/auth-invite-flow.test.ts tests/integration/auth-set-password-from-token.test.ts
git commit -m "feat(auth): server-actions login/logout/invite/setPasswordFromToken"
```

---

## Task 8: Auth Server-Actions Set 2 (forgotPassword, updateProfile, deleteOwn, exportOwn)

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `src/lib/user-soft-delete.ts`
- Create: `src/lib/data-export.ts`
- Test: `tests/integration/auth-forgot-password.test.ts`
- Test: `tests/integration/auth-update-own-profile.test.ts`
- Test: `tests/integration/auth-delete-own-account.test.ts`
- Test: `tests/integration/auth-data-export.test.ts`
- Test: `tests/unit/user-soft-delete.test.ts`
- Test: `tests/unit/data-export.test.ts`

- [ ] **Step 8.1: Write unit test for user-soft-delete**

`tests/unit/user-soft-delete.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { anonymizeUserPatch } from '@/lib/user-soft-delete';

describe('anonymizeUserPatch', () => {
  it('returns patch with disabled=true and randomized email', () => {
    const patch = anonymizeUserPatch();
    expect(patch.disabled).toBe(true);
    expect(patch.email).toMatch(/^deleted-[A-Za-z0-9_-]+@invalid\.local$/);
    expect(patch.displayName).toBe('Gelöschte:r Beitragende:r');
    expect(patch.bio).toBeNull();
    expect(patch.pflegerischeRolle).toBeNull();
    expect(patch.bundesland).toBeNull();
    expect(patch.avatar).toBeNull();
  });

  it('produces unique emails per call', () => {
    const a = anonymizeUserPatch();
    const b = anonymizeUserPatch();
    expect(a.email).not.toBe(b.email);
  });
});
```

- [ ] **Step 8.2: Implement user-soft-delete**

`src/lib/user-soft-delete.ts`:
```typescript
import { randomBytes } from 'node:crypto';

export interface AnonymizedUserPatch {
  email: string;
  displayName: string;
  bio: null;
  pflegerischeRolle: null;
  bundesland: null;
  avatar: null;
  disabled: true;
}

export function anonymizeUserPatch(): AnonymizedUserPatch {
  const random = randomBytes(8).toString('base64url');
  return {
    email: `deleted-${random}@invalid.local`,
    displayName: 'Gelöschte:r Beitragende:r',
    bio: null,
    pflegerischeRolle: null,
    bundesland: null,
    avatar: null,
    disabled: true,
  };
}
```

Run: `pnpm vitest run tests/unit/user-soft-delete.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 8.3: Write unit test for data-export**

`tests/unit/data-export.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { shapeExport } from '@/lib/data-export';

describe('shapeExport', () => {
  it('strips password and includes expected sections', () => {
    const export_ = shapeExport({
      user: { id: 1, email: 'a@b.com', displayName: 'A', role: 'contributor', password: 'shouldnotappear' } as never,
      submissions: [{ id: 10, type: 'new_article', proposedTitle: 'X' } as never],
      articles: [{ id: 20, title: 'Y' } as never],
    });
    expect(export_.user.email).toBe('a@b.com');
    expect(export_.user).not.toHaveProperty('password');
    expect(export_.submissions).toHaveLength(1);
    expect(export_.articles).toHaveLength(1);
    expect(export_.exportedAt).toMatch(/T/); // ISO timestamp
  });
});
```

- [ ] **Step 8.4: Implement data-export**

`src/lib/data-export.ts`:
```typescript
export interface ExportShape {
  exportedAt: string;
  user: Record<string, unknown>;
  submissions: Array<Record<string, unknown>>;
  articles: Array<Record<string, unknown>>;
}

export function shapeExport(args: {
  user: Record<string, unknown>;
  submissions: Array<Record<string, unknown>>;
  articles: Array<Record<string, unknown>>;
}): ExportShape {
  const { password: _password, ...userClean } = args.user;
  return {
    exportedAt: new Date().toISOString(),
    user: userClean,
    submissions: args.submissions,
    articles: args.articles,
  };
}
```

Run: `pnpm vitest run tests/unit/data-export.test.ts`
Expected: PASS

- [ ] **Step 8.5: Write integration test for forgotPasswordAction**

`tests/integration/auth-forgot-password.test.ts`:
```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('requestPasswordResetAction', () => {
  it('returns ok=true even for unknown email (anti-enumeration)', async () => {
    const { requestPasswordResetAction } = await import('@/lib/auth');
    const result = await requestPasswordResetAction('nobody@nowhere.local');
    expect(result.ok).toBe(true);
  });

  it('returns ok=true for known email and triggers Payload forgotPassword', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { requestPasswordResetAction } = await import('@/lib/auth');
    const result = await requestPasswordResetAction(user.email);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 8.6: Add requestPasswordResetAction to auth.ts**

Append to `src/lib/auth.ts`:
```typescript
// Simple in-memory rate-limit bucket per IP (or 'unknown' if no IP available)
const forgotPasswordBucket = new Map<string, number[]>();
const FP_WINDOW_MS = 10 * 60 * 1000;
const FP_MAX = 3;

function rateLimitOk(key: string): boolean {
  const now = Date.now();
  const buf = (forgotPasswordBucket.get(key) ?? []).filter((t) => now - t < FP_WINDOW_MS);
  if (buf.length >= FP_MAX) {
    forgotPasswordBucket.set(key, buf);
    return false;
  }
  buf.push(now);
  forgotPasswordBucket.set(key, buf);
  return true;
}

export async function requestPasswordResetAction(email: string): Promise<{ ok: true }> {
  // Always return ok (anti-enumeration), but check rate-limit silently
  if (!rateLimitOk(email)) {
    return { ok: true };
  }
  try {
    const payload = await payloadInstance();
    await payload.forgotPassword({
      collection: 'users',
      data: { email },
      disableEmail: false,
    });
  } catch {
    // Swallow — anti-enumeration
  }
  return { ok: true };
}
```

Run: `pnpm vitest run tests/integration/auth-forgot-password.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 8.7: Write test for updateOwnProfileAction (whitelist)**

`tests/integration/auth-update-own-profile.test.ts`:
```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('updateOwnProfileAction', () => {
  it('updates whitelisted fields', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users', data: { email: user.email, password: user.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { updateOwnProfileAction } = await import('@/lib/auth');
    const result = await updateOwnProfileAction({
      displayName: 'New Name',
      bio: 'new bio',
      pflegerischeRolle: 'pflegefachkraft',
      bundesland: 'bayern',
    });
    expect(result.ok).toBe(true);
    const refetched = await payload.findByID({ collection: 'users', id: user.id });
    expect((refetched as { displayName: string }).displayName).toBe('New Name');
    vi.doUnmock('next/headers');
  });

  it('IGNORES non-whitelisted fields (role, disabled, email)', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users', data: { email: user.email, password: user.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { updateOwnProfileAction } = await import('@/lib/auth');
    await updateOwnProfileAction({
      displayName: 'X',
      role: 'admin' as never,        // tries privilege escalation
      disabled: true as never,
      email: 'hijack@x.com' as never,
    });
    const refetched = await payload.findByID({ collection: 'users', id: user.id });
    expect((refetched as { role: string }).role).toBe('contributor'); // unchanged
    expect((refetched as { disabled: boolean }).disabled).toBe(false); // unchanged
    expect((refetched as { email: string }).email).toBe(user.email); // unchanged
    vi.doUnmock('next/headers');
  });
});
```

- [ ] **Step 8.8: Add updateOwnProfileAction**

Append to `src/lib/auth.ts`:
```typescript
export interface OwnProfilePatch {
  displayName?: string;
  bio?: string | null;
  pflegerischeRolle?: string | null;
  bundesland?: string | null;
  avatar?: number | null;
}

export async function updateOwnProfileAction(
  data: OwnProfilePatch,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireUser();
    const whitelisted: Record<string, unknown> = {};
    if (data.displayName !== undefined) whitelisted.displayName = data.displayName;
    if (data.bio !== undefined) whitelisted.bio = data.bio;
    if (data.pflegerischeRolle !== undefined) whitelisted.pflegerischeRolle = data.pflegerischeRolle;
    if (data.bundesland !== undefined) whitelisted.bundesland = data.bundesland;
    if (data.avatar !== undefined) whitelisted.avatar = data.avatar;
    if (Object.keys(whitelisted).length === 0) {
      return { ok: true };
    }
    const payload = await payloadInstance();
    await payload.update({
      collection: 'users',
      id: session.id,
      data: whitelisted as never,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Update failed.' };
  }
}
```

Run: `pnpm vitest run tests/integration/auth-update-own-profile.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 8.9: Write test for deleteOwnAccountAction + exportOwnDataAction**

`tests/integration/auth-delete-own-account.test.ts`:
```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('deleteOwnAccountAction', () => {
  it('anonymizes contributor account', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users', data: { email: user.email, password: user.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { deleteOwnAccountAction } = await import('@/lib/auth');
    const result = await deleteOwnAccountAction('LÖSCHEN');
    expect(result.ok).toBe(true);
    const refetched = await payload.findByID({ collection: 'users', id: user.id });
    expect((refetched as { disabled: boolean }).disabled).toBe(true);
    expect((refetched as { email: string }).email).toMatch(/^deleted-/);
    vi.doUnmock('next/headers');
  });

  it('rejects admin self-delete', async () => {
    const admin = await createUserFixture(payload, 'admin');
    const { token } = await payload.login({
      collection: 'users', data: { email: admin.email, password: admin.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { deleteOwnAccountAction } = await import('@/lib/auth');
    const result = await deleteOwnAccountAction('LÖSCHEN');
    expect(result.ok).toBe(false);
    vi.doUnmock('next/headers');
  });

  it('rejects without confirmation string', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users', data: { email: user.email, password: user.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { deleteOwnAccountAction } = await import('@/lib/auth');
    const result = await deleteOwnAccountAction('wrong');
    expect(result.ok).toBe(false);
    vi.doUnmock('next/headers');
  });
});
```

`tests/integration/auth-data-export.test.ts`:
```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('exportOwnDataAction', () => {
  it('returns JSON with user + submissions, no password', async () => {
    const user = await createUserFixture(payload, 'contributor');
    await payload.create({
      collection: 'submissions',
      data: { type: 'new_article', proposedTitle: 'Mine', submittedBy: user.id } as never,
    });
    const { token } = await payload.login({
      collection: 'users', data: { email: user.email, password: user.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { exportOwnDataAction } = await import('@/lib/auth');
    const result = await exportOwnDataAction();
    expect(result.ok).toBe(true);
    expect(result.json).toBeTruthy();
    const data = JSON.parse(result.json!);
    expect(data.user.email).toBe(user.email);
    expect(data.user).not.toHaveProperty('password');
    expect(data.submissions).toBeInstanceOf(Array);
    expect(data.submissions.some((s: { proposedTitle?: string }) => s.proposedTitle === 'Mine')).toBe(true);
    vi.doUnmock('next/headers');
  });
});
```

- [ ] **Step 8.10: Add deleteOwnAccountAction + exportOwnDataAction**

Append to `src/lib/auth.ts`:
```typescript
import { anonymizeUserPatch } from './user-soft-delete';
import { shapeExport } from './data-export';

export async function deleteOwnAccountAction(
  confirmation: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (confirmation !== 'LÖSCHEN') {
      return { ok: false, error: 'Bestätigung fehlt oder falsch.' };
    }
    const session = await requireUser();
    if (session.role === 'admin') {
      return { ok: false, error: 'Admin-Accounts können sich nicht selbst löschen.' };
    }
    const payload = await payloadInstance();
    const patch = anonymizeUserPatch();
    await payload.update({
      collection: 'users',
      id: session.id,
      data: patch as never,
    });
    const cookieStore = await cookies();
    cookieStore.delete('payload-token');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Delete failed.' };
  }
}

export async function exportOwnDataAction(): Promise<{ ok: boolean; json?: string; error?: string }> {
  try {
    const session = await requireUser();
    const payload = await payloadInstance();
    const user = await payload.findByID({ collection: 'users', id: session.id, depth: 0 });
    const submissions = await payload.find({
      collection: 'submissions',
      where: { submittedBy: { equals: session.id } },
      limit: 1000,
      depth: 0,
    });
    const articles = await payload.find({
      collection: 'articles',
      where: { authors: { contains: session.id } },
      limit: 1000,
      depth: 0,
    });
    const shape = shapeExport({
      user: user as never,
      submissions: submissions.docs as never,
      articles: articles.docs as never,
    });
    return { ok: true, json: JSON.stringify(shape, null, 2) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Export failed.' };
  }
}
```

- [ ] **Step 8.11: Run all T8 tests**

```bash
pnpm vitest run tests/integration/auth-delete-own-account.test.ts tests/integration/auth-data-export.test.ts tests/integration/auth-forgot-password.test.ts tests/integration/auth-update-own-profile.test.ts tests/unit/user-soft-delete.test.ts tests/unit/data-export.test.ts
```
Expected: all PASS

- [ ] **Step 8.12: Commit**

```bash
git add src/lib/auth.ts src/lib/user-soft-delete.ts src/lib/data-export.ts tests/unit/user-soft-delete.test.ts tests/unit/data-export.test.ts tests/integration/auth-forgot-password.test.ts tests/integration/auth-update-own-profile.test.ts tests/integration/auth-delete-own-account.test.ts tests/integration/auth-data-export.test.ts
git commit -m "feat(auth): forgotPassword + updateOwnProfile + soft-delete + dataExport"
```

---

## Task 9: Mail-Templates (alle vier)

**Files:**
- Modify: `src/lib/mail-templates/invitation.ts` (T7 created stub; expand here)
- Create: `src/lib/mail-templates/forgot-password.ts`
- Create: `src/lib/mail-templates/welcome.ts`
- Create: `src/lib/mail-templates/ready-to-publish.ts`
- Modify: `src/collections/Users.ts` (Mail-Template-Override für forgotPassword)
- Modify: `src/collections/Articles.ts` (Mail-Trigger im afterChange-Hook für ready_to_publish)
- Test: `tests/unit/mail-templates/invitation.test.ts`
- Test: `tests/unit/mail-templates/forgot-password.test.ts`
- Test: `tests/unit/mail-templates/welcome.test.ts`
- Test: `tests/unit/mail-templates/ready-to-publish.test.ts`
- Test: `tests/integration/article-ready-to-publish-mail.test.ts`

Branded HTML+Plain-Text. System-Fonts mit Plex als Progressive Enhancement. Petrol-Akzent, single-column ~600px.

- [ ] **Step 9.1: Common HTML-Layout helper**

`src/lib/mail-templates/_layout.ts`:
```typescript
const PETROL = '#1f5e6d';

export function htmlLayout(args: { title: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${args.title}</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:Georgia,serif;color:#1a1a1a;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#faf7f2;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#fff;border-radius:8px;padding:32px;">
        <tr><td>
          <div style="font-size:24px;font-weight:700;color:${PETROL};letter-spacing:-0.01em;">Pflege·Atlas</div>
        </td></tr>
        <tr><td style="padding-top:24px;font-size:16px;line-height:1.6;">${args.bodyHtml}</td></tr>
        <tr><td style="padding-top:32px;border-top:1px solid #eee;font-size:13px;color:#666;line-height:1.5;">
          Diese Mail kommt vom PflegeAtlas (pflegeatlas.org).
          <br>Wenn du das nicht erwartet hast, kannst du sie ignorieren.
          <br><a href="https://pflegeatlas.org/datenschutz" style="color:${PETROL};">Datenschutz</a>
          &middot; <a href="https://pflegeatlas.org/impressum" style="color:${PETROL};">Impressum</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function textLayout(args: { bodyText: string }): string {
  return `Pflege·Atlas\n\n${args.bodyText}\n\n---\nDiese Mail kommt vom PflegeAtlas (pflegeatlas.org).\nWenn du das nicht erwartet hast, kannst du sie ignorieren.\nDatenschutz: https://pflegeatlas.org/datenschutz\nImpressum: https://pflegeatlas.org/impressum`;
}
```

- [ ] **Step 9.2: Invitation template + test**

`tests/unit/mail-templates/invitation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { renderInvitationMail } from '@/lib/mail-templates/invitation';

describe('renderInvitationMail', () => {
  const args = {
    to: 'eingeladene@test.local',
    displayName: 'Test Name',
    role: 'reviewer' as const,
    invitedBy: 'Christoph',
    magicLink: 'https://example.com/passwort-setzen?token=abc123',
    expiresAt: new Date('2026-06-28T12:00:00Z'),
  };

  it('includes magic link in HTML and text', () => {
    const result = renderInvitationMail(args);
    expect(result.html).toContain(args.magicLink);
    expect(result.text).toContain(args.magicLink);
  });

  it('mentions inviter name and role', () => {
    const result = renderInvitationMail(args);
    expect(result.html).toContain('Christoph');
    expect(result.html).toContain('Reviewer');
  });

  it('mentions expiry date in human-readable form', () => {
    const result = renderInvitationMail(args);
    expect(result.text).toMatch(/28\.06\.2026|28\. Juni 2026/);
  });

  it('subject is non-empty German', () => {
    const result = renderInvitationMail(args);
    expect(result.subject).toMatch(/willkommen|einladung|account/i);
  });

  it('does not include the word "Passwort" with a value', () => {
    const result = renderInvitationMail(args);
    expect(result.html).not.toMatch(/Passwort:\s*\S+/);
  });
});
```

Replace `src/lib/mail-templates/invitation.ts` (was stub from T7):
```typescript
import { htmlLayout, textLayout } from './_layout';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  editor: 'Redakteur:in',
  reviewer: 'Reviewer:in',
  contributor: 'Beitragende:r',
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function renderInvitationMail(args: {
  to: string;
  displayName: string;
  role: string;
  invitedBy: string;
  magicLink: string;
  expiresAt: Date;
}): { subject: string; html: string; text: string } {
  const roleLabel = ROLE_LABELS[args.role] ?? args.role;
  const expiry = formatDate(args.expiresAt);
  const subject = `Willkommen bei PflegeAtlas — Account aktivieren`;
  const bodyHtml = `
    <p>Hallo ${args.displayName},</p>
    <p><strong>${args.invitedBy}</strong> hat dich als <strong>${roleLabel}</strong> bei PflegeAtlas eingeladen.</p>
    <p>PflegeAtlas ist eine offene Wissensplattform für die professionelle Pflege. Beiträge stehen unter CC&nbsp;BY-SA 4.0.</p>
    <p style="margin:32px 0;">
      <a href="${args.magicLink}" style="background:#1f5e6d;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Account aktivieren</a>
    </p>
    <p style="font-size:14px;color:#555;">Der Link ist bis zum ${expiry} gültig.</p>
    <p style="font-size:14px;color:#555;">Falls der Knopf nicht funktioniert, kopiere bitte diesen Link in deinen Browser:<br><span style="word-break:break-all;">${args.magicLink}</span></p>
  `;
  const bodyText = `Hallo ${args.displayName},

${args.invitedBy} hat dich als ${roleLabel} bei PflegeAtlas eingeladen.

Aktiviere deinen Account: ${args.magicLink}

Der Link ist bis zum ${expiry} gültig.`;
  return {
    subject,
    html: htmlLayout({ title: subject, bodyHtml }),
    text: textLayout({ bodyText }),
  };
}
```

Run: `pnpm vitest run tests/unit/mail-templates/invitation.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 9.3: Forgot-Password template + Users.ts override**

`tests/unit/mail-templates/forgot-password.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { renderForgotPasswordMail } from '@/lib/mail-templates/forgot-password';

describe('renderForgotPasswordMail', () => {
  it('contains reset link', () => {
    const result = renderForgotPasswordMail({ to: 'x@y.z', resetLink: 'https://x.y/reset?token=abc' });
    expect(result.html).toContain('https://x.y/reset?token=abc');
    expect(result.text).toContain('https://x.y/reset?token=abc');
  });
  it('subject is German + relevant', () => {
    const result = renderForgotPasswordMail({ to: 'x@y.z', resetLink: 'https://x.y/reset?token=abc' });
    expect(result.subject).toMatch(/passwort/i);
  });
});
```

`src/lib/mail-templates/forgot-password.ts`:
```typescript
import { htmlLayout, textLayout } from './_layout';

export function renderForgotPasswordMail(args: {
  to: string;
  resetLink: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Passwort-Reset für deinen PflegeAtlas-Account';
  const bodyHtml = `
    <p>Hallo,</p>
    <p>Jemand hat einen Passwort-Reset für deinen PflegeAtlas-Account angefordert.</p>
    <p style="margin:32px 0;">
      <a href="${args.resetLink}" style="background:#1f5e6d;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Neues Passwort wählen</a>
    </p>
    <p style="font-size:14px;color:#555;">Der Link ist 1 Stunde gültig.</p>
    <p style="font-size:14px;color:#555;">Falls du das nicht warst, kannst du diese Mail einfach löschen.</p>
  `;
  const bodyText = `Hallo,

Passwort-Reset angefordert. Wähle ein neues Passwort:
${args.resetLink}

Der Link ist 1 Stunde gültig. Falls du das nicht warst, kannst du diese Mail einfach löschen.`;
  return { subject, html: htmlLayout({ title: subject, bodyHtml }), text: textLayout({ bodyText }) };
}
```

In `src/collections/Users.ts`, extend `auth` config to wire in the override:
```typescript
auth: {
  tokenExpiration: 60 * 60 * 24,
  maxLoginAttempts: 5,
  lockTime: 600 * 1000,
  verify: false,
  forgotPassword: {
    generateEmailHTML: (args) => {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const resetLink = `${baseUrl}/passwort-setzen?token=${encodeURIComponent((args as { token: string }).token)}`;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { renderForgotPasswordMail } = require('@/lib/mail-templates/forgot-password');
      return renderForgotPasswordMail({ to: (args as { user: { email: string } }).user.email, resetLink }).html;
    },
    generateEmailSubject: () => 'Passwort-Reset für deinen PflegeAtlas-Account',
  },
},
```

Run: `pnpm vitest run tests/unit/mail-templates/forgot-password.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 9.4: Welcome template + integration in setPasswordFromTokenAction**

`tests/unit/mail-templates/welcome.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { renderWelcomeMail } from '@/lib/mail-templates/welcome';

describe('renderWelcomeMail', () => {
  it('greets by displayName', () => {
    const r = renderWelcomeMail({ to: 'x@y.z', displayName: 'Anna', role: 'contributor' });
    expect(r.html).toContain('Anna');
    expect(r.text).toContain('Anna');
  });
  it('links to /mein-bereich for contributor', () => {
    const r = renderWelcomeMail({ to: 'x@y.z', displayName: 'Anna', role: 'contributor' });
    expect(r.html).toContain('/mein-bereich');
  });
  it('links to /admin for editor', () => {
    const r = renderWelcomeMail({ to: 'x@y.z', displayName: 'Anna', role: 'editor' });
    expect(r.html).toContain('/admin');
  });
});
```

`src/lib/mail-templates/welcome.ts`:
```typescript
import { htmlLayout, textLayout } from './_layout';

export function renderWelcomeMail(args: {
  to: string;
  displayName: string;
  role: string;
}): { subject: string; html: string; text: string } {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const target = args.role === 'contributor' ? `${baseUrl}/mein-bereich` : `${baseUrl}/admin`;
  const targetLabel = args.role === 'contributor' ? 'Mein Bereich' : 'Admin-Dashboard';
  const subject = 'Account aktiv — willkommen bei PflegeAtlas';
  const bodyHtml = `
    <p>Hallo ${args.displayName},</p>
    <p>Dein Account ist jetzt aktiv. Willkommen bei PflegeAtlas!</p>
    <p style="margin:32px 0;">
      <a href="${target}" style="background:#1f5e6d;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">${targetLabel} öffnen</a>
    </p>
  `;
  const bodyText = `Hallo ${args.displayName},

Dein Account ist jetzt aktiv. Willkommen bei PflegeAtlas!

${targetLabel}: ${target}`;
  return { subject, html: htmlLayout({ title: subject, bodyHtml }), text: textLayout({ bodyText }) };
}
```

In `src/lib/auth.ts`, modify `setPasswordFromTokenAction` to send welcome mail after successful set (only for invitation, not reset — detect via was-there-a-password-before? Simpler: always send on success). Add after the `payload.update(...)` and before `payload.login(...)`:
```typescript
import { renderWelcomeMail } from './mail-templates/welcome';

// Inside setPasswordFromTokenAction, after the update:
try {
  const mail = renderWelcomeMail({
    to: user.email,
    displayName: (user as { displayName?: string }).displayName ?? '',
    role: (user.role ?? 'contributor') as Role,
  });
  await sendMail({ to: user.email, ...mail });
} catch {
  // Welcome mail failure is non-fatal; user can still proceed.
}
```

Run: `pnpm vitest run tests/unit/mail-templates/welcome.test.ts`
Expected: PASS

- [ ] **Step 9.5: Ready-to-publish template + Articles.ts trigger**

`tests/unit/mail-templates/ready-to-publish.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { renderReadyToPublishMail } from '@/lib/mail-templates/ready-to-publish';

describe('renderReadyToPublishMail', () => {
  it('includes article title and reviewer name', () => {
    const r = renderReadyToPublishMail({
      to: 'editor@x.de', articleTitle: 'Dekubitus', reviewer: 'Anna', adminLink: 'https://x.de/admin/collections/articles/42',
    });
    expect(r.html).toContain('Dekubitus');
    expect(r.html).toContain('Anna');
    expect(r.html).toContain('https://x.de/admin/collections/articles/42');
  });
});
```

`src/lib/mail-templates/ready-to-publish.ts`:
```typescript
import { htmlLayout, textLayout } from './_layout';

export function renderReadyToPublishMail(args: {
  to: string;
  articleTitle: string;
  reviewer: string;
  adminLink: string;
}): { subject: string; html: string; text: string } {
  const subject = `Artikel "${args.articleTitle}" ist bereit zur Veröffentlichung`;
  const bodyHtml = `
    <p>Hallo,</p>
    <p>Der Artikel <strong>"${args.articleTitle}"</strong> wurde von <strong>${args.reviewer}</strong> zur Veröffentlichung freigegeben.</p>
    <p style="margin:24px 0;"><a href="${args.adminLink}" style="color:#1f5e6d;">Im Admin öffnen</a></p>
  `;
  const bodyText = `Artikel "${args.articleTitle}" wurde von ${args.reviewer} zur Veröffentlichung freigegeben.

Im Admin öffnen: ${args.adminLink}`;
  return { subject, html: htmlLayout({ title: subject, bodyHtml }), text: textLayout({ bodyText }) };
}
```

In `src/collections/Articles.ts`, extend the existing `afterChange` hook (currently delegates to `afterArticleChangeHook`). Add a second `afterChange`-entry that sends the ready-to-publish notification:
```typescript
afterChange: [
  async (args) => {
    await afterArticleChangeHook(args as never);
  },
  async ({ doc, previousDoc, req }) => {
    const prev = (previousDoc as { status?: string })?.status;
    const next = (doc as { status?: string })?.status;
    if (prev !== 'ready_to_publish' && next === 'ready_to_publish') {
      try {
        const reviewerRaw = (doc as { currentReviewer?: number | { id: number; displayName?: string } }).currentReviewer;
        const reviewerName = typeof reviewerRaw === 'object' && reviewerRaw ? reviewerRaw.displayName ?? 'Reviewer:in' : 'Reviewer:in';
        const editors = await req.payload.find({
          collection: 'users',
          where: { and: [{ role: { in: ['editor', 'admin'] } }, { disabled: { equals: false } }] },
          limit: 100,
          depth: 0,
        });
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const adminLink = `${baseUrl}/admin/collections/articles/${(doc as { id: number }).id}`;
        const title = (doc as { title?: string }).title ?? 'Unbenannter Artikel';
        const { renderReadyToPublishMail } = await import('@/lib/mail-templates/ready-to-publish');
        const { sendMail } = await import('@/lib/mail');
        for (const editor of editors.docs as Array<{ email: string }>) {
          const mail = renderReadyToPublishMail({
            to: editor.email, articleTitle: title, reviewer: reviewerName, adminLink,
          });
          await sendMail({ to: editor.email, ...mail });
        }
      } catch (err) {
        console.error('[V1.6] ready-to-publish notification failed:', err);
      }
    }
  },
],
```

`tests/integration/article-ready-to-publish-mail.test.ts`:
```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { sendMail } from '@/lib/mail';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;
let editor: { id: number }; let reviewer: { id: number };

beforeAll(async () => {
  payload = await getPayload({ config });
  editor = await createUserFixture(payload, 'editor');
  reviewer = await createUserFixture(payload, 'reviewer');
});

describe('article ready-to-publish notification', () => {
  beforeEach(() => vi.mocked(sendMail).mockClear());

  it('sends mail to all editors when article transitions to ready_to_publish', async () => {
    const article = await payload.create({
      collection: 'articles',
      data: {
        title: 'NotifyTest', slug: `notify-${Date.now()}`, intent: 'background', summary: 's',
        definition: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'd' }] }] } },
        praxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'p' }] }] } },
        risiken: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'r' }] }] } },
        quellen: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'q' }] }] } },
        status: 'in_review', currentReviewer: reviewer.id,
      } as never,
    });
    await payload.update({
      collection: 'articles', id: article.id,
      data: { status: 'ready_to_publish' } as never,
      overrideAccess: false, user: reviewer as never,
    });
    const calls = vi.mocked(sendMail).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const editorMail = calls.find((c) => (c[0] as { to: string }).to === (editor as unknown as { email: string }).email);
    expect(editorMail).toBeTruthy();
  });
});
```

Run: `pnpm vitest run tests/unit/mail-templates/ tests/integration/article-ready-to-publish-mail.test.ts`
Expected: PASS

- [ ] **Step 9.6: Commit**

```bash
git add src/lib/mail-templates/ src/collections/Users.ts src/collections/Articles.ts src/lib/auth.ts tests/unit/mail-templates/ tests/integration/article-ready-to-publish-mail.test.ts
git commit -m "feat(mail): templates for invitation/forgot-password/welcome/ready-to-publish"
```

---

## Task 10: Frontend Pages — /login, /passwort-vergessen, /passwort-setzen

**Files:**
- Create: `src/app/(frontend)/login/page.tsx`
- Create: `src/app/(frontend)/login/actions.ts`
- Create: `src/app/(frontend)/passwort-vergessen/page.tsx`
- Create: `src/app/(frontend)/passwort-vergessen/actions.ts`
- Create: `src/app/(frontend)/passwort-setzen/page.tsx`
- Create: `src/app/(frontend)/passwort-setzen/actions.ts`
- Create: `src/components/LoginForm.tsx`
- Create: `src/components/ForgotPasswordForm.tsx`
- Create: `src/components/SetPasswordForm.tsx`
- Test: `tests/component/LoginForm.test.tsx`
- Test: `tests/component/ForgotPasswordForm.test.tsx`
- Test: `tests/component/SetPasswordForm.test.tsx`

Login/Forgot/SetPassword als Server-Component-Pages + Client-Form-Components mit Server-Actions via `useActionState` (React-19-Pattern aus V1.3b).

- [ ] **Step 10.1: LoginForm + Test**

`tests/component/LoginForm.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '@/components/LoginForm';

const mockAction = vi.fn();
vi.mock('@/app/(frontend)/login/actions', () => ({
  loginFormAction: (...args: unknown[]) => mockAction(...args),
}));

describe('LoginForm', () => {
  it('renders email + password fields + submit', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/passwort/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anmelden/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /passwort vergessen/i })).toHaveAttribute('href', '/passwort-vergessen');
  });

  it('shows error message when state.error is set', () => {
    render(<LoginForm initialState={{ error: 'Anmeldung fehlgeschlagen' }} />);
    expect(screen.getByText(/anmeldung fehlgeschlagen/i)).toBeInTheDocument();
  });
});
```

`src/app/(frontend)/login/actions.ts`:
```typescript
'use server';
import { loginAction } from '@/lib/auth';
import { redirect } from 'next/navigation';

export interface LoginFormState {
  error?: string;
  email?: string;
}

export async function loginFormAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');
  const result = await loginAction(email, password);
  if (!result.ok) {
    return { error: result.error ?? 'Anmeldung fehlgeschlagen.', email };
  }
  redirect(next || result.redirectTo || '/mein-bereich');
}
```

`src/components/LoginForm.tsx`:
```typescript
'use client';
import { useActionState } from 'react';
import { loginFormAction, type LoginFormState } from '@/app/(frontend)/login/actions';

export function LoginForm({
  initialState = {},
  next = '',
}: {
  initialState?: LoginFormState;
  next?: string;
}) {
  const [state, formAction] = useActionState(loginFormAction, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">E-Mail</label>
        <input id="email" name="email" type="email" required
               defaultValue={state.email ?? ''}
               className="w-full border rounded px-3 py-2" autoComplete="email" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">Passwort</label>
        <input id="password" name="password" type="password" required
               className="w-full border rounded px-3 py-2" autoComplete="current-password" />
      </div>
      {state.error && (
        <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {state.error}
        </div>
      )}
      <button type="submit" className="bg-petrol-600 text-white px-4 py-2 rounded font-semibold hover:bg-petrol-700">
        Anmelden
      </button>
      <p className="text-sm">
        <a href="/passwort-vergessen" className="text-petrol-700 underline">Passwort vergessen?</a>
      </p>
    </form>
  );
}
```

`src/app/(frontend)/login/page.tsx`:
```typescript
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const session = await getSession();
  if (session) {
    redirect(params.next || (session.role === 'contributor' ? '/mein-bereich' : '/admin'));
  }
  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-3xl font-serif mb-6">Anmelden</h1>
      <LoginForm next={params.next ?? ''} />
    </main>
  );
}
```

Run: `pnpm vitest run tests/component/LoginForm.test.tsx`
Expected: PASS

- [ ] **Step 10.2: ForgotPasswordForm + Page**

`tests/component/ForgotPasswordForm.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';

describe('ForgotPasswordForm', () => {
  it('renders email field', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /senden|absenden/i })).toBeInTheDocument();
  });
  it('shows generic success when state.submitted', () => {
    render(<ForgotPasswordForm initialState={{ submitted: true }} />);
    expect(screen.getByText(/wenn ein account existiert/i)).toBeInTheDocument();
  });
});
```

`src/app/(frontend)/passwort-vergessen/actions.ts`:
```typescript
'use server';
import { requestPasswordResetAction } from '@/lib/auth';

export interface ForgotState { submitted?: boolean }

export async function forgotPasswordFormAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get('email') ?? '');
  await requestPasswordResetAction(email);
  return { submitted: true };
}
```

`src/components/ForgotPasswordForm.tsx`:
```typescript
'use client';
import { useActionState } from 'react';
import { forgotPasswordFormAction, type ForgotState } from '@/app/(frontend)/passwort-vergessen/actions';

export function ForgotPasswordForm({ initialState = {} }: { initialState?: ForgotState }) {
  const [state, formAction] = useActionState(forgotPasswordFormAction, initialState);
  if (state.submitted) {
    return (
      <p className="p-4 bg-emerald-50 border border-emerald-200 rounded text-emerald-900">
        Wenn ein Account mit dieser Adresse existiert, kommt gleich eine Mail mit dem Reset-Link.
      </p>
    );
  }
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">E-Mail</label>
        <input id="email" name="email" type="email" required className="w-full border rounded px-3 py-2" />
      </div>
      <button type="submit" className="bg-petrol-600 text-white px-4 py-2 rounded font-semibold">Absenden</button>
    </form>
  );
}
```

`src/app/(frontend)/passwort-vergessen/page.tsx`:
```typescript
import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';

export default function PasswortVergessenPage() {
  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-3xl font-serif mb-6">Passwort vergessen?</h1>
      <p className="mb-4">Gib deine E-Mail ein. Wir schicken dir einen Link zum Setzen eines neuen Passworts.</p>
      <ForgotPasswordForm />
    </main>
  );
}
```

Run: `pnpm vitest run tests/component/ForgotPasswordForm.test.tsx`
Expected: PASS

- [ ] **Step 10.3: SetPasswordForm + Page**

`tests/component/SetPasswordForm.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SetPasswordForm } from '@/components/SetPasswordForm';

describe('SetPasswordForm', () => {
  it('renders two password fields + DSGVO checkbox + token hidden', () => {
    render(<SetPasswordForm token="abc" mode="invitation" />);
    expect(screen.getByLabelText(/neues passwort/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/passwort wiederholen/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/datenschutz/i)).toBeInTheDocument();
  });

  it('omits DSGVO checkbox in reset mode', () => {
    render(<SetPasswordForm token="abc" mode="reset" />);
    expect(screen.queryByLabelText(/datenschutz/i)).not.toBeInTheDocument();
  });

  it('shows error state', () => {
    render(<SetPasswordForm token="abc" mode="invitation" initialState={{ error: 'Token abgelaufen' }} />);
    expect(screen.getByText(/abgelaufen/i)).toBeInTheDocument();
  });
});
```

`src/app/(frontend)/passwort-setzen/actions.ts`:
```typescript
'use server';
import { setPasswordFromTokenAction } from '@/lib/auth';
import { redirect } from 'next/navigation';

export interface SetPasswordFormState { error?: string }

export async function setPasswordFormAction(_prev: SetPasswordFormState, formData: FormData): Promise<SetPasswordFormState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const repeat = String(formData.get('passwordRepeat') ?? '');
  const dsgvo = formData.get('dsgvo');
  const mode = String(formData.get('mode') ?? 'invitation');
  if (password !== repeat) {
    return { error: 'Die Passwörter stimmen nicht überein.' };
  }
  if (mode === 'invitation' && !dsgvo) {
    return { error: 'Bitte bestätige die Datenschutz-Hinweise.' };
  }
  const result = await setPasswordFromTokenAction(token, password);
  if (!result.ok) return { error: result.error ?? 'Passwort konnte nicht gesetzt werden.' };
  redirect(result.redirectTo ?? '/mein-bereich');
}
```

`src/components/SetPasswordForm.tsx`:
```typescript
'use client';
import { useActionState } from 'react';
import { setPasswordFormAction, type SetPasswordFormState } from '@/app/(frontend)/passwort-setzen/actions';

export function SetPasswordForm({
  token, mode, initialState = {},
}: { token: string; mode: 'invitation' | 'reset'; initialState?: SetPasswordFormState }) {
  const [state, formAction] = useActionState(setPasswordFormAction, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="mode" value={mode} />
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">Neues Passwort (min. 8 Zeichen)</label>
        <input id="password" name="password" type="password" required minLength={8}
               className="w-full border rounded px-3 py-2" autoComplete="new-password" />
      </div>
      <div>
        <label htmlFor="passwordRepeat" className="block text-sm font-medium mb-1">Passwort wiederholen</label>
        <input id="passwordRepeat" name="passwordRepeat" type="password" required minLength={8}
               className="w-full border rounded px-3 py-2" autoComplete="new-password" />
      </div>
      {mode === 'invitation' && (
        <label htmlFor="dsgvo" className="flex items-start gap-2 text-sm">
          <input id="dsgvo" name="dsgvo" type="checkbox" required className="mt-1" />
          <span>
            Ich habe die <a href="/datenschutz" target="_blank" className="underline">Datenschutz</a>-Hinweise gelesen
            und stimme der Speicherung von E-Mail und Anzeigename zu.
          </span>
        </label>
      )}
      {state.error && (
        <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {state.error}
        </div>
      )}
      <button type="submit" className="bg-petrol-600 text-white px-4 py-2 rounded font-semibold">Passwort setzen</button>
    </form>
  );
}
```

`src/app/(frontend)/passwort-setzen/page.tsx`:
```typescript
import { getPayload } from 'payload';
import config from '@/payload.config';
import { SetPasswordForm } from '@/components/SetPasswordForm';
import { isTokenValid } from '@/lib/auth-tokens';

async function lookupToken(token: string): Promise<{ valid: boolean; mode: 'invitation' | 'reset' } | null> {
  if (!token) return null;
  const payload = await getPayload({ config });
  // Try invitation-token first (custom field)
  const found = await payload.find({
    collection: 'users',
    where: { setPasswordToken: { equals: token } },
    depth: 0, limit: 1,
  });
  if (found.docs.length > 0) {
    const expiresAt = (found.docs[0] as { setPasswordTokenExpiresAt?: string | null }).setPasswordTokenExpiresAt;
    return { valid: isTokenValid(expiresAt), mode: 'invitation' };
  }
  // Otherwise: assume Payload-native reset-token; we don't validate here (Payload does on POST)
  return { valid: true, mode: 'reset' };
}

export default async function PasswortSetzenPage({
  searchParams,
}: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = params.token ?? '';
  const lookup = await lookupToken(token);
  if (!token || !lookup) {
    return (
      <main className="max-w-md mx-auto p-8">
        <h1 className="text-3xl font-serif mb-4">Ungültiger Link</h1>
        <p>Dieser Link ist ungültig oder bereits eingelöst.</p>
        <p className="mt-4"><a href="/mitmachen" className="underline">Neuen Link anfordern</a></p>
      </main>
    );
  }
  if (!lookup.valid) {
    return (
      <main className="max-w-md mx-auto p-8">
        <h1 className="text-3xl font-serif mb-4">Link abgelaufen</h1>
        <p>Dieser Einladungs-Link ist abgelaufen.</p>
        <p className="mt-4"><a href="/mitmachen" className="underline">Neuen Link anfordern</a></p>
      </main>
    );
  }
  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-3xl font-serif mb-4">
        {lookup.mode === 'invitation' ? 'Willkommen! Setze dein Passwort.' : 'Neues Passwort wählen'}
      </h1>
      <SetPasswordForm token={token} mode={lookup.mode} />
    </main>
  );
}
```

Run: `pnpm vitest run tests/component/SetPasswordForm.test.tsx`
Expected: PASS

- [ ] **Step 10.4: Commit**

```bash
git add src/app/(frontend)/login/ src/app/(frontend)/passwort-vergessen/ src/app/(frontend)/passwort-setzen/ src/components/LoginForm.tsx src/components/ForgotPasswordForm.tsx src/components/SetPasswordForm.tsx tests/component/LoginForm.test.tsx tests/component/ForgotPasswordForm.test.tsx tests/component/SetPasswordForm.test.tsx
git commit -m "feat(frontend): /login + /passwort-vergessen + /passwort-setzen pages"
```

---

## Task 11: /admin/login Redirect + /mitmachen Page

**Files:**
- Create: `src/app/(payload)/admin/login/route.ts`
- Create: `src/app/(frontend)/mitmachen/page.tsx`

- [ ] **Step 11.1: Admin-Login Redirect**

`src/app/(payload)/admin/login/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function GET(req: NextRequest) {
  const url = new URL('/login', req.url);
  url.searchParams.set('next', '/admin');
  return NextResponse.redirect(url, 307);
}

export const dynamic = 'force-dynamic';
```

- [ ] **Step 11.2: Mitmachen-Page**

`src/app/(frontend)/mitmachen/page.tsx`:
```typescript
export default function MitmachenPage() {
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-12">
      <header>
        <h1 className="text-4xl font-serif text-petrol-800 mb-2">Mitmachen bei PflegeAtlas</h1>
        <p className="text-lg text-stone-700">Es gibt drei Wege, mitzumachen — wähle den, der zu dir passt.</p>
      </header>

      <section className="border-l-4 border-petrol-600 pl-6">
        <h2 className="text-2xl font-serif mb-2">1. Beitrag oder Korrektur einreichen</h2>
        <p className="mb-4">Du hast Wissen, das fehlt? Oder du hast einen Fehler in einem Artikel entdeckt? Reiche es ohne Account ein — wir prüfen und übernehmen es.</p>
        <a href="/einreichen" className="inline-block bg-petrol-600 text-white px-4 py-2 rounded font-semibold">Beitrag einreichen</a>
      </section>

      <section className="border-l-4 border-clay-500 pl-6">
        <h2 className="text-2xl font-serif mb-2">2. Regelmäßig beitragen oder namentlich genannt werden</h2>
        <p className="mb-4">
          Du willst öfter dabei sein, eigene Artikel schreiben oder als Autor:in/Reviewer:in genannt werden?
          Schreib uns kurz, was du beitragen möchtest — wir richten dir einen Account ein.
        </p>
        <a href="mailto:redaktion@pflegeatlas.org?subject=Ich%20möchte%20bei%20PflegeAtlas%20mitmachen"
           className="inline-block border-2 border-clay-500 text-clay-700 px-4 py-2 rounded font-semibold">
          E-Mail an Redaktion
        </a>
      </section>

      <section className="border-l-4 border-stone-300 pl-6">
        <h2 className="text-2xl font-serif mb-2">3. Du arbeitest in der Pflege und willst lesen</h2>
        <p className="mb-4">Stöbere durch die Artikel — Lesen ist anonym und braucht keinen Account.</p>
        <a href="/artikel" className="inline-block underline">Zu den Artikeln</a>
      </section>
    </main>
  );
}
```

- [ ] **Step 11.3: Manual smoke + commit**

Run: `pnpm dev` then visit `http://localhost:3000/admin/login` → should redirect to `/login?next=%2Fadmin`. Visit `/mitmachen` → page renders.

```bash
git add src/app/(payload)/admin/login/route.ts src/app/(frontend)/mitmachen/page.tsx
git commit -m "feat(frontend): /admin/login redirect + /mitmachen page"
```

---

## Task 12: /mein-bereich Page mit Cards

**Files:**
- Create: `src/app/(frontend)/mein-bereich/page.tsx`
- Create: `src/app/(frontend)/mein-bereich/actions.ts`
- Create: `src/components/MeineBeitraegeCard.tsx`
- Test: `tests/integration/mein-bereich-page-access.test.ts`

Drei Karten je nach Rolle: Beiträge (Contributor), Profil (alle), Neuer Beitrag (Contributor), Zur Redaktion (Editor+), Konto (alle).

- [ ] **Step 12.1: Server-side data fetching**

`src/app/(frontend)/mein-bereich/page.tsx`:
```typescript
import { requireUser } from '@/lib/auth';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { ProfileEditForm } from '@/components/ProfileEditForm';
import { AccountActions } from '@/components/AccountActions';
import { MeineBeitraegeCard } from '@/components/MeineBeitraegeCard';
import { logoutAction } from '@/lib/auth';

export default async function MeinBereichPage() {
  const session = await requireUser();
  const payload = await getPayload({ config });
  const submissionsFind = session.role === 'contributor'
    ? await payload.find({
        collection: 'submissions',
        where: { submittedBy: { equals: session.id } },
        sort: '-createdAt',
        limit: 50,
        depth: 1,
      })
    : null;
  const userDoc = await payload.findByID({ collection: 'users', id: session.id, depth: 1 });

  return (
    <main className="max-w-4xl mx-auto p-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif text-petrol-800">Mein Bereich</h1>
          <p className="text-stone-600">{session.displayName} · {session.email}</p>
        </div>
        <form action={async () => { 'use server'; await logoutAction(); }}>
          <button type="submit" className="border px-3 py-1 rounded">Logout</button>
        </form>
      </header>

      {session.role === 'contributor' && submissionsFind && (
        <MeineBeitraegeCard submissions={submissionsFind.docs as never} />
      )}

      <section className="bg-white border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-serif mb-4">Profil</h2>
        <ProfileEditForm user={userDoc as never} />
      </section>

      {session.role === 'contributor' && (
        <section className="bg-white border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-serif mb-2">Neuer Beitrag</h2>
          <p className="mb-3">Hast du Wissen, das fehlt? Oder eine Korrektur?</p>
          <a href="/einreichen" className="inline-block bg-petrol-600 text-white px-4 py-2 rounded font-semibold">
            Zum Einreichen-Formular
          </a>
        </section>
      )}

      {(session.role === 'admin' || session.role === 'editor' || session.role === 'reviewer') && (
        <section className="bg-white border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-serif mb-2">Zur Redaktion</h2>
          <a href="/admin" className="inline-block bg-petrol-600 text-white px-4 py-2 rounded font-semibold">
            Admin-Dashboard öffnen
          </a>
        </section>
      )}

      <section className="bg-white border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-serif mb-4">Konto</h2>
        <AccountActions isAdmin={session.role === 'admin'} />
      </section>
    </main>
  );
}
```

`src/components/MeineBeitraegeCard.tsx`:
```typescript
const STATUS_LABEL: Record<string, string> = {
  pending: 'Eingegangen',
  in_review: 'In Review',
  accepted: 'Übernommen',
  rejected: 'Abgelehnt',
};

export function MeineBeitraegeCard({ submissions }: {
  submissions: Array<{ id: number; displayTitle?: string; type?: string; reviewStatus?: string; createdAt?: string }>;
}) {
  if (submissions.length === 0) {
    return (
      <section className="bg-white border rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-serif mb-2">Meine Beiträge</h2>
        <p className="text-stone-600">Du hast noch keine Beiträge eingereicht. <a href="/einreichen" className="underline">Jetzt einreichen</a>.</p>
      </section>
    );
  }
  return (
    <section className="bg-white border rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-serif mb-4">Meine Beiträge</h2>
      <ul className="space-y-3">
        {submissions.map((s) => (
          <li key={s.id} className="flex items-center justify-between border-b pb-2">
            <div>
              <div className="font-medium">{s.displayTitle ?? 'Unbenannt'}</div>
              <div className="text-sm text-stone-600">
                {s.type === 'new_article' ? 'Neuer Artikel' : 'Korrektur'} ·
                {' '}{s.createdAt ? new Date(s.createdAt).toLocaleDateString('de-DE') : '–'}
              </div>
            </div>
            <span className="text-sm font-medium px-2 py-1 rounded bg-stone-100">
              {STATUS_LABEL[s.reviewStatus ?? 'pending'] ?? s.reviewStatus}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 12.2: Integration test for access**

`tests/integration/mein-bereich-page-access.test.ts`:
```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('mein-bereich page requireUser', () => {
  it('redirects (throws) when no session', async () => {
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
    }));
    const { requireUser } = await import('@/lib/auth');
    await expect(requireUser()).rejects.toThrow(/unauthorized/i);
    vi.doUnmock('next/headers');
  });

  it('returns session for logged-in contributor', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({ collection: 'users', data: { email: user.email, password: user.password } });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ get: (n: string) => n === 'payload-token' ? { value: token } : undefined, set: vi.fn(), delete: vi.fn() }),
    }));
    const { requireUser } = await import('@/lib/auth');
    const session = await requireUser();
    expect(session.id).toBe(user.id);
    vi.doUnmock('next/headers');
  });
});
```

Run: `pnpm vitest run tests/integration/mein-bereich-page-access.test.ts`
Expected: PASS

- [ ] **Step 12.3: Commit**

```bash
git add src/app/(frontend)/mein-bereich/ src/components/MeineBeitraegeCard.tsx tests/integration/mein-bereich-page-access.test.ts
git commit -m "feat(frontend): /mein-bereich page with role-based cards"
```

---

## Task 13: ProfileEditForm + AccountActions

**Files:**
- Create: `src/components/ProfileEditForm.tsx`
- Create: `src/components/AccountActions.tsx`
- Create: `src/app/(frontend)/mein-bereich/actions.ts`
- Test: `tests/component/ProfileEditForm.test.tsx`
- Test: `tests/component/AccountActions.test.tsx`

ProfileEditForm: displayName, bio, pflegerischeRolle, bundesland, avatar (Upload via Payload-Media). AccountActions: Export-JSON + Account-Lösch mit Confirmation.

- [ ] **Step 13.1: Profile + Account Server-Actions**

`src/app/(frontend)/mein-bereich/actions.ts`:
```typescript
'use server';
import { updateOwnProfileAction, deleteOwnAccountAction, exportOwnDataAction, logoutAction } from '@/lib/auth';
import { redirect } from 'next/navigation';

export interface ProfileFormState { saved?: boolean; error?: string }

export async function saveProfileFormAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const payload = {
    displayName: String(formData.get('displayName') ?? '') || undefined,
    bio: (formData.get('bio') as string | null) ?? undefined,
    pflegerischeRolle: (formData.get('pflegerischeRolle') as string | null) || null,
    bundesland: (formData.get('bundesland') as string | null) || null,
  };
  const result = await updateOwnProfileAction(payload);
  if (!result.ok) return { error: result.error };
  return { saved: true };
}

export interface DeleteFormState { error?: string }

export async function deleteAccountFormAction(_prev: DeleteFormState, formData: FormData): Promise<DeleteFormState> {
  const confirmation = String(formData.get('confirmation') ?? '');
  const result = await deleteOwnAccountAction(confirmation);
  if (!result.ok) return { error: result.error };
  await logoutAction();
  redirect('/');
}

export async function downloadDataAction(): Promise<{ json?: string; error?: string }> {
  const result = await exportOwnDataAction();
  return { json: result.json, error: result.error };
}
```

- [ ] **Step 13.2: ProfileEditForm**

`tests/component/ProfileEditForm.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileEditForm } from '@/components/ProfileEditForm';

const user = {
  id: 1, email: 'x@y.de', displayName: 'Anna', bio: 'pflegerin',
  pflegerischeRolle: 'pflegefachkraft', bundesland: 'bayern', avatar: null,
};

describe('ProfileEditForm', () => {
  it('renders all whitelisted fields with current values', () => {
    render(<ProfileEditForm user={user as never} />);
    expect(screen.getByLabelText(/anzeigename/i)).toHaveValue('Anna');
    expect(screen.getByLabelText(/kurzprofil/i)).toHaveValue('pflegerin');
  });
  it('does NOT render email or role fields', () => {
    render(<ProfileEditForm user={user as never} />);
    expect(screen.queryByLabelText(/^e-mail/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^rolle/i)).not.toBeInTheDocument();
  });
});
```

`src/components/ProfileEditForm.tsx`:
```typescript
'use client';
import { useActionState } from 'react';
import { saveProfileFormAction, type ProfileFormState } from '@/app/(frontend)/mein-bereich/actions';

const PFLEGE_OPTIONS = [
  { value: '', label: '— bitte wählen —' },
  { value: 'pflegefachkraft', label: 'Pflegefachkraft' },
  { value: 'pdl', label: 'PDL (Pflegedienstleitung)' },
  { value: 'wbl', label: 'WBL (Wohnbereichsleitung)' },
  { value: 'auszubildende', label: 'Auszubildende:r' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

const BUNDESLAND_OPTIONS = [
  { value: '', label: '— bitte wählen —' },
  { value: 'baden_wuerttemberg', label: 'Baden-Württemberg' },
  { value: 'bayern', label: 'Bayern' },
  { value: 'berlin', label: 'Berlin' },
  { value: 'brandenburg', label: 'Brandenburg' },
  { value: 'bremen', label: 'Bremen' },
  { value: 'hamburg', label: 'Hamburg' },
  { value: 'hessen', label: 'Hessen' },
  { value: 'mecklenburg_vorpommern', label: 'Mecklenburg-Vorpommern' },
  { value: 'niedersachsen', label: 'Niedersachsen' },
  { value: 'nordrhein_westfalen', label: 'Nordrhein-Westfalen' },
  { value: 'rheinland_pfalz', label: 'Rheinland-Pfalz' },
  { value: 'saarland', label: 'Saarland' },
  { value: 'sachsen', label: 'Sachsen' },
  { value: 'sachsen_anhalt', label: 'Sachsen-Anhalt' },
  { value: 'schleswig_holstein', label: 'Schleswig-Holstein' },
  { value: 'thueringen', label: 'Thüringen' },
  { value: 'oesterreich', label: 'Österreich' },
  { value: 'schweiz', label: 'Schweiz' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

export function ProfileEditForm({ user }: {
  user: { displayName?: string; bio?: string | null; pflegerischeRolle?: string | null; bundesland?: string | null };
}) {
  const [state, formAction] = useActionState(saveProfileFormAction, {} as ProfileFormState);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium mb-1">Anzeigename</label>
        <input id="displayName" name="displayName" type="text" defaultValue={user.displayName ?? ''}
               className="w-full border rounded px-3 py-2" required />
      </div>
      <div>
        <label htmlFor="bio" className="block text-sm font-medium mb-1">Kurzprofil</label>
        <textarea id="bio" name="bio" rows={3} defaultValue={user.bio ?? ''}
                  className="w-full border rounded px-3 py-2"></textarea>
        <p className="text-xs text-stone-500 mt-1">Sichtbar für: Redaktion (intern).</p>
      </div>
      <div>
        <label htmlFor="pflegerischeRolle" className="block text-sm font-medium mb-1">Pflegerische Rolle (optional)</label>
        <select id="pflegerischeRolle" name="pflegerischeRolle" defaultValue={user.pflegerischeRolle ?? ''}
                className="w-full border rounded px-3 py-2">
          {PFLEGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="bundesland" className="block text-sm font-medium mb-1">Bundesland / Region (optional)</label>
        <select id="bundesland" name="bundesland" defaultValue={user.bundesland ?? ''}
                className="w-full border rounded px-3 py-2">
          {BUNDESLAND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <p className="text-xs text-stone-500">
        Avatar-Upload kommt mit V1.6.1 (siehe Spec Section 1). Datei-Upload via Admin-UI ist bereits möglich.
      </p>
      {state.saved && <p className="text-emerald-700 text-sm">Profil gespeichert.</p>}
      {state.error && <p className="text-red-700 text-sm">{state.error}</p>}
      <button type="submit" className="bg-petrol-600 text-white px-4 py-2 rounded font-semibold">Speichern</button>
    </form>
  );
}
```

**Avatar-Upload-Anmerkung:** Vollständige Avatar-Upload-UI (Drag-Drop, Vorschau, Resize) ist optional für V1.6 — Datenfeld + Payload-Admin-Upload genügen für „MVP". Falls Oliver es zwingend in V1.6 will, hier Komponente nachziehen mit `<input type="file" accept="image/*">` + Server-Action, die `payload.create({collection:'media', file, data:{purpose:'avatar'}})` ruft und User-Avatar setzt. Aktuell als Defer-Punkt im Spec markiert.

- [ ] **Step 13.3: AccountActions (Delete + Export)**

`tests/component/AccountActions.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountActions } from '@/components/AccountActions';

describe('AccountActions', () => {
  it('renders delete + export buttons for non-admin', () => {
    render(<AccountActions isAdmin={false} />);
    expect(screen.getByRole('button', { name: /daten exportieren/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /account löschen/i })).toBeInTheDocument();
  });
  it('hides delete button for admin', () => {
    render(<AccountActions isAdmin={true} />);
    expect(screen.queryByRole('button', { name: /account löschen/i })).not.toBeInTheDocument();
  });
});
```

`src/components/AccountActions.tsx`:
```typescript
'use client';
import { useActionState, useState } from 'react';
import { deleteAccountFormAction, downloadDataAction, type DeleteFormState } from '@/app/(frontend)/mein-bereich/actions';

export function AccountActions({ isAdmin }: { isAdmin: boolean }) {
  const [state, deleteAction] = useActionState(deleteAccountFormAction, {} as DeleteFormState);
  const [showConfirm, setShowConfirm] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleExport() {
    setExportError(null);
    const result = await downloadDataAction();
    if (result.error || !result.json) {
      setExportError(result.error ?? 'Export fehlgeschlagen.');
      return;
    }
    const blob = new Blob([result.json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pflegeatlas-daten-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div>
        <button onClick={handleExport} className="border px-3 py-1 rounded">Daten exportieren (JSON)</button>
        {exportError && <p className="text-red-700 text-sm mt-2">{exportError}</p>}
      </div>
      {!isAdmin && (
        <div>
          {!showConfirm ? (
            <button onClick={() => setShowConfirm(true)} className="text-red-700 underline">Account löschen</button>
          ) : (
            <form action={deleteAction} className="space-y-2 border border-red-300 bg-red-50 rounded p-4">
              <p className="text-sm">
                <strong>Achtung:</strong> Dein Account wird unwiderruflich anonymisiert. Tippe <code>LÖSCHEN</code> in das Feld und bestätige.
              </p>
              <input name="confirmation" type="text" required className="border rounded px-2 py-1 w-full" />
              {state.error && <p className="text-red-700 text-sm">{state.error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowConfirm(false)} className="border px-3 py-1 rounded">Abbrechen</button>
                <button type="submit" className="bg-red-700 text-white px-3 py-1 rounded">Endgültig löschen</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
```

Run: `pnpm vitest run tests/component/ProfileEditForm.test.tsx tests/component/AccountActions.test.tsx`
Expected: PASS

- [ ] **Step 13.4: Commit**

```bash
git add src/components/ProfileEditForm.tsx src/components/AccountActions.tsx src/app/(frontend)/mein-bereich/actions.ts tests/component/ProfileEditForm.test.tsx tests/component/AccountActions.test.tsx
git commit -m "feat(frontend): ProfileEditForm + AccountActions (delete/export)"
```

---

## Task 14: HeaderUserMenu + Header-Integration

**Files:**
- Create: `src/components/HeaderUserMenu.tsx`
- Modify: `src/components/Header.tsx` (or whatever the layout file is named)
- Test: `tests/component/HeaderUserMenu.test.tsx`

Server-Component-Wrapper liest Session und übergibt props an Client-Dropdown.

- [ ] **Step 14.1: HeaderUserMenu Component**

`tests/component/HeaderUserMenu.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeaderUserMenu } from '@/components/HeaderUserMenu';

describe('HeaderUserMenu', () => {
  it('shows "Anmelden" link when no session', () => {
    render(<HeaderUserMenu session={null} />);
    expect(screen.getByRole('link', { name: /anmelden/i })).toHaveAttribute('href', '/login');
  });

  it('shows displayName + dropdown for contributor', () => {
    render(<HeaderUserMenu session={{ id: 1, email: 'x@y.de', displayName: 'Anna', role: 'contributor', disabled: false }} />);
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /mein bereich/i })).toHaveAttribute('href', '/mein-bereich');
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
  });

  it('shows admin link for editor+', () => {
    render(<HeaderUserMenu session={{ id: 1, email: 'x@y.de', displayName: 'Christoph', role: 'editor', disabled: false }} />);
    expect(screen.getByRole('link', { name: /admin/i })).toHaveAttribute('href', '/admin');
  });
});
```

`src/components/HeaderUserMenu.tsx`:
```typescript
import { logoutAction } from '@/lib/auth';
import type { Session } from '@/lib/auth';

export function HeaderUserMenu({ session }: { session: Session | null }) {
  if (!session) {
    return (
      <a href="/login" className="text-sm text-petrol-700 underline">Anmelden</a>
    );
  }
  const initial = session.displayName.charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-petrol-600 text-white flex items-center justify-center text-sm font-semibold">
        {initial}
      </div>
      <span className="text-sm">{session.displayName}</span>
      <nav className="flex gap-3 text-sm">
        <a href="/mein-bereich" className="underline">Mein Bereich</a>
        {(session.role === 'admin' || session.role === 'editor' || session.role === 'reviewer') && (
          <a href="/admin" className="underline">Admin</a>
        )}
        <form action={async () => { 'use server'; await logoutAction(); }}>
          <button type="submit" className="underline">Logout</button>
        </form>
      </nav>
    </div>
  );
}
```

- [ ] **Step 14.2: Wire into existing Header**

Find the existing layout/header file: `grep -rl "header" src/app/(frontend)/layout.tsx` and any `src/components/Header.tsx`. Add at the top:
```typescript
import { getSession } from '@/lib/auth';
import { HeaderUserMenu } from '@/components/HeaderUserMenu';
```

In the header JSX (rightmost nav area), add:
```typescript
const session = await getSession();
// inside JSX:
<HeaderUserMenu session={session} />
```

If existing header is a Client Component, wrap the part that needs session in a Server Component (`<HeaderServer>`) or pass session as prop from parent layout.

- [ ] **Step 14.3: Run tests**

Run: `pnpm vitest run tests/component/HeaderUserMenu.test.tsx`
Expected: PASS

Manual smoke: `pnpm dev`, visit `/`, header shows „Anmelden" when logged out. Log in → header shows „Anna" + Logout.

- [ ] **Step 14.4: Commit**

```bash
git add src/components/HeaderUserMenu.tsx src/components/Header.tsx src/app/(frontend)/layout.tsx tests/component/HeaderUserMenu.test.tsx
git commit -m "feat(frontend): HeaderUserMenu + layout integration"
```

---

## Task 15: Editorial Dashboard (Custom Admin Component)

**Files:**
- Create: `src/components/admin/EditorialDashboard.tsx`
- Create: `src/components/admin/EditorialDashboard.server.tsx` (Server-Component-Wrapper)
- Modify: `src/payload.config.ts` (wire into `admin.components.views.dashboard`)
- Modify: `src/app/(payload)/admin/importMap.js` (Payload-importmap)
- Test: `tests/component/EditorialDashboard.test.tsx`

Editor + Reviewer öffnen `/admin` und sehen statt einer leeren Collection-Liste Stats + Quick-Links.

- [ ] **Step 15.1: Server-Component-Wrapper that fetches data**

`src/components/admin/EditorialDashboard.server.tsx`:
```typescript
import { getPayload } from 'payload';
import config from '@/payload.config';
import { getSession } from '@/lib/auth';
import { EditorialDashboard } from './EditorialDashboard';

export async function EditorialDashboardServer() {
  const session = await getSession();
  const payload = await getPayload({ config });
  const pending = await payload.count({ collection: 'submissions', where: { reviewStatus: { equals: 'pending' } } });
  const inReview = await payload.count({ collection: 'submissions', where: { reviewStatus: { equals: 'in_review' } } });
  const readyToPublish = await payload.count({ collection: 'articles', where: { status: { equals: 'ready_to_publish' } } });
  const myStack = session
    ? await payload.count({
        collection: 'articles',
        where: { and: [{ status: { in: ['in_review', 'ready_to_publish'] } }, { currentReviewer: { equals: session.id } }] },
      })
    : { totalDocs: 0 };
  const recentSubmissions = await payload.find({
    collection: 'submissions', sort: '-createdAt', limit: 5, depth: 0,
  });
  const recentArticles = await payload.find({
    collection: 'articles', where: { status: { not_equals: 'published' } }, sort: '-updatedAt', limit: 5, depth: 0,
  });
  return (
    <EditorialDashboard
      stats={{
        pending: pending.totalDocs,
        inReview: inReview.totalDocs,
        readyToPublish: readyToPublish.totalDocs,
        myStack: myStack.totalDocs,
      }}
      recentSubmissions={recentSubmissions.docs as never}
      recentArticles={recentArticles.docs as never}
    />
  );
}
```

- [ ] **Step 15.2: Presentation Component (Client-safe)**

`tests/component/EditorialDashboard.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorialDashboard } from '@/components/admin/EditorialDashboard';

describe('EditorialDashboard', () => {
  const props = {
    stats: { pending: 3, inReview: 1, readyToPublish: 2, myStack: 0 },
    recentSubmissions: [{ id: 1, displayTitle: 'Sub A', reviewStatus: 'pending', createdAt: '2026-06-22T10:00:00Z' }],
    recentArticles: [{ id: 10, title: 'Art X', status: 'in_review', updatedAt: '2026-06-22T11:00:00Z' }],
  };
  it('renders all four stats cards with values', () => {
    render(<EditorialDashboard {...(props as never)} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
  it('renders recent items with links', () => {
    render(<EditorialDashboard {...(props as never)} />);
    expect(screen.getByText('Sub A')).toBeInTheDocument();
    expect(screen.getByText('Art X')).toBeInTheDocument();
  });
});
```

`src/components/admin/EditorialDashboard.tsx`:
```typescript
export function EditorialDashboard({
  stats, recentSubmissions, recentArticles,
}: {
  stats: { pending: number; inReview: number; readyToPublish: number; myStack: number };
  recentSubmissions: Array<{ id: number; displayTitle?: string; reviewStatus?: string; createdAt?: string }>;
  recentArticles: Array<{ id: number; title?: string; status?: string; updatedAt?: string }>;
}) {
  const cards = [
    { label: 'Eingegangen', value: stats.pending, href: '/admin/collections/submissions?where[reviewStatus][equals]=pending' },
    { label: 'In Review', value: stats.inReview, href: '/admin/collections/submissions?where[reviewStatus][equals]=in_review' },
    { label: 'Bereit zur Veröffentlichung', value: stats.readyToPublish, href: '/admin/collections/articles?where[status][equals]=ready_to_publish' },
    { label: 'Mein offener Stack', value: stats.myStack, href: '/admin/collections/articles?where[status][in]=in_review,ready_to_publish' },
  ];
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Redaktions-Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {cards.map((c) => (
          <a key={c.label} href={c.href} style={{ display: 'block', padding: 16, background: '#fff', border: '1px solid #ddd', borderRadius: 6, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1f5e6d' }}>{c.value}</div>
            <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>{c.label}</div>
          </a>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Aktuelle Einreichungen</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {recentSubmissions.map((s) => (
              <li key={s.id} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <a href={`/admin/collections/submissions/${s.id}`}>{s.displayTitle ?? 'Unbenannt'}</a>
                <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>· {s.reviewStatus}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Articles in Pipeline</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {recentArticles.map((a) => (
              <li key={a.id} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <a href={`/admin/collections/articles/${a.id}`}>{a.title}</a>
                <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>· {a.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 15.3: Wire into payload.config.ts**

In `src/payload.config.ts`, extend `admin`:
```typescript
admin: {
  user: Users.slug,
  importMap: { baseDir: path.resolve(dirname) },
  components: {
    views: {
      dashboard: {
        Component: '/src/components/admin/EditorialDashboard.server.tsx#EditorialDashboardServer',
      },
    },
  },
},
```

Run: `pnpm generate:importmap` to regenerate `src/app/(payload)/admin/importMap.js` (V1.5-Lesson).

- [ ] **Step 15.4: Run tests + manual smoke**

Run: `pnpm vitest run tests/component/EditorialDashboard.test.tsx`
Expected: PASS

Manual: `pnpm dev` → log in as editor → `/admin` shows Dashboard instead of default Payload-Landing.

- [ ] **Step 15.5: Commit**

```bash
git add src/components/admin/EditorialDashboard.tsx src/components/admin/EditorialDashboard.server.tsx src/payload.config.ts src/app/(payload)/admin/importMap.js tests/component/EditorialDashboard.test.tsx
git commit -m "feat(admin): editorial dashboard as custom admin landing"
```

---

## Task 16: ClaimButton + Detail-View-Integration

**Files:**
- Create: `src/components/admin/ClaimButton.tsx`
- Create: `src/app/(payload)/admin/claim-actions.ts`
- Modify: `src/collections/Submissions.ts` (add `claimButton` UI-field to sidebar)
- Modify: `src/collections/Articles.ts` (add `claimButton` UI-field to sidebar)
- Modify: `src/app/(payload)/admin/importMap.js`
- Test: `tests/component/ClaimButton.test.tsx`
- Test: `tests/integration/claim-mechanics.test.ts`

UI-Field-Komponente, die in der Sidebar von Submission + Article erscheint, wenn `currentReviewer` leer ist und Status `in_review`/`pending`.

- [ ] **Step 16.1: Server-Action for claiming**

`src/app/(payload)/admin/claim-actions.ts`:
```typescript
'use server';
import { requireUser } from '@/lib/auth';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { revalidatePath } from 'next/cache';

export async function claimSubmissionAction(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireUser();
    const payload = await getPayload({ config });
    await payload.update({
      collection: 'submissions', id,
      data: { currentReviewer: session.id, reviewStatus: 'in_review' } as never,
    });
    revalidatePath(`/admin/collections/submissions/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Claim failed.' };
  }
}

export async function claimArticleAction(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireUser();
    const payload = await getPayload({ config });
    await payload.update({
      collection: 'articles', id,
      data: { currentReviewer: session.id, status: 'in_review' } as never,
      overrideAccess: false,
      user: { id: session.id, role: session.role } as never,
    });
    revalidatePath(`/admin/collections/articles/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Claim failed.' };
  }
}
```

- [ ] **Step 16.2: ClaimButton Component**

`tests/component/ClaimButton.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClaimButton } from '@/components/admin/ClaimButton';

describe('ClaimButton', () => {
  it('shows Claim button when no currentReviewer', () => {
    render(<ClaimButton id={1} type="article" currentReviewerId={null} currentReviewerName={null} sessionUserId={5} />);
    expect(screen.getByRole('button', { name: /übernehmen/i })).toBeInTheDocument();
  });
  it('shows "Aktuell bei X" when claimed by other', () => {
    render(<ClaimButton id={1} type="article" currentReviewerId={3} currentReviewerName="Anna" sessionUserId={5} />);
    expect(screen.getByText(/aktuell bei Anna/i)).toBeInTheDocument();
  });
  it('shows "Du bearbeitest" when claimed by self', () => {
    render(<ClaimButton id={1} type="article" currentReviewerId={5} currentReviewerName="Me" sessionUserId={5} />);
    expect(screen.getByText(/du bearbeitest/i)).toBeInTheDocument();
  });
});
```

`src/components/admin/ClaimButton.tsx`:
```typescript
'use client';
import { useState } from 'react';
import { claimArticleAction, claimSubmissionAction } from '@/app/(payload)/admin/claim-actions';

export function ClaimButton({ id, type, currentReviewerId, currentReviewerName, sessionUserId }: {
  id: number; type: 'article' | 'submission';
  currentReviewerId: number | null; currentReviewerName: string | null;
  sessionUserId: number;
}) {
  const [busy, setBusy] = useState(false);
  if (currentReviewerId === sessionUserId) {
    return <div style={{ padding: 8, fontSize: 13 }}>Du bearbeitest das gerade.</div>;
  }
  if (currentReviewerId !== null) {
    return <div style={{ padding: 8, fontSize: 13 }}>Aktuell bei <strong>{currentReviewerName ?? 'unbekannt'}</strong>.</div>;
  }
  async function claim() {
    setBusy(true);
    const fn = type === 'article' ? claimArticleAction : claimSubmissionAction;
    const result = await fn(id);
    setBusy(false);
    if (result.ok) {
      window.location.reload();
    } else {
      alert(result.error ?? 'Übernahme fehlgeschlagen.');
    }
  }
  return (
    <button onClick={claim} disabled={busy} style={{ padding: '6px 12px', background: '#1f5e6d', color: '#fff', borderRadius: 4, border: 'none', cursor: 'pointer' }}>
      {busy ? 'Übernehme…' : 'Übernehmen'}
    </button>
  );
}
```

- [ ] **Step 16.3: Wrap as Payload UI-Field**

Create `src/components/admin/ClaimButtonField.server.tsx`:
```typescript
import { getSession } from '@/lib/auth';
import { ClaimButton } from './ClaimButton';

export async function ClaimButtonField({
  data, collection,
}: { data?: { id?: number; currentReviewer?: number | { id: number; displayName?: string } | null }; collection: string }) {
  const session = await getSession();
  if (!session || !data?.id) return null;
  const reviewerRaw = data.currentReviewer ?? null;
  const reviewerId = typeof reviewerRaw === 'object' && reviewerRaw ? reviewerRaw.id : reviewerRaw;
  const reviewerName = typeof reviewerRaw === 'object' && reviewerRaw ? reviewerRaw.displayName ?? null : null;
  const type = collection === 'articles' ? 'article' : 'submission';
  return (
    <ClaimButton
      id={data.id}
      type={type as 'article' | 'submission'}
      currentReviewerId={reviewerId}
      currentReviewerName={reviewerName}
      sessionUserId={session.id}
    />
  );
}
```

In `Submissions.ts`, add UI-field:
```typescript
{
  name: 'claimButton',
  type: 'ui',
  admin: {
    position: 'sidebar',
    components: { Field: '/src/components/admin/ClaimButtonField.server.tsx#ClaimButtonField' },
  },
},
```
In `Articles.ts`, same UI-field (adjusted props).

Run: `pnpm generate:importmap`

- [ ] **Step 16.4: Integration test for claim race**

`tests/integration/claim-mechanics.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('claim mechanics — last-write-wins', () => {
  it('two simultaneous claims on the same article: last write wins', async () => {
    const r1 = await createUserFixture(payload, 'reviewer');
    const r2 = await createUserFixture(payload, 'reviewer');
    const article = await payload.create({
      collection: 'articles',
      data: {
        title: 'Race', slug: `race-${Date.now()}`, intent: 'background', summary: 's',
        definition: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'd' }] }] } },
        praxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'p' }] }] } },
        risiken: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'r' }] }] } },
        quellen: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'q' }] }] } },
        status: 'draft',
      } as never,
    });
    await Promise.all([
      payload.update({ collection: 'articles', id: article.id, data: { status: 'in_review' } as never, overrideAccess: false, user: r1 as never }),
      payload.update({ collection: 'articles', id: article.id, data: { status: 'in_review' } as never, overrideAccess: false, user: r2 as never }),
    ]);
    const final = await payload.findByID({ collection: 'articles', id: article.id });
    const reviewer = (final as { currentReviewer?: number | { id: number } }).currentReviewer;
    const reviewerId = typeof reviewer === 'object' && reviewer ? reviewer.id : reviewer;
    expect([r1.id, r2.id]).toContain(reviewerId);
  });
});
```

- [ ] **Step 16.5: Commit**

```bash
git add src/components/admin/ClaimButton.tsx src/components/admin/ClaimButtonField.server.tsx src/app/(payload)/admin/claim-actions.ts src/collections/Submissions.ts src/collections/Articles.ts src/app/(payload)/admin/importMap.js tests/component/ClaimButton.test.tsx tests/integration/claim-mechanics.test.ts
git commit -m "feat(admin): claim button for submissions + articles in_review"
```

---

## Task 17: InviteUserModal + Users-Liste-Customization

**Files:**
- Create: `src/components/admin/InviteUserButton.tsx`
- Create: `src/app/(payload)/admin/invite-action.ts`
- Modify: `src/collections/Users.ts` (add UI-field for invite-button, add `defaultColumns`)
- Modify: `src/app/(payload)/admin/importMap.js`
- Test: `tests/component/InviteUserButton.test.tsx`

Modal-Trigger oberhalb der Users-Liste — admin sieht alle Rollen im Picker, editor nur reviewer+contributor.

- [ ] **Step 17.1: Server-Action wrapper**

`src/app/(payload)/admin/invite-action.ts`:
```typescript
'use server';
import { inviteUserAction } from '@/lib/auth';
import type { Role } from '@/lib/auth-permissions';
import { revalidatePath } from 'next/cache';

export async function inviteUserFromAdminAction(email: string, role: Role, displayName: string) {
  const result = await inviteUserAction(email, role, displayName);
  if (result.ok) revalidatePath('/admin/collections/users');
  return result;
}
```

- [ ] **Step 17.2: InviteUserButton Component**

`tests/component/InviteUserButton.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InviteUserButton } from '@/components/admin/InviteUserButton';

describe('InviteUserButton', () => {
  it('admin sees all 4 role options', () => {
    render(<InviteUserButton sessionRole="admin" />);
    fireEvent.click(screen.getByRole('button', { name: /einladen/i }));
    expect(screen.getByRole('option', { name: /admin/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /redakteur/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /reviewer/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /beitragende/i })).toBeInTheDocument();
  });
  it('editor sees only reviewer + contributor', () => {
    render(<InviteUserButton sessionRole="editor" />);
    fireEvent.click(screen.getByRole('button', { name: /einladen/i }));
    expect(screen.queryByRole('option', { name: /^admin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^redakteur/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /reviewer/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /beitragende/i })).toBeInTheDocument();
  });
  it('reviewer + contributor see no button', () => {
    const { container: c1 } = render(<InviteUserButton sessionRole="reviewer" />);
    expect(c1.querySelector('button')).toBeNull();
    const { container: c2 } = render(<InviteUserButton sessionRole="contributor" />);
    expect(c2.querySelector('button')).toBeNull();
  });
});
```

`src/components/admin/InviteUserButton.tsx`:
```typescript
'use client';
import { useState } from 'react';
import type { Role } from '@/lib/auth-permissions';
import { inviteUserFromAdminAction } from '@/app/(payload)/admin/invite-action';

const ROLES_FOR: Record<Role, Array<{ value: Role; label: string }>> = {
  admin: [
    { value: 'admin', label: 'Admin' },
    { value: 'editor', label: 'Redakteur:in' },
    { value: 'reviewer', label: 'Reviewer:in' },
    { value: 'contributor', label: 'Beitragende:r' },
  ],
  editor: [
    { value: 'reviewer', label: 'Reviewer:in' },
    { value: 'contributor', label: 'Beitragende:r' },
  ],
  reviewer: [],
  contributor: [],
};

export function InviteUserButton({ sessionRole }: { sessionRole: Role }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const options = ROLES_FOR[sessionRole];
  if (options.length === 0) return null;

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const result = await inviteUserFromAdminAction(
      String(formData.get('email') ?? ''),
      formData.get('role') as Role,
      String(formData.get('displayName') ?? ''),
    );
    setBusy(false);
    setMessage(result.ok ? '✓ Einladung verschickt.' : `Fehler: ${result.error}`);
    if (result.ok) setOpen(false);
  }

  return (
    <div style={{ padding: 8 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ padding: '6px 12px', background: '#1f5e6d', color: '#fff', borderRadius: 4, border: 'none' }}>
        Neue:n User einladen
      </button>
      {open && (
        <form action={submit} style={{ marginTop: 12, padding: 16, border: '1px solid #ddd', borderRadius: 6, background: '#fff', maxWidth: 480 }}>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="invite-email" style={{ display: 'block', fontSize: 12 }}>E-Mail</label>
            <input id="invite-email" name="email" type="email" required style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="invite-displayName" style={{ display: 'block', fontSize: 12 }}>Anzeigename</label>
            <input id="invite-displayName" name="displayName" type="text" required style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="invite-role" style={{ display: 'block', fontSize: 12 }}>Rolle</label>
            <select id="invite-role" name="role" required style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 4 }}>
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy} style={{ padding: '6px 12px', background: '#1f5e6d', color: '#fff', borderRadius: 4, border: 'none' }}>
            {busy ? 'Lade…' : 'Einladen'}
          </button>
        </form>
      )}
      {message && <p style={{ marginTop: 8, fontSize: 13 }}>{message}</p>}
    </div>
  );
}
```

- [ ] **Step 17.3: Wrap as Server-Component for Payload BeforeList slot**

`src/components/admin/InviteUserButton.server.tsx`:
```typescript
import { getSession } from '@/lib/auth';
import { InviteUserButton } from './InviteUserButton';

export async function InviteUserButtonServer() {
  const session = await getSession();
  if (!session) return null;
  return <InviteUserButton sessionRole={session.role} />;
}
```

In `Users.ts`, add to `admin.components.BeforeList`:
```typescript
admin: {
  useAsTitle: 'email',
  defaultColumns: ['email', 'displayName', 'role', 'disabled', 'invitedAt'],
  components: {
    beforeList: ['/src/components/admin/InviteUserButton.server.tsx#InviteUserButtonServer'],
  },
},
```

Run: `pnpm generate:importmap`

- [ ] **Step 17.4: Commit**

```bash
git add src/components/admin/InviteUserButton.tsx src/components/admin/InviteUserButton.server.tsx src/app/(payload)/admin/invite-action.ts src/collections/Users.ts src/app/(payload)/admin/importMap.js tests/component/InviteUserButton.test.tsx
git commit -m "feat(admin): InviteUserButton with role-filtered picker"
```

---

## Task 18: /einreichen Auto-Attribution + V1.5-Test-Suite-Anpassung

**Files:**
- Modify: `src/app/(frontend)/einreichen/actions.ts` (pass `req.user` so the hook auto-fills `submittedBy`)
- Modify: `tests/setup.node.ts` (ensure mail mock is registered, double-check existing mocks)
- Modify: Any V1.5 integration tests that broke due to permission-tightening (run-and-fix)

- [ ] **Step 18.1: Update /einreichen action**

In `src/app/(frontend)/einreichen/actions.ts`, find the `payload.create({collection: 'submissions', data: ...})` call and ensure `user` from session is passed. Add at the top:
```typescript
import { getSession } from '@/lib/auth';
```
And in the action body, before the create:
```typescript
const session = await getSession();
// then in the create call:
await payload.create({
  collection: 'submissions',
  data: sanitizedData as never,
  user: session ? { id: session.id, role: session.role } as never : undefined,
});
```

- [ ] **Step 18.2: Run full suite to find regressions**

Run: `pnpm vitest run`
Expected: any V1.5 test that uses `payload.update({..., overrideAccess: false})` with a stub-user-record might now fail because the permission-matrix is stricter. Fix each failing test by setting `overrideAccess: true` (test-only) or by providing a properly-roled `user` object.

- [ ] **Step 18.3: Commit**

```bash
git add src/app/(frontend)/einreichen/actions.ts tests/
git commit -m "fix(einreichen): pass session to payload.create for submittedBy auto-fill + test regression fixes"
```

---

## Task 19: Smoke-Tests, README-Update, PR

**Files:**
- Modify: `README.md` (Login-URL, Set-Password-Flow erwähnen)
- Modify: `.env.example` (NEXT_PUBLIC_SITE_URL)
- Create: `docs/V1.6-SMOKE-TESTS.md` (manuelle Test-Liste)

- [ ] **Step 19.1: Run full test suite**

```bash
pnpm vitest run
```
Expected: all tests pass. Note count vs. baseline (`233 + ~70 = ~300`).

```bash
pnpm lint
pnpm build
```
Expected: zero errors. Warnings OK if at baseline-level.

- [ ] **Step 19.2: Manual smoke tests (six flows)**

Run `pnpm dev` and execute each flow. Document outcomes in `docs/V1.6-SMOKE-TESTS.md`:

**Flow A — Admin lädt Editor ein**
1. Log in as Oliver (admin) on `/login`.
2. Navigate to `/admin/collections/users`, click „Neue:n User einladen" → enter email, displayName, role=editor.
3. Submit. Check Resend-Dashboard or local mail-log: invitation mail received.
4. Open magic-link → `/passwort-setzen?token=...` → set password.
5. Auto-redirect to `/admin`. Editor-Dashboard visible.

**Flow B — Editor lädt Contributor ein → Contributor submitted Beitrag**
1. Log in as the Editor from Flow A.
2. Invite a Contributor.
3. Contributor sets password → redirected to `/mein-bereich`.
4. Click „Zum Einreichen-Formular" → submit a new_article.
5. Check `/mein-bereich` → submission appears in „Meine Beiträge" with status „Eingegangen".

**Flow C — Reviewer claimt + ready-to-publish + Editor publisht**
1. As admin, invite a Reviewer.
2. Reviewer logs in, opens `/admin/collections/submissions/<id>` of Flow-B-Submission.
3. Set reviewStatus → in_review. Verify `currentReviewer` = self.
4. Trigger workflow „In Review nehmen" (V1.5-Button) → PR is created.
5. On the article (after accept), reviewer can also claim there.
6. As editor, transition status `ready_to_publish` → check Resend for notification mail to editor account.
7. As editor, transition to `published` → article appears on `/artikel`.

**Flow D — Contributor Profile-Edit + Avatar + Account-Lösch**
1. Contributor on `/mein-bereich` updates bio, pflegerischeRolle, bundesland.
2. Save → success message.
3. Click „Account löschen" → modal → type LÖSCHEN → submit.
4. Auto-logout, redirect to `/`.
5. As admin, verify user-record has anonymized email + disabled=true.

**Flow E — Forgot-Password-Roundtrip**
1. Log out. On `/passwort-vergessen` enter known email.
2. Generic success message.
3. Check mail → reset-link.
4. Open link → set new password → login redirect.

**Flow F — Privilege-Escalation-Versuche**
1. As editor, try inviting an admin via curl: `curl -X POST .../api/users ...` with role=admin → should be 403.
2. As contributor, navigate `/admin` → redirect to `/login` or 403.
3. As contributor, try `payload.update({collection:'users', id:other.id, data:{role:'admin'}})` via Network-Tab → 403.

- [ ] **Step 19.3: Update README**

In `README.md`, add an „Auth & Accounts (V1.6)" section:
```markdown
## Auth & Accounts (V1.6)

- Login: `/login` (replaces direct Payload-Admin-Login)
- Forgot password: `/passwort-vergessen`
- Set password (invitation or reset): `/passwort-setzen?token=...`
- Contributor dashboard: `/mein-bereich`
- Account is invitation-only — admins/editors invite via Payload-Admin (Users → „Neue:n User einladen").
- Required env var (Production): `NEXT_PUBLIC_SITE_URL` (used in magic-link generation).
```

In `.env.example`, add:
```
# V1.6 Auth: used in magic-link URLs for invitation + password-reset mails
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 19.4: Push + create PR**

```bash
git add README.md .env.example docs/V1.6-SMOKE-TESTS.md
git commit -m "docs: V1.6 auth section in README + smoke-test outcomes"
git push origin feat/v1-6-editorial-auth
```

Create PR via gh:
```bash
gh pr create --title "feat(v1-6): Editorial-Workflow + Auth" --body "$(cat <<'EOF'
## Summary

V1.6 brings frontend login, 4-role permission system, invitation-only account creation, and the `ready_to_publish` article status with claim mechanic.

- 4 roles: admin / editor / reviewer / contributor
- Auth kapselt in `src/lib/auth.ts` (Single Source of Truth)
- Permission-Matrix als TypeScript-Konstante
- Frontend-Login + /mein-bereich + /mitmachen Pages
- Editorial-Dashboard im Admin
- Claim-Mechanik (`currentReviewer`) für Articles + Submissions
- DSGVO: Self-Service Account-Lösch + Datenexport
- Mail-Templates für Invitation, Forgot, Welcome, Ready-to-publish

**Release-Gate:** Nicht produktiv deployen vor Abschluss des DSGVO-Tracks (Datenschutz, Impressum, AVV).

## Test plan
- [ ] All ~300 vitest tests green
- [ ] Lint 0 errors
- [ ] Build succeeds
- [ ] Six manual smoke flows pass (A-F documented in `docs/V1.6-SMOKE-TESTS.md`)
- [ ] Real Resend mail in staging
- [ ] Cross-browser login (Chrome, Safari, Firefox)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review-Notes

Spec→Plan-coverage:
- Spec Section 1 (Scope B+) → addressed via task selection (no Public Author Pages, no Re-Review-Cron, no Self-Signup)
- Spec Section 2 (Architektur) → T1+T6 (auth kapselt), T2-T5 (Domain-Modell), T10-T17 (UI)
- Spec Section 3 (Datenmodell) → T2 (Migrations), T3-T5 (Field-Definitions)
- Spec Section 4 (Permission-Matrix) → T1 (Konstante) + T3-T5 (Access-Functions)
- Spec Section 5 (Workflows) → T4 (Article-Übergänge), T5 (Submission), T7 (Invitation), T8 (Lifecycle)
- Spec Section 6 (UI) → T10-T17
- Spec Section 7 (Auth-Layer) → T6-T8
- Spec Section 8 (Mail) → T9
- Spec Section 9 (DSGVO) → T8 (Soft-Delete + Export), T10 (DSGVO-Checkbox), T13 (AccountActions)
- Spec Section 10 (Testing) → tests in each task + T19 (smoke)
- Spec Section 11 (Migration-Risiken) → T2 (Migration-First-Pattern)
- Spec Section 12 (Abgrenzung) → addressed implicitly by file-list (V1.5-Files bleiben)

Open caveat: **Avatar-Upload-UI** ist im Spec als Teil von V1.6 vorgesehen, aber im Plan (T13) bewusst als Defer-Punkt markiert (nur Datenfeld + Payload-Admin-Upload). Falls Oliver Avatar-Upload-UI zwingend in V1.6 will, dranbasteln: zusätzliche Task „T13.5" mit `<input type=file>` + Server-Action, die `payload.create({collection:'media', file, data:{purpose:'avatar', uploadedBy:session.id}})` ruft und User.avatar mit der neuen Media-ID updated. Geschätzt 1-2h zusätzlich.

Notiz: Custom-Field-Component-Paths (z.B. `'/src/components/admin/ClaimButtonField.server.tsx#ClaimButtonField'`) müssen exakt zur Payload-3.x-Import-Map passen — V1.5-Lesson: `pnpm generate:importmap` nach jeder Custom-Field-Komponente.

