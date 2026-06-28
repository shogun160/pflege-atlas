import type {
  Access,
  CollectionBeforeOperationHook,
  CollectionConfig,
  File as PayloadFile,
  Where,
} from 'payload';
import sharp from 'sharp';
import { hasRolePermission, type Role } from '@/lib/auth-permissions';

type MediaAuthUser = { role?: Role; disabled?: boolean; id?: number };

const resizeAvatarHook: CollectionBeforeOperationHook<'media'> = async ({
  args,
  operation,
  req,
}) => {
  if (operation !== 'create' && operation !== 'update') return args;
  const data = args.data as { purpose?: string } | undefined;
  if (data?.purpose !== 'avatar') return args;
  const file = req.file as PayloadFile | undefined;
  if (!file?.data || !file.mimetype?.startsWith('image/')) return args;
  const resized = await sharp(file.data)
    .resize(256, 256, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  req.file = {
    data: resized,
    mimetype: 'image/jpeg',
    name: file.name?.replace(/\.[^.]+$/, '.jpg') ?? 'avatar.jpg',
    size: resized.length,
  };
  return args;
};

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
    beforeOperation: [resizeAvatarHook],
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
  upload: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
};
