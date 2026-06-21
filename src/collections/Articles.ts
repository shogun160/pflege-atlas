import type { CollectionConfig } from 'payload';
import { slugify } from '../lib/slugify';
import { getOctokit } from '@/lib/github-app';
import { getGithubConfig } from '@/lib/env';
import { upsertArticleMarkdown, deleteArticleMarkdown } from '@/lib/github-article-sync';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import { hasRolePermission, type Action, type Role } from '@/lib/auth-permissions';

type ArticleAuthUser = { role?: Role; disabled?: boolean; id?: number };

/**
 * Maps a target article status to the permission action required to transition
 * into it. `null` means "no permission gate" (any user with updateContent
 * access may move back to draft). `undefined` (lookup miss) is treated as an
 * unknown status and rejected — this is the exhaustiveness guard for the
 * status enum.
 */
const STATUS_REQUIRED_ACTION: Record<string, Action | null> = {
  draft: null,
  in_review: 'transitionToReview',
  ready_to_publish: 'transitionToReadyToPublish',
  published: 'publish',
  archived: 'archive',
};

export function slugBeforeValidate(args: {
  data?: { title?: string };
  value?: string | null;
}): string | undefined {
  const { data, value } = args;
  if (value != null && value !== '') {
    return slugify(value);
  }
  if (data?.title) return slugify(data.title);
  return value ?? undefined;
}

/**
 * Eventually-consistent GitHub sync.
 *
 * Octokit failures are caught and logged but do NOT roll back the Payload
 * DB save. Reason: Payload's afterChange hooks are isolated from the
 * outer transaction. The next save attempt will retry the sync.
 *
 * For atomic GitHub+DB writes use the T12 server actions instead
 * (in src/app/(payload)/admin/submission-actions.ts).
 */
export async function afterArticleChangeHook(args: {
  operation: 'create' | 'update' | string;
  doc: Record<string, unknown>;
  previousDoc: Record<string, unknown>;
  req: {
    context?: { skipMarkdownSync?: boolean };
    payload: { find: (a: unknown) => Promise<{ docs: { name?: string }[] }> };
  };
}): Promise<void> {
  if (args.req?.context?.skipMarkdownSync) return;

  const doc = args.doc as { id: number; slug?: string; status?: string };
  const prev = args.previousDoc as { status?: string; slug?: string };

  const wasPublished = prev.status === 'published';
  const isPublished = doc.status === 'published';
  const slugChanged = !!prev.slug && !!doc.slug && prev.slug !== doc.slug;

  const cfg = getGithubConfig();
  const owner = cfg?.owner ?? 'shogun160';
  const repo = cfg?.repo ?? 'pflege-atlas';
  const octokit = getOctokit();

  if (!isPublished && wasPublished) {
    const slugToDelete = prev.slug ?? doc.slug;
    if (slugToDelete) {
      try {
        await deleteArticleMarkdown(octokit, { owner, repo, slug: slugToDelete });
      } catch (err) {
        console.error(
          `[V1.5] Failed to delete article markdown for ${slugToDelete}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    return;
  }

  if (isPublished && doc.slug) {
    if (wasPublished && slugChanged && prev.slug) {
      try {
        await deleteArticleMarkdown(octokit, { owner, repo, slug: prev.slug });
      } catch (err) {
        console.error(
          `[V1.5] Failed to delete previous article markdown for ${prev.slug}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    try {
      const markdown = renderArticleMarkdown(doc as never, []);
      await upsertArticleMarkdown(octokit, { owner, repo, slug: doc.slug, markdown });
    } catch (err) {
      console.error(
        `[V1.5] Failed to sync article markdown for ${doc.slug}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'lastReviewedAt', 'standardsBound'],
  },
  // `status` ist die alleinige Sichtbarkeits-Quelle (siehe Read-Access-
  // Rule unten). Payloads native Draft-Funktion (`versions.drafts`) ist
  // bewusst deaktiviert: ein zweites paralleles Status-Konzept (`_status`)
  // hat im Smoke-Test wiederholt zur UX-Falle geführt (Bug 3, Track F
  // 2026-06-20). Audit-Trail kommt über V1.5-GitHub-Sync.
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req, operation }) => {
        if (operation !== 'update' || !data) return data;
        const prev = originalDoc as { status?: string; currentReviewer?: number | { id: number } | null; reviewedBy?: Array<number | { id: number }> } | undefined;
        const next = data as { status?: string; currentReviewer?: number | null; reviewedBy?: Array<number> };
        const prevStatus = prev?.status;
        const nextStatus = next.status;
        if (nextStatus && nextStatus !== prevStatus) {
          const user = req.user as ArticleAuthUser | undefined;
          // System/internal calls (no req.user) bypass permission enforcement.
          // This mirrors Payload's access semantics: when overrideAccess is not
          // explicitly set to false, internal/scripted code runs unconstrained.
          if (!user) return data;
          if (!user.role || user.disabled) {
            throw new Error('Permission denied: no role for status transition.');
          }
          const role = user.role;
          // Permission-Check je Übergang (data-driven; exhaustiveness via map)
          const requiredAction = STATUS_REQUIRED_ACTION[nextStatus];
          if (requiredAction === undefined) {
            throw new Error(`Unknown article status: ${nextStatus}`);
          }
          if (requiredAction && !hasRolePermission(role, requiredAction, 'articles')) {
            throw new Error(`Permission denied: ${role} cannot transition to ${nextStatus}.`);
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
      async ({ doc, previousDoc, req }) => {
        const prev = (previousDoc as { status?: string })?.status;
        const next = (doc as { status?: string })?.status;
        if (prev === 'ready_to_publish' || next !== 'ready_to_publish') return;
        try {
          const reviewerRaw = (doc as {
            currentReviewer?: number | { id: number; displayName?: string } | null;
          }).currentReviewer;
          const reviewerName =
            typeof reviewerRaw === 'object' && reviewerRaw
              ? reviewerRaw.displayName ?? 'Reviewer:in'
              : 'Reviewer:in';
          // B8: Dev/local DBs accumulate ~150 test-fixture users (@test.local,
          // @example.com) which all got the ready-to-publish notification and
          // spammed the Resend sandbox. Pragmatic gate: in prod, notify all
          // editors+admins; in dev/test, notify only Oliver's admin account.
          // The dedicated integration-test sets NODE_ENV=production to keep
          // the full-broadcast assertion intact.
          const isProd = process.env.NODE_ENV === 'production';
          const where: Record<string, unknown> = isProd
            ? {
                and: [
                  { role: { in: ['editor', 'admin'] } },
                  { disabled: { equals: false } },
                ],
              }
            : { email: { equals: 'oliver.wosnitza@gmail.com' } };
          const editors = await req.payload.find({
            collection: 'users',
            where: where as never,
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
              to: editor.email,
              articleTitle: title,
              reviewer: reviewerName,
              adminLink,
            });
            await sendMail({ to: editor.email, ...mail });
          }
        } catch (err) {
          console.error('[V1.6] ready-to-publish notification failed:', err);
        }
      },
    ],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return { status: { equals: 'published' } };
      const u = user as ArticleAuthUser;
      if (u.disabled) return { status: { equals: 'published' } };
      if (u.role && hasRolePermission(u.role, 'readAllStati', 'articles')) {
        return true;
      }
      return { status: { equals: 'published' } };
    },
    create: ({ req: { user } }) => {
      if (!user) return false;
      const u = user as ArticleAuthUser;
      if (u.disabled || !u.role) return false;
      return hasRolePermission(u.role, 'createArticle', 'articles');
    },
    update: ({ req: { user } }) => {
      if (!user) return false;
      const u = user as ArticleAuthUser;
      if (u.disabled || !u.role) return false;
      return hasRolePermission(u.role, 'updateContent', 'articles');
    },
    delete: ({ req: { user } }) => {
      if (!user) return false;
      const u = user as ArticleAuthUser;
      if (u.disabled || !u.role) return false;
      return hasRolePermission(u.role, 'delete', 'articles');
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Titel',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'URL-Slug',
      required: true,
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [
          ({ data, value }) =>
            slugBeforeValidate({
              data: data as { title?: string } | undefined,
              value: value as string | null | undefined,
            }),
        ],
      },
      admin: {
        description: 'Wird aus dem Titel generiert, kann überschrieben werden.',
      },
    },
    {
      name: 'intent',
      type: 'select',
      label: 'Intent (Startseiten-Kategorie)',
      required: true,
      options: [
        { label: 'Schnelle Hilfe am Bett', value: 'bedside' },
        { label: 'Hintergrundwissen', value: 'background' },
        { label: 'Etwas zum Lernen', value: 'learning' },
      ],
    },
    {
      name: 'summary',
      type: 'textarea',
      label: 'Kurzbeschreibung (für Listen & Open Graph)',
      required: true,
      maxLength: 280,
    },
    {
      name: 'definition',
      type: 'richText',
      label: '1. Definition / Kurzantwort',
      required: true,
    },
    {
      name: 'praxis',
      type: 'richText',
      label: '2. Praxis (inkl. eingewobenem Erfahrungswissen)',
      required: true,
    },
    {
      name: 'risiken',
      type: 'richText',
      label: '3. Risiken & Fallstricke',
      required: true,
    },
    {
      name: 'quellen',
      type: 'richText',
      label: '4. Quellen & Weiterführendes',
      required: true,
    },
    {
      name: 'authors',
      type: 'relationship',
      label: 'Autor:innen',
      relationTo: 'users',
      hasMany: true,
    },
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
    {
      name: 'claimButton',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field:
            'src/components/admin/ClaimButtonField.server.tsx#ClaimButtonField',
        },
      },
    },
    {
      name: 'reviewedBy',
      type: 'relationship',
      label: 'Geprüft von',
      relationTo: 'users',
      hasMany: true,
    },
    {
      name: 'lastReviewedAt',
      type: 'date',
      label: 'Zuletzt geprüft am',
    },
    {
      name: 'standardsBound',
      type: 'checkbox',
      label: 'Standardgebunden (automatische Review-Erinnerung nach 18 Monaten)',
      defaultValue: false,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      defaultValue: 'draft',
      admin: {
        position: 'sidebar',
        description:
          'Steuert die öffentliche Sichtbarkeit. Nur "Veröffentlicht" ist für Leser:innen sichtbar — kein zweiter Toggle nötig.',
      },
      options: [
        { label: 'Entwurf', value: 'draft' },
        { label: 'In Review', value: 'in_review' },
        { label: 'Bereit zur Veröffentlichung', value: 'ready_to_publish' },
        { label: 'Veröffentlicht', value: 'published' },
        { label: 'Archiviert', value: 'archived' },
      ],
    },
  ],
};
