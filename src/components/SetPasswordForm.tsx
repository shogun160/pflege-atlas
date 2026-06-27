'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  setPasswordFormAction,
  type SetPasswordFormState,
} from '@/app/(frontend)/passwort-setzen/actions';
import { PasswordInput } from '@/components/PasswordInput';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand px-6 py-2 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Wird gespeichert …' : 'Passwort setzen'}
    </button>
  );
}

export function SetPasswordForm({
  token,
  mode,
  initialState = {},
}: {
  token: string;
  mode: 'invitation' | 'reset';
  initialState?: SetPasswordFormState;
}) {
  const [state, formAction] = useActionState(setPasswordFormAction, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="mode" value={mode} />
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Neues Passwort (min. 8 Zeichen)
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label htmlFor="passwordRepeat" className="mb-1 block text-sm font-medium">
          Passwort wiederholen
        </label>
        <PasswordInput
          id="passwordRepeat"
          name="passwordRepeat"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {mode === 'invitation' && (
        <label htmlFor="dsgvo" className="flex items-start gap-2 text-sm">
          <input
            id="dsgvo"
            name="dsgvo"
            type="checkbox"
            required
            className="mt-1"
          />
          <span>
            Ich habe die{' '}
            <a href="/datenschutz" target="_blank" className="text-brand underline">
              Datenschutz
            </a>
            -Hinweise gelesen und stimme der Speicherung von E-Mail und
            Anzeigename zu.
          </span>
        </label>
      )}
      {state.error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}
      <SubmitButton />
    </form>
  );
}
