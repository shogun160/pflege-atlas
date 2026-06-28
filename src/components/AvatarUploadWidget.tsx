'use client';

import { useState, useRef, type ChangeEvent } from 'react';
import { AvatarCropModal } from './AvatarCropModal';

interface AvatarUploadWidgetProps {
  currentAvatarUrl: string | null;
  currentAvatarId: number | null;
  displayName: string;
  email: string;
}

type LocalState =
  | { kind: 'persisted'; id: number; url: string }
  | { kind: 'replaced'; id: number; url: string }
  | { kind: 'removed' }
  | { kind: 'none' }
  | { kind: 'cropping'; file: File };

export function AvatarUploadWidget(props: AvatarUploadWidgetProps) {
  const initial: LocalState =
    props.currentAvatarId && props.currentAvatarUrl
      ? { kind: 'persisted', id: props.currentAvatarId, url: props.currentAvatarUrl }
      : { kind: 'none' };
  const [state, setState] = useState<LocalState>(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError('Datei zu groß (max. 5 MB).');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Nur JPEG, PNG oder WebP erlaubt.');
      return;
    }
    setState({ kind: 'cropping', file });
  }

  async function handleCropConfirm(blob: Blob) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', blob, 'avatar.jpg');
      fd.append(
        '_payload',
        JSON.stringify({
          alt: `Profilbild von ${props.displayName || props.email}`,
          purpose: 'avatar',
        }),
      );
      const res = await fetch('/api/media', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Upload fehlgeschlagen (${res.status})`);
      }
      const json = (await res.json()) as { doc: { id: number; url: string } };
      setState({ kind: 'replaced', id: json.doc.id, url: json.doc.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen.');
      setState({ kind: 'none' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleCropCancel() {
    setState((s) => (s.kind === 'cropping' ? { kind: 'none' } : s));
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleRemove() {
    setState({ kind: 'removed' });
    setError(null);
  }

  function handleReset() {
    setState(initial);
    setError(null);
  }

  const hiddenValue =
    state.kind === 'persisted' || state.kind === 'replaced' ? String(state.id) : '';

  const preview = (() => {
    if (state.kind === 'persisted' || state.kind === 'replaced') {
      return (
        <img
          src={state.url}
          alt="Aktuelles Profilbild"
          className="h-24 w-24 rounded-full object-cover"
        />
      );
    }
    const initialLetter = (props.displayName || props.email || '?').charAt(0).toUpperCase();
    return (
      <div
        aria-hidden="true"
        className="flex h-24 w-24 items-center justify-center rounded-full bg-brand text-3xl font-semibold text-white"
      >
        {initialLetter}
      </div>
    );
  })();

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">Profilbild</label>
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Profilbild ändern"
          className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {preview}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7">
              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
              <path d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          </span>
        </button>
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelected}
            disabled={uploading}
            className="sr-only"
            aria-label="Profilbild auswählen"
            tabIndex={-1}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M9.25 13.75a.75.75 0 001.5 0V4.66l3.22 3.22a.75.75 0 001.06-1.06l-4.5-4.5a.75.75 0 00-1.06 0l-4.5 4.5a.75.75 0 001.06 1.06l3.22-3.22v9.09z" />
                <path d="M3.5 14.75a.75.75 0 011.5 0v1.75c0 .14.11.25.25.25h9.5a.25.25 0 00.25-.25v-1.75a.75.75 0 011.5 0v1.75A1.75 1.75 0 0114.75 18.25h-9.5A1.75 1.75 0 013.5 16.5v-1.75z" />
              </svg>
              Bild hochladen
            </button>
            {(state.kind === 'persisted' || state.kind === 'replaced') && (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
                Bild entfernen
              </button>
            )}
          </div>
          <input type="hidden" name="avatar" value={hiddenValue} />
          {state.kind === 'replaced' && (
            <button
              type="button"
              onClick={handleReset}
              className="ml-3 text-sm text-stone-600 underline"
            >
              Auswahl zurücksetzen
            </button>
          )}
          {state.kind === 'removed' && (
            <p className="text-sm text-stone-600">
              Bild wird beim Speichern entfernt.{' '}
              <button type="button" onClick={handleReset} className="underline">
                Doch behalten
              </button>
            </p>
          )}
          <p className="text-xs text-stone-500">
            Max. 5 MB. JPEG, PNG oder WebP. Wird zugeschnitten und als Profilbild (256×256) gespeichert.
          </p>
          {uploading && <p className="text-sm text-stone-700">Lade hoch …</p>}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
      {state.kind === 'cropping' && (
        <AvatarCropModal
          file={state.file}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
