'use server';

import { redirect } from 'next/navigation';
import { loginAction } from '@/lib/auth';

export interface LoginFormState {
  error?: string;
  email?: string;
}

export async function loginFormAction(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');
  const result = await loginAction(email, password);
  if (!result.ok) {
    return { error: result.error ?? 'Anmeldung fehlgeschlagen.', email };
  }
  redirect(next || result.redirectTo || '/mein-bereich');
}
