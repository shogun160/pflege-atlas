import type { CollectionConfig } from 'payload';
import { getOctokit } from '@/lib/github-app';
import { getGithubConfig } from '@/lib/env';
import { pushSubmissionEdit } from '@/lib/github-pr';
import { applySubmissionToArticle } from '@/lib/submission-to-article';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import { hasRolePermission, type Role } from '@/lib/auth-permissions';

type SubmissionAuthUser = { role?: Role; disabled?: boolean; id?: number };

const SECTIONS = ['definition', 'praxis', 'risiken', 'quellen'] as const;

const conditionNewArticle = (data: Record<string, unknown> | undefined) =>
  data?.type === 'new_article';

const conditionCorrection = (data: Record<string, unknown> | undefined) =>
  data?.type === 'correction';

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
export async function afterSubmissionChangeHook(args: {
  operation: 'create' | 'update' | string;
  doc: Record<string, unknown>;
  previousDoc: Record<string, unknown>;
  req: { payload: { findByID: (a: unknown) => Promise<unknown> } };
}): Promise<void> {
  if (args.operation !== 'update') return;
  const doc = args.doc as {
    id: number;
    type?: string;
    reviewStatus?: string;
    prBranch?: string | null;
    proposedSlug?: string | null;
    relatedArticle?: number | null;
  };
  if (doc.reviewStatus !== 'in_review' || !doc.prBranch) return;

  let article: unknown = null;
  if (doc.type === 'correction' && doc.relatedArticle) {
    const relatedRaw = doc.relatedArticle as number | { id: number };
    const relatedId =
      typeof relatedRaw === 'object' && relatedRaw !== null ? relatedRaw.id : relatedRaw;
    article = await args.req.payload.findByID({
      collection: 'articles',
      id: relatedId,
      depth: 0,
    });
  }

  const apply = applySubmissionToArticle(doc as never, article as never);
  const snapshot = { ...(article as object), ...apply.patch, slug: apply.slug, status: 'published' };
  const markdown = renderArticleMarkdown({ id: 0, ...snapshot } as never, []);

  const cfg = getGithubConfig();
  const owner = cfg?.owner ?? 'shogun160';
  const repo = cfg?.repo ?? 'pflege-atlas';
  const octokit = getOctokit();

  const newPath = `content/articles/${apply.slug}.md`;
  const oldPath =
    doc.type === 'new_article' &&
    (args.previousDoc as { proposedSlug?: string }).proposedSlug &&
    (args.previousDoc as { proposedSlug?: string }).proposedSlug !== apply.slug
      ? `content/articles/${(args.previousDoc as { proposedSlug?: string }).proposedSlug}.md`
      : undefined;

  try {
    await pushSubmissionEdit(octokit, {
      owner,
      repo,
      branch: doc.prBranch,
      path: newPath,
      oldPath,
      markdown,
      message: `submission(${doc.id}): editorial revision`,
    });
  } catch (err) {
    // Hook errors don't roll back the DB save (Payload isolates them).
    // The next submission edit will retry the sync.
    console.error(
      `[V1.5] Failed to re-push submission ${doc.id} to GitHub:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export const Submissions: CollectionConfig = {
  slug: 'submissions',
  admin: {
    useAsTitle: 'displayTitle',
    defaultColumns: ['displayTitle', 'type', 'reviewStatus', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false;
      const u = user as SubmissionAuthUser;
      if (u.disabled || !u.role) return false;
      if (hasRolePermission(u.role, 'readAllSubmissions', 'submissions')) {
        return true;
      }
      if (hasRolePermission(u.role, 'readOwnSubmissions', 'submissions')) {
        return { submittedBy: { equals: u.id } };
      }
      return false;
    },
    create: () => true, // anonymous + authenticated; submittedBy auto-fill via hook
    update: ({ req: { user } }) => {
      if (!user) return false;
      const u = user as SubmissionAuthUser;
      if (u.disabled || !u.role) return false;
      return hasRolePermission(u.role, 'updateSubmission', 'submissions');
    },
    delete: ({ req: { user } }) => {
      if (!user) return false;
      const u = user as SubmissionAuthUser;
      if (u.disabled || !u.role) return false;
      return hasRolePermission(u.role, 'delete', 'submissions');
    },
  },
  hooks: {
    afterChange: [
      async (args) => {
        await afterSubmissionChangeHook(args as never);
      },
    ],
    beforeChange: [
      async ({ data, req, originalDoc, operation }) => {
        if (!data) return data;

        // Auto-attribution at create-time
        if (operation === 'create' && req.user && !data.submittedBy) {
          data.submittedBy = (req.user as { id?: number }).id;
        }

        // Claim mechanic on reviewStatus transitions
        if (operation === 'update') {
          const prev = originalDoc as
            | {
                reviewStatus?: string;
                currentReviewer?: number | { id: number } | null;
                reviewedBy?: Array<number | { id: number }>;
              }
            | undefined;
          const nextStatus = data.reviewStatus as string | undefined;
          const prevStatus = prev?.reviewStatus;
          if (nextStatus && nextStatus !== prevStatus) {
            const user = req.user as { id?: number } | undefined;
            if (nextStatus === 'in_review' && user?.id) {
              data.currentReviewer = user.id;
            }
            if (prevStatus === 'in_review' && nextStatus !== 'in_review') {
              const prevReviewerRaw = prev?.currentReviewer ?? null;
              const prevReviewerId =
                typeof prevReviewerRaw === 'object' && prevReviewerRaw
                  ? prevReviewerRaw.id
                  : prevReviewerRaw;
              if (prevReviewerId) {
                const existing = (prev?.reviewedBy ?? []).map((r) =>
                  typeof r === 'object' ? r.id : r,
                );
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
  },
  fields: [
    // Workflow-Buttons UI-Field — rendert in der rechten Sidebar unter den PR-Tracking-Feldern
    {
      name: 'workflowButtons',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field:
            'src/components/admin/SubmissionWorkflowField.tsx#SubmissionWorkflowField',
        },
      },
    },
    {
      name: 'type',
      type: 'select',
      label: 'Art',
      required: true,
      options: [
        { label: 'Neuer Artikel-Vorschlag', value: 'new_article' },
        { label: 'Korrekturvorschlag', value: 'correction' },
      ],
    },
    {
      name: 'displayTitle',
      type: 'text',
      label: 'Anzeige-Titel',
      admin: { readOnly: true, description: 'Wird automatisch gesetzt.' },
    },
    {
      name: 'relatedArticle',
      type: 'relationship',
      label: 'Bezogen auf Artikel',
      relationTo: 'articles',
      admin: { condition: conditionCorrection },
    },
    // ====== new_article fields ======
    {
      name: 'proposedTitle',
      type: 'text',
      label: 'Vorgeschlagener Titel',
      admin: { condition: conditionNewArticle },
    },
    {
      name: 'proposedIntent',
      type: 'select',
      label: 'Vorgeschlagener Intent (optional)',
      options: [
        { label: 'Schnelle Hilfe am Bett', value: 'bedside' },
        { label: 'Hintergrundwissen', value: 'background' },
        { label: 'Etwas zum Lernen', value: 'learning' },
      ],
      admin: { condition: conditionNewArticle },
    },
    {
      name: 'proposedSummary',
      type: 'textarea',
      label: 'Vorgeschlagene Kurzbeschreibung (optional, max 280)',
      maxLength: 280,
      admin: { condition: conditionNewArticle },
    },
    ...SECTIONS.map((section) => ({
      name: `proposed${section.charAt(0).toUpperCase()}${section.slice(1)}`,
      type: 'richText' as const,
      label: `Vorgeschlagene Sektion: ${section}`,
      admin: { condition: conditionNewArticle },
    })),
    // ====== correction fields ======
    ...SECTIONS.map((section) => {
      const fieldName = `edited${section.charAt(0).toUpperCase()}${section.slice(1)}`;
      return {
        name: fieldName,
        type: 'richText' as const,
        label: `Editierte Sektion: ${section}`,
        admin: {
          condition: (data: Record<string, unknown> | undefined) => {
            if (!conditionCorrection(data)) return false;
            const value = data?.[fieldName];
            if (!value || typeof value !== 'object') return false;
            const root = (value as { root?: { children?: unknown[] } }).root;
            if (!root || !Array.isArray(root.children) || root.children.length === 0) {
              return false;
            }
            const hasText = (node: unknown): boolean => {
              if (typeof node !== 'object' || node === null) return false;
              const n = node as { text?: unknown; children?: unknown[] };
              if (typeof n.text === 'string' && n.text.trim().length > 0) return true;
              if (Array.isArray(n.children)) return n.children.some(hasText);
              return false;
            };
            return root.children.some(hasText);
          },
        },
      };
    }),
    {
      name: 'correctionReason',
      type: 'textarea',
      label: 'Begründung der Korrektur (optional)',
      maxLength: 2000,
      admin: { condition: conditionCorrection },
    },
    // ====== common: submitter + review ======
    {
      name: 'submitterName',
      type: 'text',
      label: 'Name (optional)',
    },
    {
      name: 'submitterEmail',
      type: 'email',
      label: 'E-Mail (für Rückfragen, optional)',
    },
    // ====== V1.5 PR-tracking + slug override ======
    {
      name: 'proposedSlug',
      type: 'text',
      label: 'Slug (URL-Pfad nach Annahme)',
      admin: {
        condition: conditionNewArticle,
        description: 'Wird beim "In Review nehmen" automatisch befüllt, kann hier angepasst werden.',
      },
    },
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
      relationTo: 'users',
      label: 'Reviewt durch (Audit)',
      hasMany: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'prNumber',
      type: 'number',
      label: 'PR-Nummer',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'prBranch',
      type: 'text',
      label: 'PR-Branch',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'prState',
      type: 'select',
      label: 'PR-Status',
      options: [
        { label: 'Offen', value: 'open' },
        { label: 'Gemerged', value: 'merged' },
        { label: 'Geschlossen', value: 'closed' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'reviewStatus',
      type: 'select',
      label: 'Review-Status',
      defaultValue: 'pending',
      options: [
        { label: 'Eingegangen', value: 'pending' },
        { label: 'In Review', value: 'in_review' },
        { label: 'Übernommen', value: 'accepted' },
        { label: 'Abgelehnt', value: 'rejected' },
      ],
    },
    {
      name: 'reviewerNotes',
      type: 'textarea',
      label: 'Interne Notizen der Redaktion',
    },
  ],
};
