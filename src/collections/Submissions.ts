import type { CollectionConfig } from 'payload';

const SECTIONS = ['definition', 'praxis', 'risiken', 'quellen'] as const;

const conditionNewArticle = (data: Record<string, unknown> | undefined) =>
  data?.type === 'new_article';

const conditionCorrection = (data: Record<string, unknown> | undefined) =>
  data?.type === 'correction';

export const Submissions: CollectionConfig = {
  slug: 'submissions',
  admin: {
    useAsTitle: 'displayTitle',
    defaultColumns: ['displayTitle', 'type', 'reviewStatus', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: () => true,
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => user?.role === 'editor',
  },
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        if (!data) return data;
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
    ...SECTIONS.map((section) => ({
      name: `edited${section.charAt(0).toUpperCase()}${section.slice(1)}`,
      type: 'richText' as const,
      label: `Editierte Sektion: ${section}`,
      admin: { condition: conditionCorrection },
    })),
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
