# PflegeAtlas Avatar-Upload — Design

**Datum:** 2026-06-27
**Status:** Spec
**Scope:** V1.6.1-UI-Polish Item #2 — Avatar-Upload-UI in `/mein-bereich` + Render-Branch in HeaderUserMenu + Orphan-Cleanup-Cron
**Branch:** `feat/avatar-upload`

## Kontext

V1.6.1-Backlog: Frontend-Avatar-Upload-UI (`/mein-bereich`) — User können kein Profilbild setzen, weil das Upload-Widget fehlt. Sub-C2 hat den Hard-Delete-Pfad sauber gemacht (`hardDeleteAvatar` läuft auf Profile-Update + Account-Delete), aber das Frontend-Stück blieb offen. ProfileEditForm hat sogar einen TODO-Kommentar: „Avatar-Upload kommt mit V1.6.1." Heute den fixen.

HeaderUserMenu rendert nur Initial-Letter; Avatar wird nirgends als `<img>` angezeigt.

## Ziele

1. Two-Step-Upload-UX in ProfileEditForm: File-Picker → sofortiger Upload → Live-Preview → bei „Speichern" persistiert die Avatar-ID
2. Server-Side-Resize auf 256×256 JPEG via Sharp-Hook auf Media-Collection (Vercel-Image-Optimizer-Backlog-Item nebenbei adressiert)
3. HeaderUserMenu rendert `<img>` wenn Avatar gesetzt, sonst Initial-Letter (heute-Verhalten)
4. Orphan-Cleanup-Cron (täglich): löscht Avatar-Media-Docs ohne User-Reference + älter als 24h
5. Sub-C2-Hard-Delete-Pfad bleibt unverändert — wenn User neues Avatar speichert, wird altes synchron via `hardDeleteAvatar` entsorgt

## Non-Goals

- Crop-UI mit Zoom/Pan
- Multiple Sizes (header-32, profile-96, retina-128 — single 256×256 reicht für MVP)
- Drag-Drop-Upload (nur File-Picker)
- Webcam-Selfie-Capture
- Animierte GIF-Avatare (Avatar in 32×32 verwischt, MIME-Whitelist ohne GIF)
- HEIC-Support (iPhone-User exportieren manuell als JPEG)
- Next/Image-Integration für Avatar-URLs (256×256 ist klein genug, direktes `<img>`)
- Avatar in Submission/Article-Author-Badges (V2)
- Avatar-Initiale mit Random-Background-Color statt Brand-Color (Designer-Polish)
- `media.pflegeatlas.org` CDN-URL-Migration (Phase-2-Item)

## Safety / Security

- **MIME-Whitelist:** nur `image/jpeg`, `image/png`, `image/webp`. Kein SVG (XSS-Risk), kein GIF (animated), kein HEIC (Browser-Inkompatibilität).
- **Max-File-Size pre-Resize:** 5 MB. Payload-`maxFileSize` rejected größere Uploads bevor Sharp geladen wird (DoS-Schutz).
- **Resize-Output:** 256×256 cover-fit JPEG quality=85 mozjpeg → typisch ~50-100 KB pro Avatar.
- **Auth:** Payload-Standard `/api/media`-Endpoint mit Cookie-Auth. Access.create für `purpose='avatar'` ist bereits konfiguriert (contributor + höher haben `uploadAvatar`-Permission).
- **`uploadedBy` auto-set:** existierender `beforeChange`-Hook setzt `req.user.id`.

## Architektur

```
┌─ Browser ────────────────────────────────────────────────────┐
│                                                               │
│  ProfileEditForm (Client)                                     │
│  ┌────────────────────────────────────────────────┐          │
│  │ AvatarUploadWidget                             │          │
│  │ ├─ <Preview>: Current/New Avatar oder Initial │          │
│  │ ├─ <Input type="file">                         │          │
│  │ ├─ "Hochladen" → POST /api/media               │          │
│  │ │   ← {id, url} → setState({id, url})          │          │
│  │ ├─ <input hidden name="avatar" value={id}>     │          │
│  │ └─ "Bild entfernen" → setState(null)           │          │
│  └────────────────────────────────────────────────┘          │
│  Andere Felder (displayName, bio, …)                          │
│  [Speichern]                                                  │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     │  Two requests:
                     │   1. Upload: POST /api/media (multipart)
                     │   2. Submit: POST saveProfileFormAction(FormData mit avatar=<id>)
                     ▼
┌─ Next.js / Payload ──────────────────────────────────────────┐
│                                                               │
│  Payload Media-Endpoint /api/media                            │
│  ├─ Auth: Cookie → user                                       │
│  ├─ Access.create: hasRolePermission(role,'uploadAvatar')     │
│  ├─ beforeChange: setze uploadedBy = req.user.id              │
│  ├─ NEW: beforeChange (purpose='avatar') → Sharp-Resize       │
│  │       256×256 cover, JPEG-Quality 85                       │
│  └─ Returns: Media-Doc { id, url, … }                         │
│                                                               │
│  saveProfileFormAction (existing, erweitert)                  │
│  ├─ Liest formData.get('avatar') → number | null              │
│  ├─ Ruft updateOwnProfileAction({ avatar })                   │
│  │   → hardDeleteAvatar für altes (Sub-C2)                    │
│  └─ revalidatePath('/mein-bereich')                           │
│                                                               │
│  getSession() (existing, erweitert)                           │
│  └─ depth=1-Join → Session.avatarUrl: string | null           │
│                                                               │
│  HeaderUserMenu (Server-Component)                            │
│  └─ session.avatarUrl ? <img> : <InitialLetter>               │
│                                                               │
│  Cron /api/cron/cleanup-submissions (täglich 03:00 UTC)       │
│  ├─ cleanupRejectedSubmissions (V1.7, unchanged)              │
│  ├─ NEW: cleanupOrphanAvatars (24h Grace-Period)              │
│  └─ cleanupExpiredAuditLogs (Sub-C3, erweiterte Metadata)     │
└──────────────────────────────────────────────────────────────┘
```

## Backend — Media-Sharp-Hook + Session-Join + Form-Action

### Media-Collection-Erweiterung (`src/collections/Media.ts`)

Sharp ist bereits installiert (Payload 3.85 peer dep). Falls nicht: `pnpm add sharp`.

```ts
import sharp from 'sharp';

hooks: {
  beforeChange: [
    // bestehender uploadedBy-Hook bleibt
    ({ data, req, operation }) => {
      if (!data) return data;
      if (operation === 'create' && req.user && !data.uploadedBy) {
        data.uploadedBy = (req.user as { id?: number }).id;
      }
      return data;
    },
    // NEU: Avatar-Resize auf Create/Update
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
  ],
},
upload: {
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxFileSize: 5 * 1024 * 1024,
},
```

### `getSession()`-Erweiterung (`src/lib/auth.ts`)

```ts
export interface Session {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  disabled: boolean;
  avatar?: number | null;       // ID bleibt (Backward-Compat)
  avatarUrl?: string | null;    // NEU: vorgejoined für Render
}
```

In `getSession()`-Body: lazy `findByID` für Media wenn `user.avatar` als Number returnt wird (depth=0). Wenn `payload.auth({headers, depth: 1})` supportet wird (Implementation-Check), depth=1 setzen — dann ist `avatarUrl` direkt aus der Relation lesbar ohne Extra-Query.

```ts
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
    avatarUrl = null;  // tolerate broken FK
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
```

**Cost-Impact:** Im Average-Case (User ohne Avatar): null Extra-Query. Mit Avatar: 1 leichter findByID. Akzeptabel.

### `saveProfileFormAction`-Erweiterung (`src/app/(frontend)/mein-bereich/actions.ts`)

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

`updateOwnProfileAction` akzeptiert `avatar?: number | null` bereits (Sub-C2). Kein Touch.

## Frontend — AvatarUploadWidget

**Neue Komponente:** `src/components/AvatarUploadWidget.tsx` (Client, ~120 Z.)

```tsx
'use client';
import { useState, useRef } from 'react';

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

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
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
      const res = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'same-origin' });
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

  function handleRemove() { setState({ kind: 'removed' }); setError(null); }
  function handleReset() { setState(initial); setError(null); }

  const hiddenValue =
    state.kind === 'persisted' || state.kind === 'replaced' ? String(state.id) : '';

  const preview = (() => {
    if (state.kind === 'persisted' || state.kind === 'replaced') {
      return <img src={state.url} alt="Aktuelles Profilbild" className="h-24 w-24 rounded-full object-cover" />;
    }
    const initialLetter = (props.displayName || props.email || '?').charAt(0).toUpperCase();
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand text-3xl font-semibold text-white" aria-hidden="true">
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
            <button type="button" onClick={handleRemove} className="text-sm text-red-700 underline">
              Bild entfernen
            </button>
          )}
          {state.kind === 'replaced' && (
            <button type="button" onClick={handleReset} className="ml-3 text-sm text-stone-600 underline">
              Auswahl zurücksetzen
            </button>
          )}
          {state.kind === 'removed' && (
            <p className="text-sm text-stone-600">
              Bild wird beim Speichern entfernt.{' '}
              <button type="button" onClick={handleReset} className="underline">Doch behalten</button>
            </p>
          )}
          <p className="text-xs text-stone-500">
            Max. 5 MB. JPEG, PNG oder WebP. Wird auf 256×256 verkleinert.
          </p>
          {uploading && <p className="text-sm text-stone-700">Lade hoch …</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
```

**State-Machine:**

| State | Bedeutung | Hidden-Input | Render |
|---|---|---|---|
| `none` | Nie ein Avatar | `""` | Initial-Letter |
| `persisted` | Avatar aus DB beim Page-Load | `id` | `<img>` |
| `replaced` | Neuer Upload, noch nicht gespeichert | `id (neu)` | `<img>` mit neuem URL |
| `removed` | „Entfernen" geklickt | `""` | Initial-Letter |

### ProfileEditForm-Integration

```tsx
import { AvatarUploadWidget } from '@/components/AvatarUploadWidget';

export function ProfileEditForm({ user }: {
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
  // …
  return (
    <form action={formAction} className="space-y-4">
      <AvatarUploadWidget
        currentAvatarUrl={user.avatarUrl ?? null}
        currentAvatarId={user.avatar ?? null}
        displayName={user.displayName ?? ''}
        email={user.email}
      />
      <div>
        <label htmlFor="displayName" …>Anzeigename</label>
        // … existing field
      </div>
      // … andere Felder
      // ENTFERNEN: <p>Avatar-Upload kommt mit V1.6.1.…</p>
      <SubmitButton />
    </form>
  );
}
```

**Call-Site-Update in `/mein-bereich/page.tsx`:** Server-Component reicht `user.avatar` + `user.avatarUrl` + `user.email` an `ProfileEditForm` weiter.

## HeaderUserMenu

```tsx
return (
  <div className="flex items-center gap-3">
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
    {/* … rest unverändert */}
  </div>
);
```

- Echtes `<img>` hat `alt`-Text statt `aria-hidden` (Initial ist dekoration; Bild ist Information).
- `object-cover` für Aspect-Sicherheit (falls altes Avatar nicht-quadratisch in DB hängt).
- Keine Next/Image — 256×256-Resized-File ist klein genug, direktes `<img>` reicht.

## Orphan-Cleanup-Cron

**Neuer Helper:** `src/lib/avatar-orphan-cleanup.ts` (~50 Z.)

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

**Wired in `src/app/api/cron/cleanup-submissions/route.ts`** (zwischen `cleanupRejectedSubmissions` und `cleanupExpiredAuditLogs`):

```ts
import { cleanupOrphanAvatars } from '@/lib/avatar-orphan-cleanup';

// nach cleanupRejectedSubmissions:
let orphanAvatarsDeleted: number;
try {
  orphanAvatarsDeleted = await cleanupOrphanAvatars(payload);
} catch (err) {
  console.error('[cleanup-orphan-avatars] failed', err);
  return Response.json({
    submissionsDeleted: submissionsResult.deletedCount,
    submissionsErrors: submissionsResult.errors,
    orphanAvatarError: (err as Error).message,
  }, { status: 500 });
}

// dann cleanupExpiredAuditLogs mit erweiterten counts:
const auditDeleted = await cleanupExpiredAuditLogs(payload, {
  orphanAvatarsDeleted,
  submissionsDeleted: submissionsResult.deletedCount,
});
```

**`cleanupExpiredAuditLogs`-Signatur erweitert** (`src/lib/audit-log-cleanup.ts`): nimmt optional `extraCounts: { orphanAvatarsDeleted, submissionsDeleted }` und schreibt sie in den `audit.cleanup.run`-Heartbeat-metadata.

```ts
export async function cleanupExpiredAuditLogs(
  payload: Payload,
  extraCounts?: { orphanAvatarsDeleted?: number; submissionsDeleted?: number },
): Promise<number> {
  // … bestehende Cleanup-Logik
  await writeAuditLog(payload, {
    eventType: 'audit.cleanup.run',
    metadata: {
      deletedCount,
      retentionDays: 90,
      ...(extraCounts ?? {}),
    },
  });
  return deletedCount;
}
```

**Vorteil:** Healthcheck-Script (`scripts/audit-log-healthcheck.{sh,ts}`) zeigt automatisch die neuen Zahlen im Bonus-Block — ohne Code-Change.

## Tests

### Unit / Component

- **`tests/component/AvatarUploadWidget.test.tsx` (NEU, 6 Tests):**
  - Rendert Initial-Letter wenn kein Avatar gesetzt
  - Rendert `<img>` wenn `currentAvatarUrl` gesetzt
  - Zeigt Fehler bei zu großem File (>5 MB)
  - Zeigt Fehler bei falschem MIME-Type
  - Toggelt state.kind=removed bei „Bild entfernen" + Hidden-Input wird leer
  - Reset bringt state zurück auf initial
- **`tests/component/HeaderUserMenu.test.tsx` (existing, +2 Tests):**
  - Rendert `<img>` wenn `session.avatarUrl` gesetzt
  - Rendert Initial-Letter wenn `session.avatarUrl` null ist
- **`tests/unit/avatar-orphan-cleanup.test.ts` (NEU, 3 Tests):**
  - Löscht avatar-media ohne User-Reference und älter als 24h
  - Lässt avatar-media mit User-Reference unangetastet
  - Lässt avatar-media jünger als 24h unangetastet

### Integration

- **`tests/integration/avatar-upload-flow.test.ts` (NEU, 4 Tests):**
  - User kann Avatar via Payload-Media-API hochladen
  - Sharp-Hook resized Avatar-Upload auf 256×256 JPEG
  - `updateOwnProfileAction` setzt `User.avatar`, alter Avatar wird hart gelöscht (Sub-C2-Regression)
  - `saveProfileFormAction` mit `avatar=""` setzt `User.avatar = null`

- **`tests/integration/auth-session.test.ts` (existing oder NEU, +2 Tests):**
  - Session enthält `avatarUrl` wenn User Avatar gesetzt hat
  - Session `avatarUrl` ist null wenn User keinen Avatar hat

**Test-Fixture:** `tests/helpers/avatar-fixture.ts` (existing aus Sub-C2) — 70-Byte valid 1×1 RGB PNG für Payload-`image-size`-Validator.

### Smoke-Manual (vor Merge)

1. `/anmelden` → einloggen als Test-Contributor
2. `/mein-bereich` → AvatarUploadWidget sichtbar, Initial-Letter wenn noch kein Avatar
3. Datei picken (5 MB iPhone-Foto) → „Upload läuft …" → Preview tauscht zu 256×256-Avatar
4. „Speichern" → Page revalidiert → AvatarUploadWidget zeigt persisted-Avatar
5. Header-Top-Right zeigt jetzt `<img>` statt Initial-Letter
6. Anderes Foto picken → Upload → Speichern → altes Foto in R2 weg
7. „Bild entfernen" → Speichern → Avatar weg, Initial-Letter zurück
8. Logout → Login → Avatar bleibt persisted

### Erwartete Test-Counts

- Vorher: 430 grün
- Neu: +6 (AvatarUploadWidget) +2 (HeaderUserMenu) +3 (orphan-cleanup-unit) +4 (upload-flow-integration) +2 (session) = **+17**
- Ziel: **~447 grün**

## Edge-Cases

- **Hochgeladen, aber nicht gespeichert:** Media-Doc orphan → Cron-Sweep nach 24h.
- **Hochgeladen, „Bild entfernen", gespeichert:** alter Avatar via Sub-C2 hartgelöscht; neu-hochgeladenes Media-Doc orphan → Cron-Sweep.
- **Server-Resize-Failure** (corrupt image, sharp wirft): Payload-Hook-Fehler → 500 auf `/api/media` → Client zeigt „Upload fehlgeschlagen". Bestehender Avatar unverändert.
- **Concurrent Upload + Refresh:** zweite Tab zeigt veraltetes Avatar bis revalidation. Akzeptiert.
- **Profilbild eines gelöschten Users im Header:** Account-Delete macht sofort `clearAuthCookie()` → HeaderUserMenu rendert anonymen Branch.
- **R2-Outage:** Upload schlägt fehl, Client zeigt Error. Bestehende Avatare bleiben sichtbar (Browser-Cache + R2-Read-Path).
- **iPhone HEIC-Upload:** kein MIME-Match → Client-Side-Error mit klarer Message.
- **User upload't 100-MB-Datei:** Payload `maxFileSize: 5 MB` rejected vor Sharp-Load.

## Risks

| Risiko | Wahrsch. | Mitigation |
|---|---|---|
| Orphan-Media füllt R2-Free-Quota | mittel (Two-Step-UX-eigen) | **Cron-Sweep nach 24h Grace** (in-Scope) |
| Sharp dep nicht installiert / falsche Version | niedrig | `pnpm add sharp` falls peer-warn; Payload 3.85 hat peer dep |
| getSession-Join-Cost wird spürbar | niedrig | Lazy nur wenn `user.avatar` set; `payload.auth({depth:1})` als Optimization |
| Hard-Delete-Hook beschädigt sich beim Avatar-Set-Test | niedrig | Sub-C2-Tests (`avatar-hard-delete.test.ts`) decken das ab; bleiben grün |
| Sharp-Library zu groß für Vercel-Function (50 MB-Limit) | niedrig | Sub-C2-Lesson: Sharp läuft bereits indirekt; sollte fit'en |
| XSS via SVG-Upload | niedrig | `mimeTypes`-Whitelist ohne SVG |
| Avatar-URL leaked an Editor+ via Media-Read-Access | low impact | Editor+ darf alle Avatare lesen (per existing design) |

## Phase-2-Portability

- Sharp läuft phasenneutral (Hetzner-Node hat keine Vercel-Lambda-Limits)
- R2 bleibt R2 (oder migriert nach S3-kompatibel — Payload-Adapter abstrahiert)
- `media.pflegeatlas.org` CDN-URL kann später eingeführt werden ohne Code-Change
- Cron-Schedule bleibt portierbar (Coolify hat eigenen Scheduler)

## Referenzen

- Brainstorm-Session: 2026-06-27 (diese Session)
- Sub-C2 Avatar-Hard-Delete: `src/lib/avatar-cleanup.ts`, `tests/integration/avatar-hard-delete.test.ts`, `tests/helpers/avatar-fixture.ts`
- Sub-C3 Audit-Cleanup-Piggyback-Pattern: `src/lib/audit-log-cleanup.ts`, `src/app/api/cron/cleanup-submissions/route.ts`
- Existierende Components: `src/components/ProfileEditForm.tsx`, `src/components/HeaderUserMenu.tsx`
- Media-Collection: `src/collections/Media.ts`
- Healthcheck-Script: `scripts/audit-log-healthcheck.{sh,ts}` (zeigt erweiterte Metadata automatisch)
