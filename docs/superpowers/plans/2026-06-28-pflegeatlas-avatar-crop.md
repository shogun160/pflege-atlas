# Avatar-Crop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Client-seitige Crop/Zoom/Pan-UI für Avatar-Uploads via `react-easy-crop` im Modal, ohne Server-Pfad-Änderung.

**Architektur:** File-Pick öffnet ein Modal mit Cropper (fixed 1:1, runde Preview-Maske, Zoom-Slider 1–3, Drag, Pinch). „Übernehmen" rendert den gewählten Ausschnitt via Canvas auf 512×512 JPEG quality 90 und reicht die Blob in den bestehenden Upload-Flow ein (POST `/api/media` mit `_payload`-JSON). Sharp-Hook server-seitig bleibt unverändert (Downsample 512→256, Safety-Net).

**Tech Stack:** React 19, Next 16, Vitest + jsdom, Testing-Library, `react-easy-crop` 6.0.2.

**Spec:** `docs/superpowers/specs/2026-06-28-pflegeatlas-avatar-crop-design.md`.

---

### Task 0: Dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install react-easy-crop**

```bash
pnpm add react-easy-crop@^6.0.2
```

- [ ] **Step 2: Verify install + peer-deps**

```bash
pnpm tsc --noEmit
```

Expected: clean (kein Peer-Warning für React 19; `react-easy-crop` peer-deps sind `react: >=16.4.0`).

- [ ] **Step 3: Verify volle Suite bleibt grün**

```bash
pnpm vitest run
```

Expected: 448/448 grün (Baseline nach PR #42-Merge).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add react-easy-crop 6.0.2 (avatar-crop)"
```

---

### Task 1: AvatarCropModal — Skeleton + Cropper + Cancel + Escape

**Files:**
- Create: `src/components/AvatarCropModal.tsx`
- Test: `tests/component/AvatarCropModal.test.tsx`

Diese Task deckt das Render-Skelett ab: Modal mit Cropper, Cancel-Button, Escape-Key. Confirm + Canvas kommt in Task 3.

- [ ] **Step 1: Mock-Modul für react-easy-crop in Test-Setup vorbereiten**

react-easy-crop verwendet intern `getImageSize`-Logic, die in jsdom ohne `<img>`-Decoding nicht funktioniert. Wir mocken das Cropper-Default-Export auf einen einfachen `<div data-testid="cropper">`.

Erstelle `tests/component/AvatarCropModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock react-easy-crop because jsdom can't decode images.
// Capture props so tests can inspect aspect/cropShape/onCropComplete.
const cropperProps = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));
vi.mock('react-easy-crop', () => ({
  default: (props: Record<string, unknown>) => {
    cropperProps.value = props;
    return <div data-testid="cropper" />;
  },
}));

import { AvatarCropModal } from '@/components/AvatarCropModal';

function makeFile() {
  return new File(['x'], 'p.png', { type: 'image/png' });
}

describe('AvatarCropModal', () => {
  beforeEach(() => {
    cropperProps.value = null;
    vi.restoreAllMocks();
  });

  it('renders Cropper with aspect=1 and round preview', () => {
    render(<AvatarCropModal file={makeFile()} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId('cropper')).toBeInTheDocument();
    expect(cropperProps.value?.aspect).toBe(1);
    expect(cropperProps.value?.cropShape).toBe('round');
  });

  it('Cancel-Button calls onCancel and not onConfirm', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<AvatarCropModal file={makeFile()} onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /abbrechen/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape key calls onCancel', () => {
    const onCancel = vi.fn();
    render(<AvatarCropModal file={makeFile()} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/component/AvatarCropModal.test.tsx
```

Expected: FAIL with "Cannot find module '@/components/AvatarCropModal'" (3 Tests).

- [ ] **Step 3: Implement AvatarCropModal-Skeleton**

Erstelle `src/components/AvatarCropModal.tsx`:

```tsx
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
  const [_pixels, setPixels] = useState<Area | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

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
          {imageUrl && (
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
          )}
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
```

> **Note:** `_pixels` ist mit Underscore-Prefix markiert, weil Task 3 den State erst konsumiert (handleConfirm). Lint-Rule `no-unused-vars` ist im Repo so konfiguriert, dass Underscore-Prefix erlaubt ist (siehe bestehende `_` in lexical-Tests).

- [ ] **Step 4: Run tests to verify GREEN**

```bash
pnpm vitest run tests/component/AvatarCropModal.test.tsx
```

Expected: PASS (3/3). Falls die Mock-Hoisted-Helper-Variable nicht funktioniert (Vitest-Hoist-Edge-Case), siehe Fallback: ein einfacher `let cropperProps: unknown = null;` außerhalb `describe` und Reset in `beforeEach`.

- [ ] **Step 5: Typecheck + Lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/AvatarCropModal.tsx tests/component/AvatarCropModal.test.tsx
git commit -m "feat(avatar-crop): modal skeleton with Cropper + Cancel + Escape"
```

---

### Task 2: AvatarCropModal — Zoom-Slider

**Files:**
- Modify: `src/components/AvatarCropModal.tsx`
- Test: `tests/component/AvatarCropModal.test.tsx`

- [ ] **Step 1: Add failing test**

Hänge in `describe('AvatarCropModal', () => { ... })` an:

```tsx
  it('Zoom-Slider has range 1-3 and updates Cropper zoom prop', async () => {
    const user = userEvent.setup();
    render(<AvatarCropModal file={makeFile()} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const slider = screen.getByLabelText('Zoom') as HTMLInputElement;
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('3');
    expect(cropperProps.value?.zoom).toBe(1);
    fireEvent.change(slider, { target: { value: '2.5' } });
    expect(cropperProps.value?.zoom).toBe(2.5);
    void user; // userEvent imported elsewhere; suppress unused
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/component/AvatarCropModal.test.tsx -t "Zoom-Slider"
```

Expected: FAIL with "Unable to find an accessible element with the label 'Zoom'".

- [ ] **Step 3: Add Slider to Modal**

In `src/components/AvatarCropModal.tsx`, zwischen Cropper-Div und Button-Row einfügen:

```tsx
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
```

- [ ] **Step 4: Run test to verify GREEN**

```bash
pnpm vitest run tests/component/AvatarCropModal.test.tsx
```

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/components/AvatarCropModal.tsx tests/component/AvatarCropModal.test.tsx
git commit -m "feat(avatar-crop): zoom slider (1-3, step 0.05)"
```

---

### Task 3: AvatarCropModal — Confirm + Canvas-Blob-Rendering

**Files:**
- Modify: `src/components/AvatarCropModal.tsx`
- Test: `tests/component/AvatarCropModal.test.tsx`

- [ ] **Step 1: Add failing tests**

```tsx
  it('Übernehmen is disabled until onCropComplete fires', () => {
    render(<AvatarCropModal file={makeFile()} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /übernehmen/i });
    expect(btn).toBeDisabled();
  });

  it('Übernehmen calls onConfirm with a Blob after crop completes', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    // Spy toBlob to deliver a predictable JPEG blob synchronously.
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      cb,
    ) {
      cb(new Blob(['jpegbytes'], { type: 'image/jpeg' }));
    });
    // Skip the actual <img>-loading: stub loadImage indirection via Image mock.
    Object.defineProperty(globalThis.Image.prototype, 'src', {
      set() {
        setTimeout(() => this.onload?.(new Event('load')), 0);
      },
    });

    render(<AvatarCropModal file={makeFile()} onConfirm={onConfirm} onCancel={vi.fn()} />);

    // Simulate the Cropper firing onCropComplete with pixel-area.
    cropperProps.value?.onCropComplete?.(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 10, y: 10, width: 200, height: 200 },
    );

    await user.click(screen.getByRole('button', { name: /übernehmen/i }));

    // wait microtask for the canvas/blob async chain
    await new Promise((r) => setTimeout(r, 10));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const blob = onConfirm.mock.calls[0]![0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/jpeg');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/component/AvatarCropModal.test.tsx -t "Übernehmen"
```

Expected: FAIL (button doesn't exist yet).

- [ ] **Step 3: Implement Confirm + renderCroppedBlob**

In `src/components/AvatarCropModal.tsx`:

1. Entferne den Underscore-Prefix bei `pixels`:

```tsx
  const [pixels, setPixels] = useState<Area | null>(null);
```

2. Füge unter den State-Hooks `handleConfirm` ein:

```tsx
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (!pixels || !imageUrl) return;
    setBusy(true);
    try {
      const blob = await renderCroppedBlob(imageUrl, pixels);
      onConfirm(blob);
    } catch (err) {
      console.error('Avatar crop failed:', err);
      setBusy(false);
    }
  }
```

3. Füge `<button>` Übernehmen in der Button-Row ein (nach Abbrechen):

```tsx
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !pixels}
            className="rounded bg-brand px-4 py-2 text-white disabled:opacity-50"
          >
            {busy ? 'Verarbeite …' : 'Übernehmen'}
          </button>
```

4. Unter der Component (am Datei-Ende) `renderCroppedBlob` + `loadImage` als Module-Local-Helpers:

```tsx
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
```

- [ ] **Step 4: Run tests to verify GREEN**

```bash
pnpm vitest run tests/component/AvatarCropModal.test.tsx
```

Expected: PASS (6/6).

- [ ] **Step 5: Typecheck + Lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/AvatarCropModal.tsx tests/component/AvatarCropModal.test.tsx
git commit -m "feat(avatar-crop): confirm button renders 512x512 JPEG blob via canvas"
```

---

### Task 4: AvatarUploadWidget — `cropping`-State + Modal-Integration

**Files:**
- Modify: `src/components/AvatarUploadWidget.tsx`
- Test: `tests/component/AvatarUploadWidget.test.tsx`

Diese Task verändert den Upload-Trigger: File-Pick öffnet jetzt das Modal statt sofort `fetch`. Die Crop-Confirm-Callback ruft den bestehenden Upload-Code mit der Blob.

**Top-of-File-Mock + zwei bestehende Tests anpassen, plus drei neue Tests.**

- [ ] **Step 1a: AvatarCropModal mocken (top of file)**

Am Anfang von `tests/component/AvatarUploadWidget.test.tsx`, direkt nach den Imports und VOR dem `import { AvatarUploadWidget }`, einfügen:

```tsx
const modalProps = vi.hoisted(() => ({
  value: null as null | {
    file: File;
    onConfirm: (b: Blob) => void;
    onCancel: () => void;
  },
}));
vi.mock('@/components/AvatarCropModal', () => ({
  AvatarCropModal: (props: {
    file: File;
    onConfirm: (b: Blob) => void;
    onCancel: () => void;
  }) => {
    modalProps.value = props;
    return <div data-testid="avatar-crop-modal" />;
  },
}));
```

Im bestehenden `beforeEach`, am Anfang ergänzen:

```tsx
    modalProps.value = null;
```

- [ ] **Step 1b: Existing test `reset after upload returns to persisted state` anpassen**

Im Test-Body, nach `await user.upload(...)` und VOR der Assertion auf `value '99'`, einfügen:

```tsx
    // Crop-Confirm dispatchen (post-refactor flow)
    modalProps.value!.onConfirm(new Blob(['cropped'], { type: 'image/jpeg' }));
    await new Promise((r) => setTimeout(r, 10));
```

- [ ] **Step 1c: Existing test `sends alt + purpose inside the _payload JSON field` anpassen**

Gleiche Stelle: nach `await user.upload(...)`, vor den `expect(fetchSpy).toHaveBeenCalled()`-Assertions:

```tsx
    modalProps.value!.onConfirm(new Blob(['cropped'], { type: 'image/jpeg' }));
    await new Promise((r) => setTimeout(r, 10));
```

- [ ] **Step 1d: Drei neue Tests am Ende von `describe('AvatarUploadWidget', ...)` anhängen**

```tsx
  it('file pick opens the crop modal and does NOT start upload', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna"
        email="anna@test.local"
      />,
    );

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/profilbild auswählen/i), file);

    expect(screen.getByTestId('avatar-crop-modal')).toBeInTheDocument();
    expect(modalProps.value?.file).toBe(file);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('crop confirm uploads the cropped Blob via _payload multipart', async () => {
    const user = userEvent.setup();
    const fakeJson = { doc: { id: 11, url: 'https://r2.example/cropped.jpg' } };
    const fakeRes = {
      ok: true,
      json: async () => fakeJson,
      text: async () => JSON.stringify(fakeJson),
    } as unknown as Response;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeRes);

    const { container } = render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna"
        email="anna@test.local"
      />,
    );

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/profilbild auswählen/i), file);

    const blob = new Blob(['cropped'], { type: 'image/jpeg' });
    modalProps.value!.onConfirm(blob);
    await new Promise((r) => setTimeout(r, 10));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const fd = init?.body as FormData;
    const uploaded = fd.get('file') as Blob;
    expect(uploaded).toBeInstanceOf(Blob);
    expect(uploaded.type).toBe('image/jpeg');
    // _payload-JSON struktur muss bestehen bleiben (PR #42 Regression-Guard)
    const payloadJson = fd.get('_payload');
    expect(typeof payloadJson).toBe('string');
    const parsed = JSON.parse(payloadJson as string) as { purpose: string };
    expect(parsed.purpose).toBe('avatar');
    expect(container.querySelector('input[name="avatar"]')).toHaveAttribute('value', '11');
    // Modal ist nach Confirm wieder weg
    expect(screen.queryByTestId('avatar-crop-modal')).not.toBeInTheDocument();
  });

  it('crop cancel removes modal, does NOT upload, resets file input', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna"
        email="anna@test.local"
      />,
    );

    const fileInput = screen.getByLabelText(/profilbild auswählen/i) as HTMLInputElement;
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    modalProps.value!.onCancel();
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByTestId('avatar-crop-modal')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fileInput.value).toBe('');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/component/AvatarUploadWidget.test.tsx
```

Expected: 5 FAILs — 3 neue Tests (Modal nicht vorhanden) + 2 alte Tests (`reset after upload` und `sends alt + purpose`) brechen, weil ihr Flow jetzt einen Modal-Confirm-Schritt erwartet, den die alte Widget-Logik noch nicht macht. Die 5 unveränderten Tests (initial-letter, currentAvatarUrl, size-error, MIME-error, remove-button) bleiben grün.

- [ ] **Step 3: Refactor AvatarUploadWidget**

Ersetze in `src/components/AvatarUploadWidget.tsx`:

1. Import oben ergänzen:

```tsx
import { AvatarCropModal } from './AvatarCropModal';
```

2. Erweitere `LocalState`:

```tsx
type LocalState =
  | { kind: 'persisted'; id: number; url: string }
  | { kind: 'replaced'; id: number; url: string }
  | { kind: 'removed' }
  | { kind: 'none' }
  | { kind: 'cropping'; file: File };
```

3. Ersetze `handleFileSelected` (Body komplett):

```tsx
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
```

4. Füge unter `handleFileSelected` zwei neue Handler ein:

```tsx
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
```

5. Render-Branch: am Ende des `<div className="space-y-3">` (nach dem inneren `</div>`, vor dem äußeren Schließen):

```tsx
      {state.kind === 'cropping' && (
        <AvatarCropModal
          file={state.file}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
```

- [ ] **Step 4: Run new tests to verify GREEN**

```bash
pnpm vitest run tests/component/AvatarUploadWidget.test.tsx
```

Expected: PASS (10/10 = 7 alt + 3 neu).

- [ ] **Step 5: Run full suite — no regression**

```bash
pnpm vitest run
```

Expected: **457/457 grün** (Baseline 448 nach PR #42 + 6 AvatarCropModal-Tests aus Task 1-3 + 3 neue AvatarUploadWidget-Tests aus Task 4 = 457). Falls Zahl abweicht wegen Zwischen-Merges: Hauptsache 0 Failures.

- [ ] **Step 6: Typecheck + Lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: clean. Lint-Warnings dürfen vom Baseline (53) nicht steigen.

- [ ] **Step 7: Commit**

```bash
git add src/components/AvatarUploadWidget.tsx tests/component/AvatarUploadWidget.test.tsx
git commit -m "feat(avatar-crop): integrate AvatarCropModal into upload widget"
```

---

### Task 5: Browser-Smoke-Test (manuell) + PR

**Files:** keine

- [ ] **Step 1: Dev-Server starten**

```bash
pnpm dev
```

- [ ] **Step 2: Smoke-Checks auf `http://localhost:3000/mein-bereich`** (eingeloggt als Contributor)

Verifiziere alle Punkte aus der Spec, Section „Browser-Smoke nach Deploy":

- [ ] iPhone-Portrait picken → Modal öffnet → Kopf nach unten ziehen → Übernehmen → Header-Avatar zeigt gewählten Ausschnitt
- [ ] Querformat-Foto picken → reinzoomen via Slider → übernehmen
- [ ] (Falls Touch-Device) Pinch-Zoom funktioniert in Safari iOS
- [ ] Cancel im Modal → File-Input zurückgesetzt → erneutes Picken funktioniert
- [ ] Escape-Key im Modal = Cancel
- [ ] Replacement-Flow: zweites Bild picken+croppen → altes R2-File weg (`pnpm payload migrate:status` oder Admin-UI `Media` durchgehen)
- [ ] Removal-Flow: „Bild entfernen" → Speichern → Initial-Letter zurück

- [ ] **Step 3: Push + Draft-PR**

```bash
git push -u origin feat/avatar-crop
gh pr create --draft --title "feat(avatar-crop): crop/zoom/pan UI for avatar upload" --body "$(cat <<'EOF'
## Summary

V1.6.1-UI-Polish — Client-seitiges Crop/Zoom/Pan-UI für Avatar-Uploads via `react-easy-crop` im Modal. File-Pick öffnet ein Modal (fixed 1:1, runde Preview-Maske, Zoom-Slider 1–3, Drag, Pinch). Übernehmen rendert 512×512 JPEG q90 via Canvas und reicht die Blob in den bestehenden Upload-Flow ein. Sharp-Hook server-seitig bleibt unverändert (Downsample 512→256, Safety-Net).

## Architektur

- Neue Component `AvatarCropModal` mit react-easy-crop 6.0.2 (~30 KB tree-shaken, MIT)
- `AvatarUploadWidget` erweitert um `'cropping'`-State zwischen File-Pick und Upload
- Server-Pfad (Media-Collection, Sharp-Hook, R2-Persist, Sub-C2-Hard-Delete) unverändert
- Output 512×512 statt 256×256 für Sharp-Headroom und Retina-Optionalität

## Plan-Deviations

<!-- Hier alle Abweichungen vom Plan dokumentieren (siehe Konvention PR #41/#36/#9) -->
- TODO beim Implementieren ausfüllen oder „Keine Deviations" eintragen

## Tests

- +6 AvatarCropModal-Component-Tests
- +3 AvatarUploadWidget-Component-Tests (Modal-Open, Crop-Confirm-Upload, Cancel)
- 2 bestehende Widget-Tests angepasst (zusätzlicher Modal-Confirm-Step nach File-Pick)
- 457/457 grün, `tsc --noEmit` clean, lint 0 errors

## Test Plan (Browser-Smoke nach Vercel-Preview)

- [ ] iPhone-Portrait picken → Modal öffnet → Kopf nach unten ziehen → Übernehmen → Header-Avatar zeigt gewählten Ausschnitt
- [ ] Querformat-Foto picken → reinzoomen via Slider → übernehmen
- [ ] Mobile Safari iOS: Pinch-Zoom funktioniert im Modal
- [ ] Cancel im Modal → File-Input zurückgesetzt → erneutes Picken funktioniert
- [ ] Escape-Key im Modal = Cancel
- [ ] Replacement-Flow: zweites Bild picken+croppen → altes R2-File weg (Sub-C2-Hard-Delete intakt)
- [ ] Removal-Flow: „Bild entfernen" → Speichern → Initial-Letter zurück

## Out-of-Scope (festgehalten in Spec)

- Re-Crop ohne Re-Upload (würde Original-Storage in R2 + Schema-Change erfordern)
- Free-Form-Crop, Multi-Size-Output, Filter, Rotation
- HEIC/HEIF-Support
- Crop für `article_image`-Uploads
- Lazy-Load des Modals via `next/dynamic`

## Spec + Plan

- `docs/superpowers/specs/2026-06-28-pflegeatlas-avatar-crop-design.md`
- `docs/superpowers/plans/2026-06-28-pflegeatlas-avatar-crop.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Nach Smoke-Approve: Draft → Ready-for-Review**

```bash
gh pr ready
```

---

## Plan-Deviations dokumentieren (im PR-Body)

Wenn beim Implementieren von einem Task-Step abgewichen wird, im PR-Body unter `## Plan-Deviations` festhalten (Konvention aus PR #41/#36/#9):

- Was abgewichen, warum (z.B. „Mock-Hoisting für react-easy-crop funktionierte nicht via vi.hoisted, Fallback auf let-Variable außerhalb describe")
- Welcher Task / Step

## Out-of-Scope (NICHT in diesem Plan, festgehalten aus Spec)

- Re-Crop ohne Re-Upload
- Free-Form-Crop / nicht-quadratisch
- Multi-Size-Output
- Filter, Brightness, Rotation
- HEIC/HEIF-Support
- Lazy-Load des Modals via `next/dynamic`
- Crop für `article_image`-Uploads
