import type { Access, CollectionConfig, Where } from 'payload';
import { hasRolePermission, type Role } from '@/lib/auth-permissions';

type MediaAuthUser = { role?: Role; disabled?: boolean; id?: number };

const readAccess: Access = ({ req: { user } }) => {
  // article_image + other: public
  // avatar: own or editor+
  if (!user) {
    return { purpose: { not_equals: 'avatar' } } as Where;
  }
  const u = user as MediaAuthUser;
  if (u.disabled || !u.role) {
    return { purpose: { not_equals: 'avatar' } } as Where;
  }
  if (hasRolePermission(u.role, 'readOthersAvatar', 'media')) {
    return true;
  }
  // Contributor / reviewer: alle non-avatar + own avatars
  return {
    or: [
      { purpose: { not_equals: 'avatar' } },
      { and: [{ purpose: { equals: 'avatar' } }, { uploadedBy: { equals: u.id } }] },
    ],
  } as Where;
};

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: readAccess,
    create: ({ req: { user } }) => {
      if (!user) return false;
      const u = user as MediaAuthUser;
      if (u.disabled || !u.role) return false;
      return (
        hasRolePermission(u.role, 'uploadAvatar', 'media') ||
        hasRolePermission(u.role, 'uploadArticleImage', 'media')
      );
    },
    update: ({ req: { user } }) => {
      if (!user) return false;
      const u = user as MediaAuthUser;
      if (u.disabled || !u.role) return false;
      // own media OR editor+
      if (hasRolePermission(u.role, 'delete', 'media')) return true;
      return { uploadedBy: { equals: u.id } };
    },
    delete: ({ req: { user } }) => {
      if (!user) return false;
      const u = user as MediaAuthUser;
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
