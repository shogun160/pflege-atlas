'use server';

import { redirect } from 'next/navigation';
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
  const patch = {
    displayName: String(formData.get('displayName') ?? '') || undefined,
    bio: (formData.get('bio') as string | null) ?? undefined,
    pflegerischeRolle: (formData.get('pflegerischeRolle') as string | null) || null,
    bundesland: (formData.get('bundesland') as string | null) || null,
  };
  const result = await updateOwnProfileAction(patch);
  if (!result.ok) return { error: result.error };
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
  await logoutAction();
  redirect('/');
}

export async function downloadDataAction(): Promise<{
  json?: string;
  error?: string;
}> {
  const result = await exportOwnDataAction();
  return { json: result.json, error: result.error };
}
