'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

interface AvatarCropModalProps {
  file: File;
  onConfirm: (cropped: Blob) => void;
  onCancel: () => void;
}

export function AvatarCropModal({ file, onConfirm: _onConfirm, onCancel }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [_pixels, setPixels] = useState<Area | null>(null);

  const imageUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onCancel();
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
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-rule px-4 py-2"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
