# PflegeAtlas Avatar-Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementiere Avatar-Upload-Widget in `/mein-bereich` + Render-Branch in HeaderUserMenu + Orphan-Cleanup-Cron mit täglichem 24h-Grace-Sweep.

**Architecture:** Two-Step-UX: File-Picker → sofortiger Upload via Payload-Standard-API → Live-Preview → bei „Speichern" persistiert die Avatar-ID in `user.avatar`. Server-Side-Resize auf 256×256 JPEG via Sharp-Hook auf Media-Collection. Session enthält neues optionales `avatarUrl`-Feld. Orphan-Cleanup-Cron piggybackt auf den existierenden cleanup-submissions-Cron (Sub-C3-Pattern).

**Tech Stack:** Next.js 15 Server-Actions, Payload 3.85 Local-API + REST-Endpoint (`/api/media`), Sharp 0.34 für Resize, Vitest 4 + @testing-library/react für Tests, Tailwind v4 für Styling.

**Spec:** `docs/superpowers/specs/2026-06-27-pflegeatlas-avatar-upload-design.md`

**Branch:** `feat/avatar-upload` (bereits angelegt, Spec auf `d648557` committed)

---

## File Map

| Datei | Verantwortung |
|---|---|
| `src/collections/Media.ts` (modify) | Sharp-Resize-Hook auf `purpose='avatar'` + `mimeTypes`/`maxFileSize`-Config |
| `src/lib/auth.ts` (modify Z. 15-76) | `Session.avatarUrl?: string \| null` + `getSession()`-Join |
| `src/app/(frontend)/mein-bereich/actions.ts` (modify Z. 17-33) | `saveProfileFormAction` liest `avatar` aus FormData |
| `src/app/(frontend)/mein-bereich/page.tsx` (modify) | Reicht `user.avatar` + `user.avatarUrl` + `user.email` an ProfileEditForm |
| `src/components/AvatarUploadWidget.tsx` (CREATE) | Client-Component mit File-Picker, Preview, Upload, Remove |
| `src/components/ProfileEditForm.tsx` (modify) | Integriert `<AvatarUploadWidget>`, entfernt Placeholder-Hinweis |
| `src/components/HeaderUserMenu.tsx` (modify) | Render-Branch `<img>` vs Initial-Letter |
| `src/lib/avatar-orphan-cleanup.ts` (CREATE) | Helper `cleanupOrphanAvatars(payload): Promise<number>` |
| `src/lib/audit-log-cleanup.ts` (modify) | Signatur-Erweiterung `cleanupExpiredAuditLogs(payload, extraCounts?)` |
| `src/app/api/cron/cleanup-submissions/route.ts` (modify) | Wired `cleanupOrphanAvatars` zwischen submissions + audit |
| `tests/component/AvatarUploadWidget.test.tsx` (CREATE) | 6 Tests für Widget |
| `tests/component/HeaderUserMenu.test.tsx` (modify) | +2 Tests für avatarUrl-Branch |
| `tests/unit/avatar-orphan-cleanup.test.ts` (CREATE) | 3 Tests für Cleanup-Helper |
| `tests/integration/avatar-upload-flow.test.ts` (CREATE) | 4 Tests für End-to-End-Flow |

**Sub-C2-Reuse:** `src/lib/avatar-cleanup.ts` (`hardDeleteAvatar`) bleibt unverändert. `tests/helpers/avatar-fixture.ts` (`createAvatarFixture`) wird in den neuen Tests reused.

**Keine** Migration nötig. Keine neuen Payload-Collection-Felder. Sharp ist bereits installiert (`package.json` 0.34.2 + Payload-peer 0.32.6).

---

## Task 1: Sharp-Hook auf Media-Collection + Config

**Files:**
- Modify: `src/collections/Media.ts`
- Test: `tests/integration/avatar-upload-flow.test.ts` (CREATE für diese und folgende Backend-Tasks)

- [ ] **Step 1: Failing-Test schreiben — Sharp resized 1×1 PNG zu 256×256 JPEG**

Erstelle `tests/integration/avatar-upload-flow.test.ts`:

```ts
import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

// Minimal valid 1×1 RGB PNG (Sub-C2-Pattern aus avatar-fixture.ts)
const MINIMAL_PNG = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
  0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 13, 73, 68, 65, 84, 120,
  156, 99, 248, 255, 255, 63, 3, 0, 8, 252, 2, 254, 167, 154, 160, 160, 0, 0,
  0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

describe('avatar-upload backend', () => {
  it('resizes purpose=avatar upload to 256×256 JPEG via Sharp-Hook', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const created = await payload.create({
      collection: 'media',
      data: {
        alt: 'Test',
        purpose: 'avatar',
        uploadedBy: user.id,
      } as never,
      file: {
        data: MINIMAL_PNG,
        mimetype: 'image/png',
        name: `t-${Date.now()}.png`,
        size: MINIMAL_PNG.length,
      },
    });

    const doc = created as { id: number; width?: number; height?: number; mimeType?: string };
    expect(doc.width).toBe(256);
    expect(doc.height).toBe(256);
    expect(doc.mimeType).toBe('image/jpeg');
  });

  it('does NOT resize when purpose=article_image (only avatar gets resized)', async () => {
    const user = await createUserFixture(payload, 'editor');
    const created = await payload.create({
      collection: 'media',
      data: {
        alt: 'Article test',
        purpose: 'article_image',
        uploadedBy: user.id,
      } as never,
      file: {
        data: MINIMAL_PNG,
        mimetype: 'image/png',
        name: `art-${Date.now()}.png`,
        size: MINIMAL_PNG.length,
      },
    });

    const doc = created as { id: number; width?: number; height?: number; mimeType?: string };
    expect(doc.width).toBe(1);
    expect(doc.height).toBe(1);
    expect(doc.mimeType).toBe('image/png');
  });
});
```

- [ ] **Step 2: Tests laufen lassen, expect FAIL**

Run: `pnpm exec vitest run tests/integration/avatar-upload-flow.test.ts`
Expected: 2 failures — `expected 1 to be 256` (Sharp-Hook noch nicht im Code).

- [ ] **Step 3: Sharp-Hook + Upload-Config in Media.ts einbauen**

In `src/collections/Media.ts`:

1. Import oben ergänzen:
```ts
import sharp from 'sharp';
```

2. Im `hooks.beforeChange`-Array (nach dem existierenden uploadedBy-Hook) hinzufügen:

```ts
    async ({ data, req, operation }) => {
      if (!data || data.purpose !== 'avatar') return data;
      if (operation !== 'create' && operation !== 'update') return data;
      const file = (req as { file?: { data?: Buffer; mimetype?: string; filename?: string } }).file;
      if (!file?.data || !file.mimetype?.startsWith('image/')) return data;
      const resized = await sharp(file.data)
        .resize(256, 256, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      (req as { file?: { data: Buffer; mimetype: string; filename?: string } }).file = {
        data: resized,
        mimetype: 'image/jpeg',
        filename: file.filename?.replace(/\.[^.]+$/, '.jpg'),
      };
      return data;
    },
```

3. `upload: true` ersetzen durch:

```ts
  upload: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxFileSize: 5 * 1024 * 1024,
  },
```

- [ ] **Step 4: Tests grün?**

Run: `pnpm exec vitest run tests/integration/avatar-upload-flow.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Sub-C2-Avatar-Hard-Delete-Tests müssen weiter grün bleiben**

Run: `pnpm exec vitest run tests/integration/avatar-hard-delete.test.ts`
Expected: alle Tests grün. Avatar-Fixture (1×1 PNG) wird durch unseren Hook auf 256×256 JPEG resized, aber das affected die Hard-Delete-Logik nicht.

- [ ] **Step 6: Lint + tsc**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/collections/Media.ts tests/integration/avatar-upload-flow.test.ts
git commit -m "feat(media): sharp-resize purpose=avatar uploads to 256x256 JPEG"
```

---

## Task 2: getSession-Erweiterung mit avatarUrl-Join

**Files:**
- Modify: `src/lib/auth.ts` (Session interface Z. 15-22, getSession Z. 46-76)
- Test: `tests/integration/avatar-upload-flow.test.ts` (Tests anhängen)

- [ ] **Step 1: Failing-Tests für Session.avatarUrl schreiben**

In `tests/integration/avatar-upload-flow.test.ts` innerhalb des bestehenden `describe`-Blocks ergänzen:

```ts
  it('Session.avatarUrl is null when user has no avatar', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users',
      data: { email: user.email, password: user.password },
    });
    const { vi } = await import('vitest');
    vi.resetModules();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => (n === 'payload-token' ? { value: token } : undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.avatar).toBeNull();
    expect(session!.avatarUrl).toBeNull();
    vi.doUnmock('next/headers');
  });

  it('Session.avatarUrl contains URL when user has avatar', async () => {
    const { createAvatarFixture } = await import('../helpers/avatar-fixture');
    const user = await createUserFixture(payload, 'contributor');
    const avatar = await createAvatarFixture(payload, user.id);
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { avatar: avatar.id } as never,
    });
    const { token } = await payload.login({
      collection: 'users',
      data: { email: user.email, password: user.password },
    });
    const { vi } = await import('vitest');
    vi.resetModules();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => (n === 'payload-token' ? { value: token } : undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.avatar).toBe(avatar.id);
    expect(session!.avatarUrl).toMatch(/^https?:\/\/|^\//);
    vi.doUnmock('next/headers');
  });
```

- [ ] **Step 2: Tests laufen, expect FAIL (avatarUrl-Field gibt's noch nicht)**

Run: `pnpm exec vitest run tests/integration/avatar-upload-flow.test.ts -t "avatarUrl"`
Expected: 2 failures — `expect(session!.avatarUrl).toBeNull()` schlägt fehl mit `expected undefined to be null` (Field existiert noch nicht).

- [ ] **Step 3: Session-Interface erweitern**

In `src/lib/auth.ts` Z. 15-22 ersetzen:

```ts
export interface Session {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  disabled: boolean;
  avatar?: number | null;
  avatarUrl?: string | null;
}
```

- [ ] **Step 4: `getSession()`-Body erweitern**

In `src/lib/auth.ts` Z. 46-76 die `getSession()`-Function durch folgende Version ersetzen:

```ts
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('payload-token')?.value;
  if (!token) return null;
  try {
    const payload = await payloadInstance();
    const result = await payload.auth({
      headers: new Headers({ cookie: `payload-token=${token}` }),
    });
    const user = result.user;
    if (!user) return null;
    const u = user as {
      id: number; email: string; displayName?: string; role?: Role;
      disabled?: boolean;
      avatar?: number | { id: number; url?: string | null } | null;
    };
    const avatarRel = u.avatar;
    const avatarId =
      typeof avatarRel === 'object' && avatarRel ? avatarRel.id : (avatarRel ?? null);
    let avatarUrl: string | null = null;
    if (typeof avatarRel === 'object' && avatarRel?.url) {
      avatarUrl = avatarRel.url;
    } else if (typeof avatarRel === 'number') {
      try {
        const media = await payload.findByID({
          collection: 'media', id: avatarRel, depth: 0,
        });
        avatarUrl = (media as { url?: string | null }).url ?? null;
      } catch {
        avatarUrl = null;
      }
    }
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName ?? '',
      role: u.role ?? 'contributor',
      disabled: u.disabled ?? false,
      avatar: avatarId,
      avatarUrl,
    };
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[auth.getSession] unexpected error, returning null', err);
    }
    return null;
  }
}
```

- [ ] **Step 5: Tests grün?**

Run: `pnpm exec vitest run tests/integration/avatar-upload-flow.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Lint + tsc**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts tests/integration/avatar-upload-flow.test.ts
git commit -m "feat(auth): Session.avatarUrl with media-join"
```

---

## Task 3: saveProfileFormAction liest avatar aus FormData

**Files:**
- Modify: `src/app/(frontend)/mein-bereich/actions.ts` (Z. 17-33)
- Test: `tests/integration/avatar-upload-flow.test.ts` (anhängen)

- [ ] **Step 1: Failing-Tests für FormData-avatar-handling**

In `tests/integration/avatar-upload-flow.test.ts` anhängen:

```ts
  it('saveProfileFormAction persists avatar id from FormData and hard-deletes old', async () => {
    const { createAvatarFixture } = await import('../helpers/avatar-fixture');
    const user = await createUserFixture(payload, 'contributor');
    const oldAvatar = await createAvatarFixture(payload, user.id);
    const newAvatar = await createAvatarFixture(payload, user.id);
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { avatar: oldAvatar.id } as never,
    });

    const { token } = await payload.login({
      collection: 'users',
      data: { email: user.email, password: user.password },
    });
    const { vi } = await import('vitest');
    vi.resetModules();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => (n === 'payload-token' ? { value: token } : undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));

    const { saveProfileFormAction } = await import('@/app/(frontend)/mein-bereich/actions');
    const fd = new FormData();
    fd.append('displayName', user.displayName ?? 'Test');
    fd.append('avatar', String(newAvatar.id));
    const result = await saveProfileFormAction({}, fd);
    expect(result.saved).toBe(true);

    const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0 });
    const freshAvatar = (fresh as { avatar?: number | { id: number } | null }).avatar;
    const freshAvatarId =
      typeof freshAvatar === 'object' && freshAvatar ? freshAvatar.id : freshAvatar;
    expect(freshAvatarId).toBe(newAvatar.id);

    await expect(
      payload.findByID({ collection: 'media', id: oldAvatar.id }),
    ).rejects.toThrow();
    vi.doUnmock('next/headers');
    vi.doUnmock('next/cache');
  });

  it('saveProfileFormAction with empty avatar string sets user.avatar to null', async () => {
    const { createAvatarFixture } = await import('../helpers/avatar-fixture');
    const user = await createUserFixture(payload, 'contributor');
    const avatar = await createAvatarFixture(payload, user.id);
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { avatar: avatar.id } as never,
    });

    const { token } = await payload.login({
      collection: 'users',
      data: { email: user.email, password: user.password },
    });
    const { vi } = await import('vitest');
    vi.resetModules();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => (n === 'payload-token' ? { value: token } : undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));

    const { saveProfileFormAction } = await import('@/app/(frontend)/mein-bereich/actions');
    const fd = new FormData();
    fd.append('displayName', user.displayName ?? 'Test');
    fd.append('avatar', '');
    const result = await saveProfileFormAction({}, fd);
    expect(result.saved).toBe(true);

    const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0 });
    const freshAvatar = (fresh as { avatar?: number | { id: number } | null }).avatar;
    expect(freshAvatar ?? null).toBeNull();

    await expect(
      payload.findByID({ collection: 'media', id: avatar.id }),
    ).rejects.toThrow();
    vi.doUnmock('next/headers');
    vi.doUnmock('next/cache');
  });
```

- [ ] **Step 2: Tests laufen, expect FAIL**

Run: `pnpm exec vitest run tests/integration/avatar-upload-flow.test.ts -t "FormData"`
Expected: 2 failures — Avatar wird nicht aus FormData gelesen, also bleibt `user.avatar` auf altem Wert.

- [ ] **Step 3: `saveProfileFormAction` erweitern**

In `src/app/(frontend)/mein-bereich/actions.ts` Z. 17-33 ersetzen durch:

```ts
export async function saveProfileFormAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const avatarRaw = formData.get('avatar');
  const avatarIdParsed =
    typeof avatarRaw === 'string' && avatarRaw.length > 0
      ? Number.parseInt(avatarRaw, 10)
      : null;
  const avatar = Number.isFinite(avatarIdParsed) ? avatarIdParsed : null;

  const patch = {
    displayName: String(formData.get('displayName') ?? '') || undefined,
    bio: (formData.get('bio') as string | null) ?? undefined,
    pflegerischeRolle: (formData.get('pflegerischeRolle') as string | null) || null,
    bundesland: (formData.get('bundesland') as string | null) || null,
    avatar,
  };
  const result = await updateOwnProfileAction(patch);
  if (!result.ok) return { error: result.error };
  revalidatePath('/mein-bereich');
  return { saved: true };
}
```

- [ ] **Step 4: Tests grün?**

Run: `pnpm exec vitest run tests/integration/avatar-upload-flow.test.ts`
Expected: 6 passed (2 Sharp + 2 Session + 2 FormData).

- [ ] **Step 5: Lint + tsc**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(frontend\)/mein-bereich/actions.ts tests/integration/avatar-upload-flow.test.ts
git commit -m "feat(mein-bereich): saveProfileFormAction reads avatar from FormData"
```

---

## Task 4: AvatarUploadWidget Komponente + Tests (TDD)

**Files:**
- Create: `tests/component/AvatarUploadWidget.test.tsx`
- Create: `src/components/AvatarUploadWidget.tsx`

- [ ] **Step 1: Failing-Tests schreiben**

Erstelle `tests/component/AvatarUploadWidget.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvatarUploadWidget } from '@/components/AvatarUploadWidget';

describe('AvatarUploadWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial-letter when no avatar set', () => {
    render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna Musterfrau"
        email="anna@test.local"
      />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders <img> when currentAvatarUrl is set', () => {
    render(
      <AvatarUploadWidget
        currentAvatarUrl="https://r2.example/avatar.jpg"
        currentAvatarId={42}
        displayName="Anna"
        email="anna@test.local"
      />,
    );
    const img = screen.getByRole('img', { name: /aktuelles profilbild/i });
    expect(img).toHaveAttribute('src', 'https://r2.example/avatar.jpg');
  });

  it('shows error when file > 5 MB', async () => {
    const user = userEvent.setup();
    render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna"
        email="anna@test.local"
      />,
    );
    const big = new File(
      [new Uint8Array(6 * 1024 * 1024)],
      'big.png',
      { type: 'image/png' },
    );
    const fileInput = screen.getByLabelText(/profilbild auswählen/i);
    await user.upload(fileInput, big);
    expect(screen.getByRole('alert')).toHaveTextContent(/zu groß/i);
  });

  it('shows error for disallowed MIME type', async () => {
    const user = userEvent.setup();
    render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna"
        email="anna@test.local"
      />,
    );
    const gif = new File(['x'], 'animated.gif', { type: 'image/gif' });
    const fileInput = screen.getByLabelText(/profilbild auswählen/i);
    await user.upload(fileInput, gif);
    expect(screen.getByRole('alert')).toHaveTextContent(/jpeg, png oder webp/i);
  });

  it('remove button hides preview and sets hidden input to empty', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AvatarUploadWidget
        currentAvatarUrl="https://r2.example/avatar.jpg"
        currentAvatarId={42}
        displayName="Anna"
        email="anna@test.local"
      />,
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
    const removeBtn = screen.getByRole('button', { name: /bild entfernen/i });
    await user.click(removeBtn);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    const hidden = container.querySelector('input[name="avatar"]');
    expect(hidden).toHaveAttribute('value', '');
  });

  it('reset after upload returns to persisted state', async () => {
    const user = userEvent.setup();
    const fakeJson = { doc: { id: 99, url: 'https://r2.example/new.jpg' } };
    const fakeRes = {
      ok: true,
      json: async () => fakeJson,
      text: async () => JSON.stringify(fakeJson),
    } as unknown as Response;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeRes);

    const { container } = render(
      <AvatarUploadWidget
        currentAvatarUrl="https://r2.example/old.jpg"
        currentAvatarId={42}
        displayName="Anna"
        email="anna@test.local"
      />,
    );

    // Initial: persisted
    expect(container.querySelector('input[name="avatar"]')).toHaveAttribute('value', '42');

    // Upload new
    const file = new File(['x'], 'new.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/profilbild auswählen/i), file);
    expect(container.querySelector('input[name="avatar"]')).toHaveAttribute('value', '99');

    // Reset
    const resetBtn = screen.getByRole('button', { name: /auswahl zurücksetzen/i });
    await user.click(resetBtn);
    expect(container.querySelector('input[name="avatar"]')).toHaveAttribute('value', '42');
  });
});
```

- [ ] **Step 2: Tests laufen, expect FAIL**

Run: `pnpm exec vitest run tests/component/AvatarUploadWidget.test.tsx`
Expected: 6 failures — `Cannot find module '@/components/AvatarUploadWidget'`.

- [ ] **Step 3: Komponente implementieren**

Erstelle `src/components/AvatarUploadWidget.tsx`:

```tsx
'use client';

import { useState, useRef, type ChangeEvent } from 'react';

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
  | { kind: 'none' };

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
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('alt', `Profilbild von ${props.displayName || props.email}`);
      fd.append('purpose', 'avatar');
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
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
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
            accept="image/jpeg,image/png,image/webp"
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
    </div>
  );
}
```

- [ ] **Step 4: Tests grün?**

Run: `pnpm exec vitest run tests/component/AvatarUploadWidget.test.tsx`
Expected: 6 passed.

- [ ] **Step 5: Lint + tsc**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/AvatarUploadWidget.tsx tests/component/AvatarUploadWidget.test.tsx
git commit -m "feat(ui): AvatarUploadWidget with two-step upload + remove"
```

---

## Task 5: ProfileEditForm-Integration + page.tsx-Wire-Up

**Files:**
- Modify: `src/components/ProfileEditForm.tsx`
- Modify: `src/app/(frontend)/mein-bereich/page.tsx`

- [ ] **Step 1: Baseline — bestehende ProfileEditForm-Tests grün?**

Run: `pnpm exec vitest run tests/component/ProfileEditForm.test.tsx`
Expected: alle grün.

- [ ] **Step 2: ProfileEditForm-Props + JSX erweitern**

In `src/components/ProfileEditForm.tsx`:

1. Import oben hinzufügen (nach den anderen Imports):

```tsx
import { AvatarUploadWidget } from '@/components/AvatarUploadWidget';
```

2. Props-Typ erweitern (Z. 55-64):

```tsx
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
```

3. Im `<form>`-JSX (direkt nach `<form action={formAction} className="space-y-4">` Z. 70) einsetzen:

```tsx
      <AvatarUploadWidget
        currentAvatarUrl={user.avatarUrl ?? null}
        currentAvatarId={user.avatar ?? null}
        displayName={user.displayName ?? ''}
        email={user.email}
      />
```

4. Den Platzhalter-Hinweis entfernen (Z. 136-139):

```tsx
      <p className="text-xs text-stone-500">
        Avatar-Upload kommt mit V1.6.1. Datei-Upload via Admin-UI ist bereits
        möglich.
      </p>
```

- [ ] **Step 3: `/mein-bereich/page.tsx` an erweiterten Form anpassen**

Lies `src/app/(frontend)/mein-bereich/page.tsx`, suche den Call `<ProfileEditForm user={…} />`, erweitere das übergebene `user`-Objekt um `avatar`, `avatarUrl`, `email`. Konkret bedeutet das: aus `getSession()` (Server-Component) sind alle drei Felder verfügbar.

Beispiel-Edit für den ProfileEditForm-Call:

```tsx
<ProfileEditForm
  user={{
    displayName: session.displayName,
    bio: /* existierender bio-Fetch */,
    pflegerischeRolle: /* existierend */,
    bundesland: /* existierend */,
    avatar: session.avatar ?? null,
    avatarUrl: session.avatarUrl ?? null,
    email: session.email,
  }}
/>
```

(Konkrete Struktur muss der Implementer im File anpassen — vorhandene bio/pflegerischeRolle/bundesland-Reads bleiben unverändert, nur die drei neuen Felder ergänzen.)

- [ ] **Step 4: ProfileEditForm-Tests anpassen falls nötig**

Wenn die bestehenden `ProfileEditForm.test.tsx`-Tests das `user`-Prop ohne `email`/`avatar`/`avatarUrl` aufrufen, bricht TypeScript. Anpassen:

Run: `pnpm exec vitest run tests/component/ProfileEditForm.test.tsx`
Falls TS-Errors: bestehende Test-Setup-Helper um die drei Felder erweitern (`email: 'test@example.com'`, `avatar: null`, `avatarUrl: null`).

- [ ] **Step 5: Tests grün?**

Run: `pnpm exec vitest run tests/component/ProfileEditForm.test.tsx tests/component/AvatarUploadWidget.test.tsx`
Expected: alle grün.

- [ ] **Step 6: Lint + tsc**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProfileEditForm.tsx src/app/\(frontend\)/mein-bereich/page.tsx tests/component/ProfileEditForm.test.tsx
git commit -m "feat(ui): wire AvatarUploadWidget into ProfileEditForm"
```

---

## Task 6: HeaderUserMenu Render-Branch + Tests

**Files:**
- Modify: `src/components/HeaderUserMenu.tsx`
- Modify: `tests/component/HeaderUserMenu.test.tsx`

- [ ] **Step 1: Failing-Tests schreiben**

In `tests/component/HeaderUserMenu.test.tsx` zwei neue Tests anhängen (innerhalb des bestehenden `describe`-Blocks). Konkreter Code:

```tsx
  it('rendert <img> wenn session.avatarUrl gesetzt', () => {
    const session = {
      id: 1,
      email: 'anna@test.local',
      displayName: 'Anna',
      role: 'contributor' as const,
      disabled: false,
      avatar: 42,
      avatarUrl: 'https://r2.example/avatar.jpg',
    };
    render(<HeaderUserMenu session={session} />);
    const img = screen.getByRole('img', { name: /profilbild von anna/i });
    expect(img).toHaveAttribute('src', 'https://r2.example/avatar.jpg');
  });

  it('rendert Initial-Letter wenn session.avatarUrl null ist', () => {
    const session = {
      id: 1,
      email: 'anna@test.local',
      displayName: 'Anna',
      role: 'contributor' as const,
      disabled: false,
      avatar: null,
      avatarUrl: null,
    };
    render(<HeaderUserMenu session={session} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Tests laufen, expect FAIL für `<img>`-Test (Initial-Letter-Test passt vermutlich schon, weil das Verhalten heute identisch ist)**

Run: `pnpm exec vitest run tests/component/HeaderUserMenu.test.tsx`
Expected: 1 failure — kein `<img>` gerendert, weil HeaderUserMenu das noch nicht kann.

- [ ] **Step 3: HeaderUserMenu Render-Branch einbauen**

In `src/components/HeaderUserMenu.tsx` Z. 21-26 (das Initial-`<div>`) ersetzen durch:

```tsx
      {session.avatarUrl ? (
        <img
          src={session.avatarUrl}
          alt={`Profilbild von ${session.displayName || session.email}`}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white"
        >
          {initial}
        </div>
      )}
```

- [ ] **Step 4: Tests grün?**

Run: `pnpm exec vitest run tests/component/HeaderUserMenu.test.tsx`
Expected: alle grün (vorher 5 + jetzt 2 neue = 7).

- [ ] **Step 5: Lint + tsc**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/HeaderUserMenu.tsx tests/component/HeaderUserMenu.test.tsx
git commit -m "feat(ui): HeaderUserMenu renders <img> when avatarUrl set"
```

---

## Task 7: cleanupOrphanAvatars-Helper + Unit-Tests

**Files:**
- Create: `tests/unit/avatar-orphan-cleanup.test.ts`
- Create: `src/lib/avatar-orphan-cleanup.ts`

- [ ] **Step 1: Failing-Tests schreiben**

Erstelle `tests/unit/avatar-orphan-cleanup.test.ts`:

```ts
import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';
import { createAvatarFixture } from '../helpers/avatar-fixture';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('cleanupOrphanAvatars', () => {
  it('deletes avatar-media without user-reference older than 24h', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const avatar = await createAvatarFixture(payload, user.id);
    // Backdate createdAt by 25h via direct DB
    const pgPool = (payload.db as { pool: { query: (s: string, p: unknown[]) => Promise<unknown> } }).pool;
    await pgPool.query(
      'UPDATE media SET created_at = NOW() - INTERVAL \'25 hours\' WHERE id = $1',
      [avatar.id],
    );

    const { cleanupOrphanAvatars } = await import('@/lib/avatar-orphan-cleanup');
    const deleted = await cleanupOrphanAvatars(payload);
    expect(deleted).toBeGreaterThanOrEqual(1);

    await expect(
      payload.findByID({ collection: 'media', id: avatar.id }),
    ).rejects.toThrow();
  });

  it('keeps avatar-media that IS referenced by a user', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const avatar = await createAvatarFixture(payload, user.id);
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { avatar: avatar.id } as never,
    });
    const pgPool = (payload.db as { pool: { query: (s: string, p: unknown[]) => Promise<unknown> } }).pool;
    await pgPool.query(
      'UPDATE media SET created_at = NOW() - INTERVAL \'25 hours\' WHERE id = $1',
      [avatar.id],
    );

    const { cleanupOrphanAvatars } = await import('@/lib/avatar-orphan-cleanup');
    await cleanupOrphanAvatars(payload);

    const stillThere = await payload.findByID({ collection: 'media', id: avatar.id });
    expect(stillThere).toBeTruthy();
  });

  it('keeps avatar-media younger than 24h (grace period)', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const avatar = await createAvatarFixture(payload, user.id);
    // createdAt = now (default) → in der Grace-Period

    const { cleanupOrphanAvatars } = await import('@/lib/avatar-orphan-cleanup');
    await cleanupOrphanAvatars(payload);

    const stillThere = await payload.findByID({ collection: 'media', id: avatar.id });
    expect(stillThere).toBeTruthy();
  });
});
```

- [ ] **Step 2: Tests laufen, expect FAIL**

Run: `pnpm exec vitest run tests/unit/avatar-orphan-cleanup.test.ts`
Expected: 3 failures — `Cannot find module '@/lib/avatar-orphan-cleanup'`.

- [ ] **Step 3: Helper implementieren**

Erstelle `src/lib/avatar-orphan-cleanup.ts`:

```ts
import type { Payload } from 'payload';
import { hardDeleteAvatar } from './avatar-cleanup';

/**
 * V1.6.1 — räumt orphan avatar-media auf. Two-Step-Upload-UX kann
 * Avatar-Media in R2 ablegen, die nie an einen User attached wurden
 * (User upload't, schließt Tab, vergisst „Speichern"). Cron sweep'd
 * sie nach 24h Grace-Period.
 */
const GRACE_PERIOD_HOURS = 24;

export async function cleanupOrphanAvatars(payload: Payload): Promise<number> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_HOURS * 60 * 60 * 1000).toISOString();
  const candidates = await payload.find({
    collection: 'media',
    where: {
      and: [
        { purpose: { equals: 'avatar' } },
        { createdAt: { less_than: cutoff } },
      ],
    },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  });

  let deletedCount = 0;
  for (const candidate of candidates.docs as Array<{ id: number; uploadedBy?: number | null }>) {
    const referencing = await payload.find({
      collection: 'users',
      where: { avatar: { equals: candidate.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (referencing.docs.length > 0) continue;

    await hardDeleteAvatar(payload, candidate.id, {
      userId: candidate.uploadedBy ?? null,
      trigger: 'orphan-cleanup',
    });
    deletedCount++;
  }

  return deletedCount;
}
```

- [ ] **Step 4: Tests grün?**

Run: `pnpm exec vitest run tests/unit/avatar-orphan-cleanup.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Lint + tsc**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/avatar-orphan-cleanup.ts tests/unit/avatar-orphan-cleanup.test.ts
git commit -m "feat(cron): cleanupOrphanAvatars helper (24h grace)"
```

---

## Task 8: Wire Orphan-Cleanup in Cron-Route + cleanupExpiredAuditLogs-Signatur

**Files:**
- Modify: `src/lib/audit-log-cleanup.ts`
- Modify: `src/app/api/cron/cleanup-submissions/route.ts`

- [ ] **Step 1: `cleanupExpiredAuditLogs`-Signatur erweitern**

In `src/lib/audit-log-cleanup.ts` die Function ersetzen durch:

```ts
import type { Payload } from 'payload';
import { writeAuditLog } from './audit-log';

const RETENTION_DAYS = 90;

export async function cleanupExpiredAuditLogs(
  payload: Payload,
  extraCounts?: { orphanAvatarsDeleted?: number; submissionsDeleted?: number },
): Promise<number> {
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = new Date(cutoffMs).toISOString();

  const result = await payload.delete({
    collection: 'audit-logs',
    where: { createdAt: { less_than: cutoff } },
    overrideAccess: true,
  });
  const deletedCount = (result as { docs?: unknown[] }).docs?.length ?? 0;

  await writeAuditLog(payload, {
    eventType: 'audit.cleanup.run',
    metadata: {
      deletedCount,
      retentionDays: RETENTION_DAYS,
      ...(extraCounts ?? {}),
    },
  });

  return deletedCount;
}
```

- [ ] **Step 2: Cron-Route erweitern**

In `src/app/api/cron/cleanup-submissions/route.ts` Imports oben hinzufügen:

```ts
import { cleanupOrphanAvatars } from '@/lib/avatar-orphan-cleanup';
```

Im `GET`-Handler nach `cleanupRejectedSubmissions(payload)` und VOR `cleanupExpiredAuditLogs(payload)` einsetzen:

```ts
  let orphanAvatarsDeleted: number;
  try {
    orphanAvatarsDeleted = await cleanupOrphanAvatars(payload);
  } catch (err) {
    console.error('[cleanup-orphan-avatars] failed', err);
    return Response.json(
      {
        submissionsDeleted: submissionsResult.deletedCount,
        submissionsErrors: submissionsResult.errors,
        orphanAvatarError: (err as Error).message,
      },
      { status: 500 },
    );
  }
```

Den `cleanupExpiredAuditLogs`-Call mit den Extra-Counts erweitern:

```ts
  let auditDeleted: number;
  try {
    auditDeleted = await cleanupExpiredAuditLogs(payload, {
      orphanAvatarsDeleted,
      submissionsDeleted: submissionsResult.deletedCount,
    });
  } catch (err) {
    console.error('[cleanup-audit-logs] failed', err);
    return Response.json(
      {
        submissionsDeleted: submissionsResult.deletedCount,
        submissionsErrors: submissionsResult.errors,
        orphanAvatarsDeleted,
        auditError: (err as Error).message,
      },
      { status: 500 },
    );
  }
```

Final-Response erweitern:

```ts
  return Response.json({
    submissionsDeleted: submissionsResult.deletedCount,
    submissionsErrors: submissionsResult.errors,
    orphanAvatarsDeleted,
    auditDeleted,
  });
```

- [ ] **Step 3: Existierende Sub-C3-Tests müssen weiter grün bleiben**

Run: `pnpm exec vitest run tests/unit/audit-log-cleanup.test.ts tests/integration/audit-log-triggers.test.ts`
Expected: alle grün.

- [ ] **Step 4: Lint + tsc**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit-log-cleanup.ts src/app/api/cron/cleanup-submissions/route.ts
git commit -m "feat(cron): orphan-avatars piggyback + extended audit.cleanup.run metadata"
```

---

## Task 9: Full-Suite Verification

**Files:** (keine Code-Changes, nur Verifikation)

- [ ] **Step 1: Komplette Test-Suite**

Run: `pnpm test`
Expected: alle grün. Baseline 430 → mit +6 (AvatarUploadWidget) +2 (HeaderUserMenu) +3 (orphan-cleanup-unit) +6 (avatar-upload-flow-integration) = **447 Tests**.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: 0 Errors (pre-existing Warnings sind OK).

- [ ] **Step 3: Type-Check**

Run: `pnpm exec tsc --noEmit`
Expected: 0 Errors.

- [ ] **Step 4: Branch-Status**

Run: `git log feat/avatar-upload ^main --oneline`
Expected: 9 Commits (Spec + Plan + Task 1-7 Code-Commits). Task 8 + 9 sind die letzten Schritte (Task 8 hat 1 Commit, Task 9 hat 0).

Tatsächlich: 1 (Spec) + 1 (Plan) + 8 (Tasks 1-8) = **10 Commits**.

- [ ] **Step 5: Manual Smoke (optional)**

```bash
# Dev-Server starten (Dev-DB läuft via Docker postgres):
pnpm dev
# Browser-Test:
# 1. http://localhost:3000/anmelden als Test-Contributor einloggen
# 2. /mein-bereich → AvatarUploadWidget sichtbar
# 3. Datei picken (5 MB iPhone-Foto) → Upload → Preview tauscht
# 4. „Speichern" → Page revalidiert → persisted-Avatar im Widget
# 5. Header-Top-Right zeigt <img> statt Initial-Letter
# 6. Anderes Foto picken → Upload → Speichern → altes Foto in R2 weg (manuell prüfen)
# 7. „Bild entfernen" → Speichern → Initial-Letter zurück
```

- [ ] **Step 6: Fertig — Branch ist bereit für PR.**

---

## Notes

- **Sub-C2-Lesson „Plan auf Feature-Branch":** Branch `feat/avatar-upload` ist bereits aktiv, Spec committed. Plan-Commit folgt aus diesem Skill.
- **Sub-C3-Lesson „Subagent-Driven mit per-Task-Code-Review":** Plan ist explizit so dimensioniert. Tasks 1-3 sind Backend-Chain (sequenziell), 4-6 Frontend (4 vor 5 wegen Dependency), 7-8 Cron (sequenziell). Inline-Execution geht auch — Feature ist mittelgroß.
- **Sub-C2-Lesson „Payload 3.85 image-size-Validator":** Avatar-Fixture `tests/helpers/avatar-fixture.ts` (existing) gibt valid 70-byte PNG. Reuse in Tasks 2, 3, 7.
- **Sub-C3-Pattern Cron-Piggyback:** Audit-Cleanup ist das Reference-Pattern für unser Orphan-Cleanup (selbe Cron-Route, dritter Helper).
- **Behavior-Verifikation:** Healthcheck-Script (`scripts/audit-log-healthcheck.sh`) zeigt nach Deploy automatisch die neuen `orphanAvatarsDeleted` + `submissionsDeleted` Metadata im Bonus-Block der `audit.cleanup.run`-Heartbeat-Events. Keine Code-Änderung nötig.
- **Keine Migration:** keine neuen Collection-Fields, keine Schema-Touches.
