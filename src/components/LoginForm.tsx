'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginFormAction, type LoginFormState } from '@/app/(frontend)/login/actions';
import { PasswordInput } from '@/components/PasswordInput';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand px-6 py-2 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Anmelden …' : 'Anmelden'}
    </button>
  );
}

export function LoginForm({
  initialState = {},
  next = '',
}: {
  initialState?: LoginFormState;
  next?: string;
}) {
  const [state, formAction] = useActionState(loginFormAction, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          E-Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={state.email ?? ''}
          autoComplete="email"
          className="w-full rounded border border-rule px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Passwort
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
        />
      </div>
      {state.error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}
      <SubmitButton />
      <p className="text-sm">
        <a href="/passwort-vergessen" className="text-brand underline">
          Passwort vergessen?
        </a>
      </p>
    </form>
  );
}
