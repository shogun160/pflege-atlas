'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { setPasswordFromTokenAction } from '@/lib/auth';

export interface SetPasswordFormState {
  error?: string;
}

export async function setPasswordFormAction(
  _prev: SetPasswordFormState,
  formData: FormData,
): Promise<SetPasswordFormState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const repeat = String(formData.get('passwordRepeat') ?? '');
  const dsgvo = formData.get('dsgvo');
  // mode is read for DSGVO-UI gating only; the server uses authoritative
  // token-field-match to determine invitation vs reset, not this hint.
  const mode = String(formData.get('mode') ?? 'invitation');

  if (password.length < 8) {
    return { error: 'Passwort muss mindestens 8 Zeichen lang sein.' };
  }
  if (password !== repeat) {
    return { error: 'Die Passwörter stimmen nicht überein.' };
  }
  if (mode === 'invitation' && !dsgvo) {
    return { error: 'Bitte bestätige die Datenschutz-Hinweise.' };
  }

  const requestHeaders = await headers();
  const result = await setPasswordFromTokenAction(token, password, requestHeaders);
  if (!result.ok) {
    return { error: result.error ?? 'Passwort konnte nicht gesetzt werden.' };
  }
  redirect(result.redirectTo ?? '/mein-bereich');
}
