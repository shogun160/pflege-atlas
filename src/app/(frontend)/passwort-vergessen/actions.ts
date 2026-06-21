'use server';

import { requestPasswordResetAction } from '@/lib/auth';

export interface ForgotState {
  submitted?: boolean;
}

export async function forgotPasswordFormAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get('email') ?? '');
  await requestPasswordResetAction(email);
  return { submitted: true };
}
