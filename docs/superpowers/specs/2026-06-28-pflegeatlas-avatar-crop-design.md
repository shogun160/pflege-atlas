# PflegeAtlas Avatar-Crop — Design

**Datum:** 2026-06-28
**Status:** Spec
**Scope:** V1.6.1-UI-Polish Item — Crop/Zoom/Pan-UI für Avatar-Upload
**Branch:** `feat/avatar-crop`

## Kontext

PR #41 hat den Avatar-Upload eingeführt: File-Pick → POST `/api/media` → Sharp-Hook resized auf 256×256 JPEG mit `fit: 'cover', position: 'center'`. „Crop-UI mit Zoom/Pan" stand explizit auf Out-of-Scope.

Praxis-Feedback nach Merge: User möchten den Ausschnitt selbst wählen — bei Portraits (Köpfe nicht zentriert) und Querformat-Fotos (Wunschausschnitt liegt nicht im automatischen Center-Cover) ist das harte `position: 'center'` nicht akzeptabel.

Scope-Entscheidung (Brainstorm 2026-06-28): **Minimal-MVP** (Variante A aus Brainstorm) — Client-seitiges Crop vor Upload, kein Schema-Change, kein Original-Storage. „Re-Crop ohne Re-Upload" bleibt Out-of-Scope (würde Media-Schema + R2-Storage-Verdopplung erfordern).

## Ziele

1. Selbst-gewählter Crop (Drag + Zoom + Pinch) für Avatar-Uploads
2. Mobile-tauglich (iOS + Android, Touch-Gestures funktionieren)
3. Server-Pfad (Sharp-Hook, Media-Collection, R2-Persistence) bleibt **unverändert** — Crop ist rein Client-seitig
4. Bestehende Avatar-Tests bleiben unverändert grün (Server-Pfad)
5. Bundle-Impact ≤ 35 KB tree-shaken

## Non-Goals

- Re-Crop ohne Re-Upload (Original wird nicht persistiert)
- Free-Form-Crop, nicht-quadratische Aspect-Ratios
- Filter, Brightness, Rotation
- Drag-Drop-Upload, Webcam-Capture
- Crop für `article_image` (separater Track, falls je gewünscht)
- Verzicht auf Sharp-Hook server-seitig (bleibt als Safety-Net für direkte API-Aufrufe)

## Architektur

**Library:** `react-easy-crop` (~14k★, MIT, aktiv gewartet, ~30 KB tree-shaken). De-facto-Standard für genau diesen Use-Case (Avatar mit fixed-aspect + Zoom). Touch/Pinch out-of-box korrekt.

**Neue Datei:** `src/components/AvatarCropModal.tsx` (Client-Component, ~120 Zeilen).

```tsx
'use client';
import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

interface Props {
  file: File;
  onConfirm: (cropped: Blob) => void;
  onCancel: () => void;
}

export function AvatarCropModal({ file, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const imageUrl = useObjectUrl(file); // useEffect-Wrapper, revoke on unmount

  const onCropComplete = useCallback((_: Area, p: Area) => setPixels(p), []);

  async function handleConfirm() {
    if (!pixels) return;
    setBusy(true);
    try {
      const blob = await renderCroppedBlob(imageUrl, pixels);
      onConfirm(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Bildausschnitt wählen"
         className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
         onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
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
            onCropComplete={onCropComplete}
          />
        </div>
        <label className="mt-4 block text-sm">
          Zoom
          <input type="range" min={1} max={3} step={0.05}
            value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full" aria-label="Zoom" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel}
            className="rounded border border-rule px-4 py-2">Abbrechen</button>
          <button type="button" onClick={handleConfirm} disabled={busy || !pixels}
            className="rounded bg-brand px-4 py-2 text-white disabled:opacity-50">
            {busy ? 'Verarbeite …' : 'Übernehmen'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Helper `renderCroppedBlob`** (in derselben Datei oder `src/lib/crop-image.ts`, ~40 Zeilen):

```ts
export async function renderCroppedBlob(url: string, area: Area): Promise<Blob> {
  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img,
    area.x, area.y, area.width, area.height, // source rect
    0, 0, 512, 512,                          // dest rect
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('toBlob returned null')),
      'image/jpeg',
      0.9,
    );
  });
}
```

**Output-Spec:** 512×512 JPEG quality 90 (~50–150 KB). Gibt Sharp Headroom für saubere 256×256-Downsamples (Lanczos auf doppelter Auflösung > direkt rendern auf Zielgröße). Falls später Retina-Avatar gewünscht: Quelle ist schon groß genug.

**Hinweis zu `cropShape="round"`:** Nur Preview-Maske im Modal (User sieht runden Ausschnitt, matched die Header-Avatar-Darstellung). Der Canvas-Output bleibt quadratisch — wir cropp'en ein Rechteck, nicht einen Kreis.

## AvatarUploadWidget-Änderung

Neue State-Variante zwischen File-Pick und Upload:

```ts
type LocalState =
  | { kind: 'persisted'; id: number; url: string }
  | { kind: 'replaced'; id: number; url: string }
  | { kind: 'removed' }
  | { kind: 'none' }
  | { kind: 'cropping'; file: File }; // NEU
```

Flow-Diff:

```diff
 async function handleFileSelected(e) {
   const file = e.target.files?.[0];
   if (!file) return;
   // ... size + MIME validation ...
-  setUploading(true);
-  try { /* fetch POST /api/media with file */ }
+  setState({ kind: 'cropping', file });
+}
+
+async function handleCropConfirm(blob: Blob) {
+  setState((s) => s.kind === 'cropping' ? { kind: 'none' } : s);
+  setUploading(true);
+  try {
+    // existing upload logic, but with `blob` instead of `file`
+    const fd = new FormData();
+    fd.append('file', blob, 'avatar.jpg');
+    fd.append('_payload', JSON.stringify({ alt: ..., purpose: 'avatar' }));
+    // ... rest unchanged ...
+  }
+}
+
+function handleCropCancel() {
+  setState({ kind: 'none' });
+  if (fileRef.current) fileRef.current.value = '';
 }
```

Render: wenn `state.kind === 'cropping'`, zusätzlich `<AvatarCropModal file={state.file} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />` rendern.

## Datenfluss

```
File (z.B. 5 MB iPhone HEIC-konvertiert)
  → Client-Validation (size, MIME)
  → AvatarCropModal({ file, onConfirm, onCancel })
    → URL.createObjectURL(file) für <img>-Display
    → User adjusts (Drag, Zoom-Slider, Pinch)
    → onCropComplete liefert {x, y, width, height} in Original-Pixeln
    → Canvas: drawImage(crop-rect → 512×512)
    → toBlob('image/jpeg', 0.9) → ~50-150 KB
  → FormData('file', blob, 'avatar.jpg') + _payload-JSON
  → POST /api/media
  → Sharp-Hook: resize 512→256 (cover/center, aber Quelle ist schon perfekt quadratisch)
  → R2-Persist → User-Avatar gesetzt
```

## Touch-Map

| Datei | Änderung |
|---|---|
| `package.json` | + `react-easy-crop` |
| `src/components/AvatarCropModal.tsx` | **NEU** — Modal + Cropper + Canvas-Blob-Helper |
| `src/components/AvatarUploadWidget.tsx` | + `'cropping'`-State, + `handleCropConfirm`, + `handleCropCancel`, Modal-Render-Branch |
| `tests/component/AvatarCropModal.test.tsx` | **NEU** — 4-5 Tests |
| `tests/component/AvatarUploadWidget.test.tsx` | + 2 Tests (Cancel-im-Modal = kein Upload; Übernehmen = Upload mit Blob) |

**Nicht angefasst:**
- `src/collections/Media.ts` (Sharp-Hook + Validation bleiben)
- `src/payload.config.ts`
- `tests/integration/avatar-upload-flow.test.ts` (testet Server-Pfad, bleibt grün)
- `src/lib/avatar-cleanup.ts`, `src/lib/avatar-orphan-cleanup.ts`

## Tests

**AvatarCropModal:**
1. Rendert Cropper mit übergebenem File (objectURL gesetzt)
2. Zoom-Slider Range 1–3, ändert internen State
3. Cancel-Button ruft `onCancel`, NICHT `onConfirm`
4. Übernehmen-Button ruft `onConfirm` mit einem Blob (Mock-Canvas via `vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')`)
5. Escape-Key = Abbruch

**AvatarUploadWidget (neue Tests):**
6. File-Pick öffnet Crop-Modal, startet NICHT sofort Upload (`fetch` wird nicht aufgerufen)
7. Crop-Übernehmen feuert `fetch` mit Blob in FormData

**Integration:** unverändert (Server testet payload.create, Crop ist Client-only).

**Browser-Smoke nach Deploy:**
- iPhone-Portrait picken → Modal öffnet → Kopf nach unten ziehen → Übernehmen → Header-Avatar zeigt gewählten Ausschnitt
- Querformat-Foto picken → reinzoomen → übernehmen
- Mobile (Safari iOS): Pinch-Zoom funktioniert
- Cancel im Modal → File-Input zurückgesetzt → erneutes Picken funktioniert
- Removal-Flow + Replacement-Flow bleiben intakt

## Risiken

| Risiko | Mitigation |
|---|---|
| react-easy-crop bricht bei Major-Update | Lock auf Minor in package.json; PR #42-Konvention |
| Canvas-toBlob liefert null (alte Safari) | Promise rejected → Error-Banner im Widget („Bild konnte nicht verarbeitet werden") |
| ObjectURL-Leak | useEffect-Cleanup mit `URL.revokeObjectURL` |
| Bundle-Size durch Lazy-Loading-Problem | `react-easy-crop` ist tree-shake-freundlich; falls Concern: dynamischer Import des Modals (`next/dynamic`) |
| HEIC-Bilder (iPhone) | Browser dekodiert automatisch, sobald MIME `image/heic` durch unsere Validation würde — aktuell limitiert auf JPEG/PNG/WebP, kein Change |
| Modal-Backdrop-Klick = unbeabsichtigter Abbruch | Backdrop schließt NICHT, nur Cancel-Button + Escape-Key |

## Plan-Risiko: useObjectUrl-Implementation

`useObjectUrl` ist im Snippet als Custom-Hook gezeigt, existiert aber nicht. Im Implementation-Plan entweder als Inline-`useEffect` im Modal oder als Mini-Hook in `src/lib/hooks/use-object-url.ts`. Vorschlag: inline (Modal ist die einzige Stelle, YAGNI).

## Out-of-Scope (festgehalten)

- Re-Crop ohne Re-Upload (Variante B aus Brainstorm — bräuchte Original-Storage in R2 + Crop-Coords im Media-Schema)
- Free-Form-Crop, nicht-quadratisch
- Multi-Size-Output (Header-32, Profile-96, Retina-128 — single 256×256 reicht weiter)
- Filter, Brightness, Rotation
- Crop für `article_image`-Uploads (separater Track)
- HEIC/HEIF-Support (separater Track)
- Lazy-Load des Modals via `next/dynamic` (nur bei messbarer Bundle-Regression)
