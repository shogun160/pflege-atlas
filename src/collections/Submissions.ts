import type { CollectionConfig } from 'payload';

export const Submissions: CollectionConfig = {
  slug: 'submissions',
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'type', 'reviewStatus', 'createdAt'],
  },
  access: {
    // Nur eingeloggte Redakteure / Reviewer sehen Submissions
    read: ({ req: { user } }) => Boolean(user),
    create: () => true, // Öffentliche Form kann später unauthenticated submitten
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) =>
      user?.role === 'editor',
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
      name: 'subject',
      type: 'text',
      label: 'Betreff / Artikel',
      required: true,
    },
    {
      name: 'relatedArticle',
      type: 'relationship',
      label: 'Bezogen auf Artikel (nur bei Korrektur)',
      relationTo: 'articles',
      admin: {
        condition: (data) => data?.type === 'correction',
      },
    },
    {
      name: 'body',
      type: 'textarea',
      label: 'Inhalt / Vorschlag',
      required: true,
    },
    {
      name: 'submitterName',
      type: 'text',
      label: 'Name (optional)',
    },
    {
      name: 'submitterEmail',
      type: 'email',
      label: 'E-Mail (für Rückfragen)',
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
