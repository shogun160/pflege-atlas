'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  forgotPasswordFormAction,
  type ForgotState,
} from '@/app/(frontend)/passwort-vergessen/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand px-6 py-2 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Wird gesendet …' : 'Absenden'}
    </button>
  );
}

export function ForgotPasswordForm({
  initialState = {},
}: {
  initialState?: ForgotState;
}) {
  const [state, formAction] = useActionState(forgotPasswordFormAction, initialState);

  if (state.submitted) {
    return (
      <p
        role="status"
        className="rounded border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
      >
        Wenn ein Account mit dieser Adresse existiert, kommt gleich eine Mail mit
        dem Reset-Link.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          E-Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded border border-rule px-3 py-2"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
