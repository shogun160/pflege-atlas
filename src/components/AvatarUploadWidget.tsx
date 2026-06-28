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
        {preview}
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelected}
            disabled={uploading}
            className="block text-sm"
            aria-label="Profilbild auswählen"
          />
          <input type="hidden" name="avatar" value={hiddenValue} />
          {(state.kind === 'persisted' || state.kind === 'replaced') && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-sm text-red-700 underline"
            >
              Bild entfernen
            </button>
          )}
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
            Max. 5 MB. JPEG, PNG oder WebP. Wird auf 256×256 verkleinert.
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
