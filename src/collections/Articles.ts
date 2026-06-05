import type { CollectionConfig } from 'payload';
import { slugify } from '../lib/slugify';

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
      required: true,
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
