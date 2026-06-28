'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  updateOwnProfileAction,
  deleteOwnAccountAction,
  exportOwnDataAction,
  logoutAction,
} from '@/lib/auth';

export interface ProfileFormState {
  saved?: boolean;
  error?: string;
}

export async function saveProfileFormAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const avatarRaw = formData.get('avatar');
  const avatarIdParsed =
    typeof avatarRaw === 'string' && avatarRaw.length > 0
      ? Number.parseInt(avatarRaw, 10)
      : null;
  const avatar = Number.isFinite(avatarIdParsed) ? avatarIdParsed : null;

  const patch = {
    displayName: String(formData.get('displayName') ?? '') || undefined,
    bio: (formData.get('bio') as string | null) ?? undefined,
    pflegerischeRolle: (formData.get('pflegerischeRolle') as string | null) || null,
    bundesland: (formData.get('bundesland') as string | null) || null,
    avatar,
  };
  const result = await updateOwnProfileAction(patch);
  if (!result.ok) return { error: result.error };
  // B10: revalidate so the page re-renders with the new profile values
  // without requiring a manual reload.
  revalidatePath('/mein-bereich');
  return { saved: true };
}

export interface DeleteFormState {
  error?: string;
}

export async function deleteAccountFormAction(
  _prev: DeleteFormState,
  formData: FormData,
): Promise<DeleteFormState> {
  const confirmation = String(formData.get('confirmation') ?? '');
  const result = await deleteOwnAccountAction(confirmation);
  if (!result.ok) return { error: result.error };
  // logoutAction itself throws the redirect post-B6 — no need to redirect twice.
  await logoutAction();
  // Unreachable, kept as a safety net in case logoutAction's redirect ever
  // changes shape.
  redirect('/');
}

export async function downloadDataAction(): Promise<{
  json?: string;
  error?: string;
}> {
  const result = await exportOwnDataAction();
  return { json: result.json, error: result.error };
}
