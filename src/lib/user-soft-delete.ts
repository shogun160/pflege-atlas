import { randomBytes } from 'node:crypto';

export interface AnonymizedUserPatch {
  email: string;
  displayName: string;
  bio: null;
  pflegerischeRolle: null;
  bundesland: null;
  avatar: null;
  disabled: true;
}

export function anonymizeUserPatch(): AnonymizedUserPatch {
  const random = randomBytes(8).toString('base64url');
  return {
    email: `deleted-${random}@invalid.local`,
    displayName: 'Gelöschte:r Beitragende:r',
    bio: null,
    pflegerischeRolle: null,
    bundesland: null,
    avatar: null,
    disabled: true,
  };
}
