import type { CollectionConfig } from 'payload';

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: {
    useAsTitle: 'eventType',
    defaultColumns: ['createdAt', 'eventType', 'actorEmail', 'subjectEmail'],
    group: 'System',
    description:
      'Sicherheits- und Kontoverwaltungs-Protokoll (Sub-C3). Read-only. 90-Tage-Retention via Cron.',
  },
  access: {
    read: ({ req }) => (req.user as { role?: string } | undefined)?.role === 'admin',
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'eventType', type: 'text', required: true, index: true, admin: { readOnly: true } },
    { name: 'actorUserId', type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true } },
    { name: 'actorEmail', type: 'text', admin: { readOnly: true } },
    { name: 'subjectUserId', type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true } },
    { name: 'subjectEmail', type: 'text', admin: { readOnly: true } },
    { name: 'metadata', type: 'json', admin: { readOnly: true } },
    { name: 'ipHash', type: 'text', maxLength: 64, admin: { readOnly: true } },
    { name: 'userAgent', type: 'text', maxLength: 200, admin: { readOnly: true } },
  ],
};
