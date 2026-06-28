'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

interface AvatarCropModalProps {
  file: File;
  onConfirm: (cropped: Blob) => void;
  onCancel: () => void;
}

export function AvatarCropModal({ file, onConfirm, onCancel }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);

  const [imageUrl] = useState(() => URL.createObjectURL(file));

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onCancel();
  }

  async function handleConfirm() {
    if (!pixels || !imageUrl) return;
    setBusy(true);
    try {
      const blob = await renderCroppedBlob(imageUrl, pixels);
      // no setBusy(false) on success — parent unmounts us when its state transitions away from 'cropping'.
      onConfirm(blob);
    } catch (err) {
      console.error('Avatar crop failed:', err);
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bildausschnitt wählen"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <div className="w-[95vw] max-w-[480px] rounded-lg bg-white p-4 shadow-xl">
        <div className="relative h-[320px] w-full bg-stone-100">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, p) => setPixels(p)}
          />
        </div>
        <label className="mt-4 block text-sm">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-1 w-full"
            aria-label="Zoom"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-rule px-4 py-2"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !pixels}
            className="rounded bg-brand px-4 py-2 text-white disabled:opacity-50"
          >
            {busy ? 'Verarbeite …' : 'Übernehmen'}
          </button>
        </div>
      </div>
    </div>
  );
}

async function renderCroppedBlob(url: string, area: Area): Promise<Blob> {
  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas-2D-Context nicht verfügbar');
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, 512, 512);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/jpeg',
      0.9,
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image-load fehlgeschlagen'));
    img.src = url;
  });
}
