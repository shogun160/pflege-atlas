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
  // Field-Naming-Note (Plan-Deviation vs Spec/Plan-Vorlage):
  // Spec/Plan nannten die User-FKs `actorUserId`/`subjectUserId`. Payload-Drizzle
  // hängt für `relationship`-Felder automatisch ein `_id`-Suffix an den
  // snake-case-Feldnamen → ergäbe DB-Spalten `actor_user_id_id` (doppeltes _id).
  // Field-Namen verkürzt auf `actor`/`subject` → DB-Spalten `actor_id`/`subject_id`,
  // konsistent mit `invited_by_id`, `current_reviewer_id` etc. in den V1.6/V1.7-Migrationen.
  fields: [
    { name: 'eventType', type: 'text', required: true, index: true, admin: { readOnly: true } },
    { name: 'actor', type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true } },
    { name: 'actorEmail', type: 'text', admin: { readOnly: true } },
    { name: 'subject', type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true } },
    { name: 'subjectEmail', type: 'text', admin: { readOnly: true } },
    { name: 'metadata', type: 'json', admin: { readOnly: true } },
    { name: 'ipHash', type: 'text', maxLength: 64, admin: { readOnly: true } },
    { name: 'userAgent', type: 'text', maxLength: 200, admin: { readOnly: true } },
  ],
};
