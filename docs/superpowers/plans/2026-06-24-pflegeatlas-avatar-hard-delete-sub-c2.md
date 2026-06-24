# Sub-C2 Avatar-Hard-Delete + Right-to-Erasure-Runbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avatar-Media-Doc + R2-File werden bei Account-Delete, Avatar-Removal und Avatar-Replacement im Profile hart gelöscht (statt nur `avatar: null` zu setzen). Plus Admin-Runbook + Helper-Script für echte Art.-17-Anfragen, die über Self-Service hinausgehen.

**Architecture:** Neuer Helper `hardDeleteAvatar` in `src/lib/avatar-cleanup.ts` kapselt `payload.delete({ collection: 'media', id })` mit try/catch + warn-Log. Drei Action-Pfade (`deleteOwnAccountAction` + `updateOwnProfileAction` für Removal/Replacement) rufen den Helper explizit auf. Failure-Mode: schlucken + loggen, Hauptaktion läuft durch (DSGVO-User-Recht hat Vorrang). Admin-Pfad bekommt MD-Runbook + Bash/TS-Script analog zu `seed-initial-admin.{sh,ts}`.

**Tech Stack:** Payload CMS Local API (`payload.delete`), `@payloadcms/storage-s3` (R2-Cleanup automatisch via After-Delete-Hook), Vitest, TypeScript strict, pnpm.

**Spec:** `docs/superpowers/specs/2026-06-24-pflegeatlas-avatar-hard-delete-sub-c2-design.md` (commit `5ef220f` auf `feat/sub-c2-avatar-hard-delete`)

---

## File Structure

| Datei | Rolle |
|---|---|
| `src/lib/avatar-cleanup.ts` | **Neu.** `hardDeleteAvatar` Helper. |
| `src/lib/auth.ts` | **Modify, Z. 351-405.** `deleteOwnAccountAction` + `updateOwnProfileAction`: Helper-Aufrufe einbauen. |
| `tests/helpers/avatar-fixture.ts` | **Neu.** `createAvatarFixture(payload, userId)` für Integration-Tests. |
| `tests/unit/avatar-cleanup.test.ts` | **Neu.** 4 Unit-Tests für `hardDeleteAvatar`. |
| `tests/integration/avatar-hard-delete.test.ts` | **Neu.** 4 Integration-Tests (Account-Delete + Removal + Replacement + No-op). |
| `docs/legal/right-to-erasure-runbook.md` | **Neu.** ~100 Zeilen 7-Section-Runbook. |
| `scripts/right-to-erasure.sh` | **Neu.** Bash-Wrapper. |
| `scripts/right-to-erasure.ts` | **Neu.** Payload-Local-API-Skript. |

`src/lib/user-soft-delete.ts` und `tests/integration/auth-delete-own-account.test.ts` bleiben unverändert (bestehende Tests nutzen User OHNE Avatar — wenn neuer Code-Pfad bei `oldAvatarId == null` no-op macht, bleibt alles grün).

---

## Task 1: `hardDeleteAvatar` Helper + Unit-Tests

**Files:**
- Create: `src/lib/avatar-cleanup.ts`
- Test: `tests/unit/avatar-cleanup.test.ts`

- [ ] **Step 1.1: Test-File anlegen mit 4 RED-Tests**

Create `tests/unit/avatar-cleanup.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Payload } from 'payload';
import { hardDeleteAvatar } from '@/lib/avatar-cleanup';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

function makeMockPayload(deleteImpl: (args: unknown) => Promise<unknown>): Payload {
  return { delete: vi.fn(deleteImpl) } as unknown as Payload;
}

describe('hardDeleteAvatar', () => {
  it('returns deleted=false and no warn-log when oldMediaId is null', async () => {
    const payload = makeMockPayload(async () => {
      throw new Error('should not be called');
    });
    const result = await hardDeleteAvatar(payload, null, { userId: 1, trigger: 'account-delete' });
    expect(result).toEqual({ deleted: false });
    expect(payload.delete).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns deleted=false and no warn-log when oldMediaId is undefined', async () => {
    const payload = makeMockPayload(async () => {
      throw new Error('should not be called');
    });
    const result = await hardDeleteAvatar(payload, undefined, { userId: 1, trigger: 'profile-update' });
    expect(result).toEqual({ deleted: false });
    expect(payload.delete).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns deleted=true and calls payload.delete on success', async () => {
    const payload = makeMockPayload(async () => ({ id: 42 }));
    const result = await hardDeleteAvatar(payload, 42, { userId: 7, trigger: 'account-delete' });
    expect(result).toEqual({ deleted: true });
    expect(payload.delete).toHaveBeenCalledWith({ collection: 'media', id: 42 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns deleted=false with error and warn-log on payload.delete reject', async () => {
    const payload = makeMockPayload(async () => {
      throw new Error('R2 outage');
    });
    const result = await hardDeleteAvatar(payload, 42, { userId: 7, trigger: 'profile-update' });
    expect(result.deleted).toBe(false);
    expect(result.error).toContain('R2 outage');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warnArg = warnSpy.mock.calls[0]?.[0];
    expect(String(warnArg)).toContain('avatar-cleanup');
    expect(String(warnArg)).toContain('userId=7');
    expect(String(warnArg)).toContain('media=42');
    expect(String(warnArg)).toContain('profile-update');
  });
});
```

- [ ] **Step 1.2: Tests laufen lassen, FAIL erwartet**

Run: `pnpm test tests/unit/avatar-cleanup.test.ts`
Expected: FAIL — `Cannot find module '@/lib/avatar-cleanup'` oder gleichwertig

- [ ] **Step 1.3: Helper implementieren**

Create `src/lib/avatar-cleanup.ts`:

```ts
import type { Payload } from 'payload';

export interface HardDeleteAvatarResult {
  deleted: boolean;
  error?: string;
}

export type HardDeleteAvatarTrigger = 'account-delete' | 'profile-update';

export interface HardDeleteAvatarContext {
  userId: number;
  trigger: HardDeleteAvatarTrigger;
}

function isNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name.toLowerCase();
  const msg = err.message.toLowerCase();
  return name.includes('notfound') || msg.includes('not found');
}

export async function hardDeleteAvatar(
  payload: Payload,
  oldMediaId: number | null | undefined,
  context: HardDeleteAvatarContext,
): Promise<HardDeleteAvatarResult> {
  if (oldMediaId === null || oldMediaId === undefined) {
    return { deleted: false };
  }
  try {
    await payload.delete({ collection: 'media', id: oldMediaId });
    return { deleted: true };
  } catch (err) {
    if (isNotFoundError(err)) {
      // Race / already gone — idempotent success, no warn.
      return { deleted: false };
    }
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[avatar-cleanup] failed to delete media=${oldMediaId} for userId=${context.userId} (trigger=${context.trigger}): ${message}`,
    );
    return { deleted: false, error: message };
  }
}
```

- [ ] **Step 1.4: Tests laufen lassen, PASS erwartet**

Run: `pnpm test tests/unit/avatar-cleanup.test.ts`
Expected: PASS — alle 4 Tests grün.

- [ ] **Step 1.5: Type-Check**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 1.6: Commit**

```bash
git add src/lib/avatar-cleanup.ts tests/unit/avatar-cleanup.test.ts
git commit -m "feat(avatar): add hardDeleteAvatar helper with warn-on-failure semantics"
```

---

## Task 2: `deleteOwnAccountAction`-Wiring + 2 Integration-Tests

**Files:**
- Modify: `src/lib/auth.ts:381-405`
- Create: `tests/helpers/avatar-fixture.ts`
- Create: `tests/integration/avatar-hard-delete.test.ts`

- [ ] **Step 2.1: Avatar-Fixture-Helper anlegen**

Create `tests/helpers/avatar-fixture.ts`:

```ts
import type { Payload } from 'payload';

export async function createAvatarFixture(
  payload: Payload,
  userId: number,
): Promise<{ id: number }> {
  const created = await payload.create({
    collection: 'media',
    data: {
      alt: 'Test avatar',
      purpose: 'avatar',
      uploadedBy: userId,
    } as never,
    file: {
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      mimetype: 'image/png',
      name: `avatar-${userId}-${Date.now()}.png`,
      size: 8,
    },
  });
  return { id: created.id as number };
}
```

(8-Byte-PNG-Header reicht; Dev hat keine R2-ENVs → s3Storage-Plugin nicht aktiv → Payload nutzt lokales FS als Fallback.)

- [ ] **Step 2.2: Integration-Test-File mit 2 RED-Tests anlegen**

Create `tests/integration/avatar-hard-delete.test.ts`:

```ts
import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';
import { createAvatarFixture } from '../helpers/avatar-fixture';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

function mockSessionCookie(token: string) {
  vi.doMock('next/headers', () => ({
    cookies: async () => ({
      get: (n: string) => (n === 'payload-token' ? { value: token } : undefined),
      set: vi.fn(),
      delete: vi.fn(),
    }),
  }));
}

describe('avatar hard-delete on account-delete', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hard-deletes avatar media when user deletes their account', async () => {
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
    mockSessionCookie(token);

    const { deleteOwnAccountAction } = await import('@/lib/auth');
    const result = await deleteOwnAccountAction('LÖSCHEN');
    expect(result.ok).toBe(true);

    await expect(
      payload.findByID({ collection: 'media', id: avatar.id }),
    ).rejects.toThrow();

    const refetched = await payload.findByID({ collection: 'users', id: user.id });
    expect((refetched as { disabled: boolean }).disabled).toBe(true);

    vi.doUnmock('next/headers');
  });

  it('no-ops gracefully when user has no avatar', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users',
      data: { email: user.email, password: user.password },
    });
    mockSessionCookie(token);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { deleteOwnAccountAction } = await import('@/lib/auth');
    const result = await deleteOwnAccountAction('LÖSCHEN');
    expect(result.ok).toBe(true);

    const avatarWarns = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('avatar-cleanup'),
    );
    expect(avatarWarns).toHaveLength(0);

    warnSpy.mockRestore();
    vi.doUnmock('next/headers');
  });
});
```

- [ ] **Step 2.3: Tests laufen lassen, FAIL erwartet**

Run: `pnpm test tests/integration/avatar-hard-delete.test.ts`
Expected: FAIL — der erste Test, weil `deleteOwnAccountAction` aktuell den Avatar nicht löscht (`payload.findByID({ collection: 'media', id })` returnt die noch-existierende Doc). Der zweite Test (no-op) passt mit hoher Wahrscheinlichkeit ZUFÄLLIG schon — auch ohne Code-Änderung. Das ist okay, der no-op-Pfad ist Defensive-Coverage.

- [ ] **Step 2.4: `deleteOwnAccountAction` umstellen**

In `src/lib/auth.ts`:

**Zuerst** die Import-Zeile für `data-export` (Z. 11) ergänzen oder eine neue Zeile dahinter einfügen:

```ts
import { hardDeleteAvatar } from './avatar-cleanup';
```

**Dann** `deleteOwnAccountAction` (Z. 381-405) komplett ersetzen durch:

```ts
export async function deleteOwnAccountAction(
  confirmation: string,
): Promise<{ ok: boolean; error?: string }> {
  'use server';
  try {
    if (confirmation !== 'LÖSCHEN') {
      return { ok: false, error: 'Bestätigung fehlt oder falsch.' };
    }
    const session = await requireUser();
    if (session.role === 'admin') {
      return { ok: false, error: 'Admin-Accounts können sich nicht selbst löschen.' };
    }
    const payload = await payloadInstance();

    // Avatar VOR der Anonymisierung hart löschen: anonymizeUserPatch
    // setzt zwar avatar:null, würde aber Media-Doc + R2-File als
    // Orphan zurücklassen. Failure schluckt der Helper.
    const current = await payload.findByID({ collection: 'users', id: session.id, depth: 0 });
    const currentAvatar = (current as { avatar?: number | { id: number } | null }).avatar;
    const currentAvatarId =
      typeof currentAvatar === 'object' && currentAvatar ? currentAvatar.id : (currentAvatar ?? null);
    await hardDeleteAvatar(payload, currentAvatarId, {
      userId: session.id,
      trigger: 'account-delete',
    });

    const patch = anonymizeUserPatch();
    await payload.update({
      collection: 'users',
      id: session.id,
      data: patch as never,
    });
    await clearAuthCookie();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Delete failed.' };
  }
}
```

- [ ] **Step 2.5: Integration-Tests laufen, PASS erwartet**

Run: `pnpm test tests/integration/avatar-hard-delete.test.ts`
Expected: PASS — beide Tests grün (Account-Delete + No-op).

- [ ] **Step 2.6: Commit**

```bash
git add src/lib/auth.ts tests/helpers/avatar-fixture.ts tests/integration/avatar-hard-delete.test.ts
git commit -m "feat(auth): hard-delete avatar in deleteOwnAccountAction (Sub-C2)"
```

---

## Task 3: `updateOwnProfileAction`-Wiring + 2 Integration-Tests

**Files:**
- Modify: `src/lib/auth.ts:351-379`
- Test: `tests/integration/avatar-hard-delete.test.ts` (append)

- [ ] **Step 3.1: 2 weitere Integration-Tests anhängen**

Am Ende von `tests/integration/avatar-hard-delete.test.ts`, nach dem schließenden `});` des bestehenden `describe`-Blocks, anhängen:

```ts
describe('avatar hard-delete on profile-update', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hard-deletes old avatar when user removes avatar (id → null)', async () => {
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
    mockSessionCookie(token);

    const { updateOwnProfileAction } = await import('@/lib/auth');
    const result = await updateOwnProfileAction({ avatar: null });
    expect(result.ok).toBe(true);

    await expect(
      payload.findByID({ collection: 'media', id: avatar.id }),
    ).rejects.toThrow();

    const refetched = await payload.findByID({ collection: 'users', id: user.id });
    expect((refetched as { avatar: number | null }).avatar).toBeNull();

    vi.doUnmock('next/headers');
  });

  it('hard-deletes old avatar when user replaces avatar (oldId → newId)', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const oldAvatar = await createAvatarFixture(payload, user.id);
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { avatar: oldAvatar.id } as never,
    });
    const newAvatar = await createAvatarFixture(payload, user.id);

    const { token } = await payload.login({
      collection: 'users',
      data: { email: user.email, password: user.password },
    });
    mockSessionCookie(token);

    const { updateOwnProfileAction } = await import('@/lib/auth');
    const result = await updateOwnProfileAction({ avatar: newAvatar.id });
    expect(result.ok).toBe(true);

    await expect(
      payload.findByID({ collection: 'media', id: oldAvatar.id }),
    ).rejects.toThrow();

    const newStill = await payload.findByID({ collection: 'media', id: newAvatar.id });
    expect((newStill as { id: number }).id).toBe(newAvatar.id);

    const refetched = await payload.findByID({ collection: 'users', id: user.id });
    const refAvatar = (refetched as { avatar: number | { id: number } | null }).avatar;
    const refAvatarId =
      typeof refAvatar === 'object' && refAvatar ? refAvatar.id : refAvatar;
    expect(refAvatarId).toBe(newAvatar.id);

    vi.doUnmock('next/headers');
  });
});
```

- [ ] **Step 3.2: Tests laufen lassen, FAIL erwartet**

Run: `pnpm test tests/integration/avatar-hard-delete.test.ts`
Expected: FAIL — die zwei neuen Tests fail-en, weil `updateOwnProfileAction` aktuell keinen Avatar-Cleanup macht. Die zwei Tests aus Task 2 bleiben grün.

- [ ] **Step 3.3: `updateOwnProfileAction` umstellen**

In `src/lib/auth.ts` die Funktion `updateOwnProfileAction` (Z. 351-379) komplett ersetzen durch:

```ts
export async function updateOwnProfileAction(
  data: OwnProfilePatch,
): Promise<{ ok: boolean; error?: string }> {
  'use server';
  try {
    const session = await requireUser();
    // Strict whitelist — only the 5 named fields are forwarded to Payload.
    // Any extra props (role, disabled, email, setPasswordToken, …) are
    // silently dropped even if passed via cast.
    const whitelisted: Record<string, unknown> = {};
    if (data.displayName !== undefined) whitelisted.displayName = data.displayName;
    if (data.bio !== undefined) whitelisted.bio = data.bio;
    if (data.pflegerischeRolle !== undefined) whitelisted.pflegerischeRolle = data.pflegerischeRolle;
    if (data.bundesland !== undefined) whitelisted.bundesland = data.bundesland;
    if (data.avatar !== undefined) whitelisted.avatar = data.avatar;
    if (Object.keys(whitelisted).length === 0) {
      return { ok: true };
    }
    const payload = await payloadInstance();

    // Avatar-Hard-Delete bei Removal (id → null) oder Replacement (oldId → newId).
    // Vor dem update lesen, damit wir den alten Wert kennen. Helper schluckt Fehler.
    if (data.avatar !== undefined) {
      const current = await payload.findByID({ collection: 'users', id: session.id, depth: 0 });
      const currentAvatar = (current as { avatar?: number | { id: number } | null }).avatar;
      const oldAvatarId =
        typeof currentAvatar === 'object' && currentAvatar ? currentAvatar.id : (currentAvatar ?? null);
      const newAvatarId = data.avatar ?? null;
      if (oldAvatarId !== null && oldAvatarId !== newAvatarId) {
        await hardDeleteAvatar(payload, oldAvatarId, {
          userId: session.id,
          trigger: 'profile-update',
        });
      }
    }

    await payload.update({
      collection: 'users',
      id: session.id,
      data: whitelisted as never,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Update failed.' };
  }
}
```

- [ ] **Step 3.4: Tests laufen lassen, PASS erwartet**

Run: `pnpm test tests/integration/avatar-hard-delete.test.ts`
Expected: PASS — alle 4 Tests grün (2 aus Task 2 + 2 neu).

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/auth.ts tests/integration/avatar-hard-delete.test.ts
git commit -m "feat(auth): hard-delete old avatar in updateOwnProfileAction on remove/replace (Sub-C2)"
```

---

## Task 4: Voll-Test-Lauf + tsc + Lint

**Files:** keine.

- [ ] **Step 4.1: Voll-Test-Lauf**

Run: `pnpm test`
Expected: alle Tests grün. Vorher 375/375 (Sub-C1-merged). Erwartet jetzt: **383/383 grün** = 375 + 4 Unit + 4 Integration.

Falls Tests im bestehenden `tests/integration/auth-delete-own-account.test.ts` brechen: vermutlich nicht — bestehende Tests nutzen User OHNE Avatar, der neue Code-Pfad macht silent no-op. Falls doch Bruch: Test-Fixture nutzt User ohne Avatar (sollte by default sein).

- [ ] **Step 4.2: tsc**

Run: `pnpm exec tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4.3: lint**

Run: `pnpm lint`
Expected: 0 errors (Warnings unverändert OK; aktuell 51 Warnings vorbestehend).

- [ ] **Step 4.4: Hinweis bei Pollution**

Wenn lokale Dev-DB durch wiederholte Test-Läufe Media-Orphans angesammelt hat (R2-Pendant existiert lokal nicht, weil Dev kein R2 hat — alles im FS-Fallback unter `media/` Verzeichnis): kein akutes Problem. Falls Storage-Cleanup gewünscht:

```bash
docker exec pflegecommons-postgres psql -U pflege -d pflegecommons \
  -c "DELETE FROM media WHERE alt = 'Test avatar';"
```

Optional, nur bei sichtbarem Drift.

---

## Task 5: Admin-Runbook

**Files:**
- Create: `docs/legal/right-to-erasure-runbook.md`

- [ ] **Step 5.1: Runbook anlegen**

Create `docs/legal/right-to-erasure-runbook.md`:

```markdown
# Right-to-Erasure-Runbook (Art. 17 DSGVO)

**Stand:** 2026-06-24
**Adressaten:** Admins (Oliver, Christoph)
**Gilt für:** PflegeAtlas Phase 1 (Vercel + Neon + R2)

---

## 1. Wann anwenden

Self-Service deckt den Standardfall ab: User klickt in `/mein-bereich`
auf „Konto löschen" → Account wird anonymisiert (Name, E-Mail,
Profilbild weg; Beiträge bleiben als „Gelöschte:r Beitragende:r"
verlinkt). Avatar-Media-Doc + R2-File werden automatisch hart gelöscht
(Sub-C2).

Dieses Runbook gilt nur, wenn eine User-Anfrage per Mail über die
Self-Service-Anonymisierung hinausgeht — z.B. wenn explizit gefordert
wird, dass auch die Authorship-Verlinkung auf veröffentlichten Artikeln
entfernt werden soll (echtes Hard-Delete).

## 2. Identitätsprüfung

- Die Anfrage muss von der Account-E-Mail-Adresse kommen, die der User
  bei uns registriert hat.
- Bei Zweifel (z.B. Mail kommt von anderer Adresse, oder User behauptet,
  Account-Zugang verloren zu haben): Rückbestätigung anfordern. Z.B.
  Magic-Link an die Account-E-Mail senden mit Bestätigungs-Text.
- **Nicht ausreichen** als Identitätsbeweis: Display-Name, IP-Adresse,
  Beitrag-Inhalt.
- Bei begründetem Verdacht auf Identitätsmissbrauch: ablehnen mit
  Verweis auf §11 DSGVO (Anforderungen an Identifizierung).

## 3. Scope-Klärung mit User

Vor Ausführung mit User klären, was genau gelöscht werden soll. Drei
Stufen sind möglich:

**Stufe A: Anonymisierung (Self-Service-äquivalent)**
- Account → disabled + anonymisierter Name + Avatar weg.
- Beiträge bleiben unter „Gelöschte:r Beitragende:r" verlinkt.
- → Section 5.

**Stufe B: Anonymisierung + Authorship-Entfernung**
- Wie A, plus: User aus `Articles.authors` rauslöschen.
- CC-BY-SA-Lizenz-Konflikt: Lizenz erfordert Namensnennung der
  Autor:innen. Wenn User selbst die Nennung zurückzieht, ist
  „Gelöschte:r Beitragende:r" eine vertretbare Lösung — aber ein
  vollständiges Entfernen der Authorship würde die Lizenz brechen.
  **Mit User durchsprechen** und schriftlich (per Mail) bestätigen
  lassen, dass auf Namensnennung verzichtet wird.
- → Section 6.

**Stufe C: Vollständiges Hard-Delete (DB-Row)**
- Wie B, plus: User-Row, Submissions, alle FK-Verweise hart gelöscht.
- Praktisch oft NICHT möglich, weil veröffentlichte Articles per
  V1.5-GitHub-Sync schon auf GitHub gespiegelt sind („dauerhaft
  öffentlich, unwiderruflich"). Art. 17 Abs. 3 lit. a DSGVO greift
  hier (Recht auf freie Meinungsäußerung + öffentliches Interesse).
- **Mit User durchsprechen** dass GitHub-Mirror irreversibel ist.
- → Section 6 + manueller GitHub-Repo-Eingriff.

## 4. DSGVO-Frist

- 1 Monat ab Eingang der Anfrage (Art. 12 Abs. 3 DSGVO).
- Bei Komplexität / hohem Aufwand: +2 Monate, **muss aber innerhalb
  des ersten Monats schriftlich mit Begründung an User mitgeteilt**
  werden.
- Status der Anfrage protokollieren (bis Sub-C3 Audit-Log existiert:
  handschriftlich in 1Password-Vault unter „DSGVO-Anfragen").

## 5. Stufe A — Anonymisierung via Script

Empfohlener Weg: `scripts/right-to-erasure.{sh,ts}`.

```bash
bash scripts/right-to-erasure.sh user@example.de
```

Das Skript:
1. Sucht User per E-Mail.
2. Zeigt Vorschau-Block (User-Felder, Avatar-Media-ID, Counts
   Submissions / Article-Authorships).
3. Verlangt `Type "ERASE user@example.de" to confirm:` als
   String-Match.
4. Auf Bestätigung: identisch zu `deleteOwnAccountAction` —
   `hardDeleteAvatar` + Anonymisierung-Patch.
5. Druckt Audit-Trail in stdout. **Diesen Output kopieren** und in
   die Bestätigungs-Mail an User aufnehmen + im 1Password-Vault
   archivieren.

## 6. Stufe B/C — Manuelles Hard-Delete

**Vorbereitung:**
- Backup-Hinweis: Neon Point-in-Time-Recovery deckt 7 Tage ab. Falls
  Rollback nötig: `neonctl branches restore <branch-id> --parent
  <timestamp>` (siehe Neon-Doku). Vor jedem Hard-Delete den genauen
  Timestamp notieren.
- GitHub-Mirror-Hinweis: Public-Articles sind via V1.5-Hook auf
  `github.com/shogun160/pflege-atlas-content` gespiegelt. Hard-Delete
  in der App entfernt den GitHub-Inhalt **nicht** — separater
  `git rm` + `git commit + push` im Mirror-Repo nötig. Auch dann
  bleibt der Inhalt in der git-History und in Repo-Forks.

**FK-Abhängigkeiten beim User-Hard-Delete:**

```sql
-- Reihenfolge: child-tables zuerst, dann user-table.

-- 1) Submissions wo User submitter ODER reviewer war
DELETE FROM submissions WHERE submitted_by_id = <USER_ID>;
UPDATE submissions SET current_reviewer_id = NULL WHERE current_reviewer_id = <USER_ID>;

-- 2) Articles.authors hasMany-Junction (Stufe B: alle authorship-Verweise weg)
DELETE FROM articles_rels WHERE path = 'authors' AND users_id = <USER_ID>;

-- 3) Articles.current_reviewer_id
UPDATE articles SET current_reviewer_id = NULL WHERE current_reviewer_id = <USER_ID>;

-- 4) Media.uploaded_by_id (alle user-uploaded Media-Docs — Cascade!)
SELECT id FROM media WHERE uploaded_by_id = <USER_ID>;
-- Diese IDs manuell per Payload-Admin-UI löschen, damit s3Storage-Hook
-- die R2-Files mitnimmt. Direkter DELETE in SQL würde R2-Files orphan
-- lassen.
-- Alternative: payload-Local-API-Script.

-- 5) Users.invited_by_id (Hinweis: User die DIESER User eingeladen hat)
UPDATE users SET invited_by_id = NULL WHERE invited_by_id = <USER_ID>;

-- 6) Erst jetzt: User-Row
DELETE FROM users WHERE id = <USER_ID>;
```

**Wichtig:** SQL nur im psql-Direktzugriff laufen (`docker exec`
lokal, `psql $DATABASE_URI` auf Prod), nicht über Payload-Admin-UI
(die Admin-UI hat keine Bulk-Delete-Garantie und triggert
Hooks/Access-Control bei jedem Schritt).

## 7. Bestätigung an User

Mail-Template-Skizze:

```
Betreff: Ihre Datenschutz-Anfrage vom <Datum>

Hallo <Name>,

Ihre Anfrage zur Löschung Ihres PflegeAtlas-Accounts haben wir wie
folgt umgesetzt:

- Account-Status: <anonymisiert / hart gelöscht>
- Avatar-Profilbild: gelöscht
- Beiträge: <unter „Gelöschte:r Beitragende:r" verlinkt /
  Authorship entfernt>
- GitHub-Mirror: <unverändert / manueller Eingriff am ...>

Ausgeführt am: <Timestamp>
Audit-Referenz: <Audit-Trail-Snippet aus Script-Output>

Falls Sie weitere Fragen haben, antworten Sie auf diese Mail.

Mit freundlichen Grüßen,
Oliver Wosnitza & Christoph Brück
PflegeAtlas — gemeinsam Verantwortliche (Art. 26 DSGVO)
```

In den 1Password-Vault („DSGVO-Anfragen") aufnehmen:
- Datum Anfrage
- Datum Ausführung
- User-ID (nicht E-Mail, weil anonymisiert)
- Audit-Trail-Output
- Mail-Bestätigungs-Versand (Resend-Message-ID)

---

**TODO Sub-C3:** Audit-Log-Collection wird Section 7 ersetzen — alle
Erasure-Events landen automatisch im Audit-Log und werden 90 Tage
aufbewahrt (laut V1.7-Datenschutz-Spec Section 10).
```

- [ ] **Step 5.2: Commit**

```bash
git add docs/legal/right-to-erasure-runbook.md
git commit -m "docs(legal): Right-to-Erasure-Runbook (Sub-C2)"
```

---

## Task 6: Admin-Script (Bash + TS) + manueller Smoke

**Files:**
- Create: `scripts/right-to-erasure.sh`
- Create: `scripts/right-to-erasure.ts`

- [ ] **Step 6.1: Bash-Wrapper anlegen**

Create `scripts/right-to-erasure.sh`:

```bash
#!/usr/bin/env bash
#
# Interaktiver Wrapper für scripts/right-to-erasure.ts
# Führt den Anonymisierungs-Pfad eines Users durch (identisch zu
# deleteOwnAccountAction), auf Admin-Wunsch wenn echte Art.-17-Anfrage
# per Mail kommt. Verlangt explizite "ERASE <email>"-Confirmation.
#
# Verwendung: bash scripts/right-to-erasure.sh user@example.de

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Verwendung: $0 <user-email>"
  exit 1
fi

TARGET_EMAIL="$1"

if [[ -z "${DATABASE_URI:-}" ]]; then
  echo "DATABASE_URI ist nicht gesetzt. Aus .env(.local) laden oder explizit exportieren."
  exit 1
fi

echo "=== Right-to-Erasure für PflegeAtlas ==="
echo "Ziel-User: $TARGET_EMAIL"
echo "DB: $DATABASE_URI"
echo

export TARGET_EMAIL
pnpm tsx scripts/right-to-erasure.ts
```

- [ ] **Step 6.2: TS-Script anlegen**

Create `scripts/right-to-erasure.ts`:

```ts
/**
 * Right-to-Erasure-Helper für PflegeAtlas (Sub-C2).
 *
 * Führt den Anonymisierungs-Pfad eines Users durch — identisch zu
 * deleteOwnAccountAction (Avatar-Hard-Delete + anonymizeUserPatch).
 *
 * Für echte Art.-17-Anfragen via Mail an datenschutz@. Für Stufe-B/C
 * (Authorship-Entfernung oder vollständiges Hard-Delete) siehe
 * docs/legal/right-to-erasure-runbook.md Section 6.
 *
 * Verwendung: bash scripts/right-to-erasure.sh user@example.de
 */
import 'dotenv/config';
import * as readline from 'node:readline';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { hardDeleteAvatar } from '@/lib/avatar-cleanup';
import { anonymizeUserPatch } from '@/lib/user-soft-delete';

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const targetEmail = process.env.TARGET_EMAIL;
  if (!targetEmail) {
    console.error('TARGET_EMAIL ist nicht gesetzt. Via Bash-Wrapper aufrufen.');
    process.exit(1);
  }

  const payload = await getPayload({ config: configPromise });

  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: targetEmail } },
    limit: 1,
  });
  if (found.docs.length === 0) {
    console.error(`Kein User mit E-Mail "${targetEmail}" gefunden.`);
    process.exit(1);
  }
  const user = found.docs[0] as {
    id: number;
    email: string;
    displayName?: string;
    role?: string;
    disabled?: boolean;
    avatar?: number | { id: number } | null;
  };

  if (user.role === 'admin') {
    console.error('Admin-Accounts können nicht via Script gelöscht werden. Manuell vorgehen.');
    process.exit(1);
  }
  if (user.disabled) {
    console.error(`User ${user.email} ist bereits disabled (id=${user.id}). Vermutlich schon anonymisiert.`);
    process.exit(1);
  }

  const submissionsCount = await payload.count({
    collection: 'submissions',
    where: { submittedBy: { equals: user.id } },
  });
  const articlesCount = await payload.count({
    collection: 'articles',
    where: { authors: { equals: user.id } },
  });
  const avatarId =
    typeof user.avatar === 'object' && user.avatar ? user.avatar.id : (user.avatar ?? null);

  console.log('--- Vorschau ---');
  console.log(`User-ID:         ${user.id}`);
  console.log(`E-Mail:          ${user.email}`);
  console.log(`Display-Name:    ${user.displayName ?? '(keiner)'}`);
  console.log(`Rolle:           ${user.role ?? '(keine)'}`);
  console.log(`Avatar-Media-ID: ${avatarId ?? '(keiner)'}`);
  console.log(`Submissions:     ${submissionsCount.totalDocs}`);
  console.log(`Articles:        ${articlesCount.totalDocs}`);
  console.log('---');
  console.log('Nach Bestätigung wird:');
  console.log('  - Avatar-Media + R2-File hart gelöscht (falls vorhanden)');
  console.log('  - User-Record anonymisiert (email → deleted-*, displayName → "Gelöschte:r Beitragende:r")');
  console.log('  - User.disabled → true');
  console.log('Submissions und Article-Authorships bleiben verlinkt (CC-BY-SA Lizenz-Pflicht).');
  console.log('');

  const expected = `ERASE ${user.email}`;
  const answer = await prompt(`Type "${expected}" to confirm: `);
  if (answer.trim() !== expected) {
    console.error('Bestätigung stimmt nicht. Abbruch.');
    process.exit(1);
  }

  const avatarResult = await hardDeleteAvatar(payload, avatarId, {
    userId: user.id,
    trigger: 'account-delete',
  });
  const patch = anonymizeUserPatch();
  const updated = await payload.update({
    collection: 'users',
    id: user.id,
    data: patch as never,
  });

  console.log('');
  console.log('--- Audit-Trail (in Mail-Bestätigung kopieren) ---');
  console.log(`Timestamp:         ${new Date().toISOString()}`);
  console.log(`User-ID:           ${user.id}`);
  console.log(`Original-E-Mail:   ${targetEmail}`);
  console.log(`Anonymisierte E-Mail: ${(updated as { email: string }).email}`);
  console.log(`Avatar-Media-ID:   ${avatarId ?? '(keiner)'}`);
  console.log(`Avatar-Delete:     ${avatarResult.deleted ? 'OK' : avatarResult.error ? `FAIL (${avatarResult.error})` : 'no-op (kein Avatar)'}`);
  console.log(`Submissions:       ${submissionsCount.totalDocs} (bleiben verlinkt)`);
  console.log(`Articles:          ${articlesCount.totalDocs} (Authorship bleibt)`);
  console.log('---');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 6.3: Bash-Script ausführbar machen**

Run: `chmod +x scripts/right-to-erasure.sh`

- [ ] **Step 6.4: Manueller Smoke gegen Dev-DB**

Erstelle einen Test-User per Payload-Admin-UI (oder reuse einen bestehenden contributor-Account in Dev). Lade ein Avatar-Bild hoch. Dann:

```bash
bash scripts/right-to-erasure.sh test-erasure-user@example.local
```

Erwartet:
- Vorschau-Block zeigt korrekte Felder
- Bestätigung „ERASE test-erasure-user@example.local" verlangt
- Bei korrekter Bestätigung: Avatar-Delete + Anonymize
- Audit-Trail in stdout

Verifikation in Dev-Admin-UI:
- User existiert noch (id-Bezug bleibt) aber disabled, anonymisierter Name + E-Mail
- Avatar-Media-Doc ist weg

Falls Smoke fehlschlägt: in Plan-Deviation-Block dokumentieren, fixen, neuer Commit.

- [ ] **Step 6.5: tsc + lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: 0 errors. (Falls neuer Script TS-Lint-Warnings produziert, akzeptabel — Skripte sind im Repo bisher ohnehin nicht stark gelinted.)

- [ ] **Step 6.6: Commit**

```bash
git add scripts/right-to-erasure.sh scripts/right-to-erasure.ts
git commit -m "feat(scripts): right-to-erasure helper for Art.-17 requests (Sub-C2)"
```

---

## Task 7: PR erstellen + Merge

**Files:** keine Code-Änderungen.

- [ ] **Step 7.1: Branch-Status prüfen**

Run: `git log --oneline main..HEAD`
Expected: 6 Commits — Spec + 5 Code/Doc-Commits (Task 1 + 2 + 3 + 5 + 6).

- [ ] **Step 7.2: Push**

Run: `git push -u origin feat/sub-c2-avatar-hard-delete`

- [ ] **Step 7.3: PR via gh**

```bash
gh pr create --title "feat: avatar hard-delete + Right-to-Erasure-Runbook (Sub-C2)" --body "$(cat <<'EOF'
## Summary
- **Avatar-Hard-Delete in 3 Self-Service-Pfaden:** Account-Delete + Profile-Update (Avatar-Removal + Avatar-Replacement). Schließt die Spec-Drift zu V1.6-Promise „Avatar wird hard-gelöscht (Media-Record + File)".
- **Helper `hardDeleteAvatar`** in `src/lib/avatar-cleanup.ts` kapselt `payload.delete({ collection: 'media', id })` mit warn-on-failure-Semantik (Account-Delete läuft auch bei R2-Outage durch — DSGVO-User-Recht > Storage-Hygiene).
- **R2-Cleanup automatisch** via s3Storage-After-Delete-Hook (keine separate R2-API-Call).
- **Right-to-Erasure-Runbook** in `docs/legal/` für echte Art.-17-Anfragen die über Self-Service hinausgehen (Identitätsprüfung, Scope-Klärung A/B/C, DSGVO-Frist, manuelles psql für FK-Cascade, GitHub-Mirror-Hinweis).
- **Helper-Script** `scripts/right-to-erasure.{sh,ts}` für den Standardfall der admin-getriggerten Anonymisierung (mit interaktivem ERASE-Confirmation-Match).

**Spec:** `docs/superpowers/specs/2026-06-24-pflegeatlas-avatar-hard-delete-sub-c2-design.md` (`5ef220f`)
**Plan:** `docs/superpowers/plans/2026-06-24-pflegeatlas-avatar-hard-delete-sub-c2.md`

## Plan Deviations
(Falls beim Implementieren welche entstehen: hier ergänzen.)

## Test plan
- [x] Unit: 4 neue Tests in `tests/unit/avatar-cleanup.test.ts` (null/undefined no-op, success, reject-with-warn)
- [x] Integration: 4 neue Tests in `tests/integration/avatar-hard-delete.test.ts` (Account-Delete + Profile-Removal + Profile-Replacement + No-op)
- [x] `pnpm exec tsc --noEmit` 0 errors
- [x] `pnpm lint` 0 errors
- [x] `pnpm test` voll grün: **383/383** (vorher 375/375, +8 neue Tests)
- [x] Manueller Script-Smoke in Dev-DB durchgelaufen (siehe Plan T6.4)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7.4: CI grün abwarten + Merge**

CI sollte grün durchlaufen (Tests sequenziell, `tsc --noEmit`-Gate trifft die neuen Imports).

Bei rotem CI: Logs lesen, lokal nachstellen, fixen, neuer Commit. Bei vorbestehendem Cold-Start-Flake (Postgres-Pool unter parallelem Vollrun): Vitest-Config ist seit V1.7.1 `fileParallelism: false`, sollte stabil sein.

Nach grünem CI: Squash-Merge per Web-UI oder `gh pr merge --squash`.

---

## Self-Review (vor PR)

- [ ] `hardDeleteAvatar` schluckt Fehler (kein re-throw), Caller schluckt per Default.
- [ ] `deleteOwnAccountAction` liest aktuellen Avatar VOR der Anonymisierung — sonst greift `findByID` auf den schon-anonymisierten Datensatz.
- [ ] `updateOwnProfileAction` triggert Avatar-Delete nur wenn `data.avatar !== undefined` (Profile-Update ohne Avatar-Feld macht nichts).
- [ ] `updateOwnProfileAction` triggert nur bei tatsächlichem Wechsel (`oldId !== newId`) — kein No-op-Delete wenn User dasselbe Avatar nochmal setzt.
- [ ] Script verlangt exakte `ERASE <email>`-String-Match (kein substring-Match).
- [ ] Script blockt Admin-Self-Erasure und bereits-disabled-User.
- [ ] Runbook erwähnt GitHub-Mirror-Irreversibilität in Stufe C.

---

## Memory-Update nach Merge

Nach Squash-Merge auf main:

- `project_pflegeatlas.md` mit neuem main-HEAD + Sub-C2-Done-Notiz aktualisieren
- `reference_pflegeatlas_docs.md` um Sub-C2-Spec + Plan ergänzen
- Backlog-Item „Sub-C3 Audit-Log" als nächsten Track markieren
