'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  saveProfileFormAction,
  type ProfileFormState,
} from '@/app/(frontend)/mein-bereich/actions';
import { AvatarUploadWidget } from '@/components/AvatarUploadWidget';

const PFLEGE_OPTIONS = [
  { value: '', label: '— bitte wählen —' },
  { value: 'pflegefachkraft', label: 'Pflegefachkraft' },
  { value: 'pdl', label: 'PDL (Pflegedienstleitung)' },
  { value: 'wbl', label: 'WBL (Wohnbereichsleitung)' },
  { value: 'auszubildende', label: 'Auszubildende:r' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

const BUNDESLAND_OPTIONS = [
  { value: '', label: '— bitte wählen —' },
  { value: 'baden_wuerttemberg', label: 'Baden-Württemberg' },
  { value: 'bayern', label: 'Bayern' },
  { value: 'berlin', label: 'Berlin' },
  { value: 'brandenburg', label: 'Brandenburg' },
  { value: 'bremen', label: 'Bremen' },
  { value: 'hamburg', label: 'Hamburg' },
  { value: 'hessen', label: 'Hessen' },
  { value: 'mecklenburg_vorpommern', label: 'Mecklenburg-Vorpommern' },
  { value: 'niedersachsen', label: 'Niedersachsen' },
  { value: 'nordrhein_westfalen', label: 'Nordrhein-Westfalen' },
  { value: 'rheinland_pfalz', label: 'Rheinland-Pfalz' },
  { value: 'saarland', label: 'Saarland' },
  { value: 'sachsen', label: 'Sachsen' },
  { value: 'sachsen_anhalt', label: 'Sachsen-Anhalt' },
  { value: 'schleswig_holstein', label: 'Schleswig-Holstein' },
  { value: 'thueringen', label: 'Thüringen' },
  { value: 'oesterreich', label: 'Österreich' },
  { value: 'schweiz', label: 'Schweiz' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Speichern …' : 'Speichern'}
    </button>
  );
}

export function ProfileEditForm({
  user,
}: {
  user: {
    displayName?: string;
    bio?: string | null;
    pflegerischeRolle?: string | null;
    bundesland?: string | null;
    avatar?: number | null;
    avatarUrl?: string | null;
    email: string;
  };
}) {
  const [state, formAction] = useActionState(
    saveProfileFormAction,
    {} as ProfileFormState,
  );
  return (
    <form action={formAction} className="space-y-4">
      <AvatarUploadWidget
        currentAvatarUrl={user.avatarUrl ?? null}
        currentAvatarId={user.avatar ?? null}
        displayName={user.displayName ?? ''}
        email={user.email}
      />
      <div>
        <label htmlFor="displayName" className="mb-1 block text-sm font-medium">
          Anzeigename
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={user.displayName ?? ''}
          required
          className="w-full rounded border border-rule px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="bio" className="mb-1 block text-sm font-medium">
          Kurzprofil
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          defaultValue={user.bio ?? ''}
          className="w-full rounded border border-rule px-3 py-2"
        />
        <p className="mt-1 text-xs text-stone-500">
          Sichtbar für: Redaktion (intern).
        </p>
      </div>
      <div>
        <label
          htmlFor="pflegerischeRolle"
          className="mb-1 block text-sm font-medium"
        >
          Pflegerische Rolle (optional)
        </label>
        <select
          id="pflegerischeRolle"
          name="pflegerischeRolle"
          defaultValue={user.pflegerischeRolle ?? ''}
          className="w-full rounded border border-rule px-3 py-2"
        >
          {PFLEGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="bundesland" className="mb-1 block text-sm font-medium">
          Bundesland / Region (optional)
        </label>
        <select
          id="bundesland"
          name="bundesland"
          defaultValue={user.bundesland ?? ''}
          className="w-full rounded border border-rule px-3 py-2"
        >
          {BUNDESLAND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {state.saved && (
        <p role="status" className="text-sm text-emerald-700">
          Profil gespeichert.
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
