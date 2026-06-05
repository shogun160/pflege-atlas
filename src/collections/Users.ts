import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'displayName'],
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
        { label: 'Redakteur:in', value: 'editor' },
        { label: 'Reviewer:in', value: 'reviewer' },
        { label: 'Beitragende:r', value: 'contributor' },
      ],
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Kurzprofil (sichtbar auf Autorenseite)',
    },
  ],
};
