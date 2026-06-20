import type { CollectionConfig } from 'payload';
import { slugify } from '../lib/slugify';
import { getOctokit } from '@/lib/github-app';
import { getGithubConfig } from '@/lib/env';
import { upsertArticleMarkdown, deleteArticleMarkdown } from '@/lib/github-article-sync';
import { renderArticleMarkdown } from '@/lib/article-markdown';

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
  const prev = args.previousDoc as { status?: string };

  const wasPublished = prev.status === 'published';
  const isPublished = doc.status === 'published';

  const cfg = getGithubConfig();
  const owner = cfg?.owner ?? 'shogun160';
  const repo = cfg?.repo ?? 'pflege-atlas';
  const octokit = getOctokit();

  if (!isPublished && wasPublished && doc.slug) {
    try {
      await deleteArticleMarkdown(octokit, { owner, repo, slug: doc.slug });
    } catch (err) {
      console.error(
        `[V1.5] Failed to delete article markdown for ${doc.slug}:`,
        err instanceof Error ? err.message : err,
      );
    }
    return;
  }

  if (isPublished && doc.slug) {
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
  // V1: `status` (Entwurf/In Review/Veröffentlicht/Archiviert) ist die
  // alleinige Visibility-Quelle für die Read-Access-Rule unten. Payloads
  // natives `_status` aus dem drafts-Workflow bleibt für interne Versionen
  // erhalten, wird aber im Editorial-Flow nicht benutzt. Auf den nativen
  // Draft-Workflow wechseln wir später mit dem Auth/Editorial-Plan.
  hooks: {
    afterChange: [
      async (args) => {
        await afterArticleChangeHook(args as never);
      },
    ],
  },
  versions: {
    drafts: true,
    maxPerDoc: 50,
  },
  access: {
    read: ({ req: { user } }) => {
      if (user) return true;
      return {
        status: { equals: 'published' },
      };
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
          ({ data, value }) => {
            if (value) return value;
            if (data?.title) return slugify(data.title);
            return value;
          },
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
        description:
          'Dieses Feld steuert die öffentliche Sichtbarkeit. Nur "Veröffentlicht" ist für Leser:innen sichtbar.',
      },
      options: [
        { label: 'Entwurf', value: 'draft' },
        { label: 'In Review', value: 'in_review' },
        { label: 'Veröffentlicht', value: 'published' },
        { label: 'Archiviert', value: 'archived' },
      ],
    },
  ],
};
