# PflegeAtlas Auth-Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementiere I-2 (`loginAction` Pre-Lookup-Optimization), I-3 + Reset-Production-Bug-Fix (`setPasswordFromTokenAction` mit Server-Side-Token-Field-Match statt Heuristik + Reset-Pfad via `payload.resetPassword`), I-4 (`requestHeaders`-Threading + IP/UA-Audit für beide Pfade), Welcome-Mail nur im invitation-Pfad, T5-M1 Test-Helper-Extraction.

**Architecture:** Eine Datei für die Server-Logik (`src/lib/auth.ts`) mit zwei privaten Helpers (`handleInvitationAccept`, `handleResetComplete`) hinter einem unveränderten Action-Entry-Point. Form-Caller (`actions.ts`) reicht `headers()` durch. Test-Helper unter `tests/helpers/mock-next-headers.ts` als DRY für die in-Scope-Tests.

**Tech Stack:** Next.js 15 Server-Actions, Payload 3.85 Local-API (`payload.resetPassword`, `payload.forgotPassword`, `payload.login`, `payload.find`, `payload.update`), Vitest 4 Integration-Tests gegen lokale Postgres.

**Spec:** `docs/superpowers/specs/2026-06-26-pflegeatlas-auth-polish-design.md`

**Branch:** `feat/auth-polish` (bereits angelegt, Spec auf `3e34b5f` committed)

---

## File Map

| Datei | Verantwortung |
|---|---|
| `src/lib/auth.ts` | `loginAction` Refactor (I-2), `setPasswordFromTokenAction` Refactor (I-3 + Reset-Fix), neue private Helpers `handleInvitationAccept`/`handleResetComplete`; entfernt `isInvitationAcceptPattern` + Konstanten |
| `src/app/(frontend)/passwort-setzen/actions.ts` | Liest `await headers()`, reicht an `setPasswordFromTokenAction` durch |
| `tests/helpers/mock-next-headers.ts` | **NEU** — DRY-Helper für `vi.doMock('next/headers', ...)` |
| `tests/integration/audit-log-triggers.test.ts` | Reset-Test umschreiben (real `payload.forgotPassword`); neue Tests anhängen; doMock auf Helper migrieren |
| `tests/integration/auth-set-password-from-token.test.ts` | doMock auf Helper migrieren |

---

## Task 1: T5-M1 Test-Helper extrahieren

**Files:**
- Create: `tests/helpers/mock-next-headers.ts`

- [ ] **Step 1: Helper-Datei anlegen**

```ts
// tests/helpers/mock-next-headers.ts
import { vi } from 'vitest';

/**
 * DRY-Helper für `vi.doMock('next/headers', ...)`. Mockt `cookies()` mit no-op
 * set/delete/get-Stubs (Server-Action-kompatibel) und `headers()` mit dem
 * übergebenen Headers-Objekt (default: leere Headers).
 *
 * In-Scope-Migration: nur Test-Dateien, die der auth-polish-PR ohnehin
 * anfasst. Die übrigen ~22 Aufrufer bleiben für einen mechanischen
 * Follow-up-PR (T5-M1 Restmigration).
 */
export function mockNextHeaders(headers: Headers = new Headers()): void {
  vi.doMock('next/headers', () => ({
    cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    headers: async () => headers,
  }));
}

export function unmockNextHeaders(): void {
  vi.doUnmock('next/headers');
}
```

- [ ] **Step 2: Lint + Type-Check**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS (Datei ist nur ein Modul-Export, keine Konsumenten verändern sich in diesem Task)

- [ ] **Step 3: Commit**

```bash
git add tests/helpers/mock-next-headers.ts
git commit -m "test(helpers): add mockNextHeaders DRY-helper (T5-M1)"
```

---

## Task 2: I-2 — `loginAction` Pre-Lookup-Refactor

**Files:**
- Modify: `src/lib/auth.ts:116-191`
- Coverage: `tests/integration/audit-log-triggers.test.ts` (bestehende 4-Bucket-Tests `login.success` + `login.failure` × `unknown`/`disabled`/`locked`/`wrong-password`)

- [ ] **Step 1: Baseline — bestehende Tests laufen lassen**

Run: `pnpm exec vitest run tests/integration/audit-log-triggers.test.ts -t "audit-log triggers — login"`
Expected: alle login-Tests grün.

- [ ] **Step 2: `loginAction` ersetzen**

Ersetze Z. 116–191 in `src/lib/auth.ts` durch:

```ts
export async function loginAction(
  email: string,
  password: string,
  requestHeaders?: Headers,
): Promise<LoginResult> {
  'use server';
  const loginContext: LoginContext = requestHeaders
    ? extractLoginContext(new Request('http://internal', { headers: requestHeaders }))
    : { ip: null, userAgent: null };

  const payload = await payloadInstance();

  try {
    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    });
    if (!result.token) {
      // payload.login throws on failure in practice; this branch is defensive.
      await writeAuditLog(payload, {
        eventType: 'login.failure',
        actor: null,
        actorEmail: null,
        metadata: { bucket: 'wrong-password', emailAttempt: email },
        loginContext,
      });
      return { ok: false, error: 'Login fehlgeschlagen.' };
    }
    await setAuthCookie(result.token);
    const user = result.user as { id: number; email: string; role?: Role };
    const role = user.role ?? 'contributor';
    await writeAuditLog(payload, {
      eventType: 'login.success',
      actor: user.id,
      actorEmail: user.email,
      loginContext,
    });
    return { ok: true, redirectTo: redirectForRole(role) };
  } catch (err) {
    // Pre-Lookup ONLY in catch — for bucket-disambiguation.
    const found = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      depth: 0,
      limit: 1,
    });
    const existingUser = found.docs[0] as
      | { id: number; email: string; disabled?: boolean }
      | undefined;

    // Generic message — don't leak whether the email exists, the password
    // is wrong, or the account is disabled/locked. The audit row captures
    // the bucket truth server-side; the client never sees the distinction.
    let bucket: 'wrong-password' | 'disabled' | 'locked' | 'unknown';
    if (!existingUser) {
      bucket = 'unknown';
    } else if (existingUser.disabled) {
      bucket = 'disabled';
    } else if (err instanceof LockedAuth) {
      bucket = 'locked';
    } else {
      bucket = 'wrong-password';
    }
    await writeAuditLog(payload, {
      eventType: 'login.failure',
      actor: existingUser?.id ?? null,
      actorEmail: existingUser?.email ?? null,
      metadata: { bucket, emailAttempt: email },
      loginContext,
    });
    return { ok: false, error: 'Login fehlgeschlagen.' };
  }
}
```

- [ ] **Step 3: Tests laufen lassen**

Run: `pnpm exec vitest run tests/integration/audit-log-triggers.test.ts -t "audit-log triggers — login"`
Expected: alle login-Tests grün (behavior-preserving).

- [ ] **Step 4: Lint + Type-Check**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts
git commit -m "refactor(auth): loginAction success-path skips pre-find (I-2)"
```

---

## Task 3: Reset-Bug — Failing Test schreiben (RED)

**Files:**
- Modify: `tests/integration/audit-log-triggers.test.ts` (Test in `describe('audit-log triggers — invitation accept vs password reset complete')`-Block einfügen, nach Z. 207)

- [ ] **Step 1: Failing Test hinzufügen**

Hänge folgenden Test innerhalb des bestehenden `describe('audit-log triggers — invitation accept vs password reset complete', ...)`-Blocks an (vor der schließenden `})` auf Z. 208):

```ts
  it('REAL reset flow: payload.forgotPassword → setPasswordFromTokenAction → password.reset.complete + new password works (BUG-FIX)', async () => {
    const user = await createUserFixture(payload, 'contributor');

    // Trigger Payload's native forgot-password to seed resetPasswordToken
    await payload.forgotPassword({
      collection: 'users',
      data: { email: user.email },
      disableEmail: true,
    });

    // Pull the freshly-seeded token from the user record
    const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0 });
    const tokenValue = (fresh as { resetPasswordToken: string }).resetPasswordToken;
    expect(tokenValue).toBeTruthy();

    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction(tokenValue, 'BrandNewPass1!');
    expect(result.ok).toBe(true);

    // Audit row written
    const audit = await findLatestAudit('password.reset.complete');
    expect(audit).toBeTruthy();
    expect(audit!.actor).toBe(user.id);

    // New password actually works
    const reLogin = await payload.login({
      collection: 'users',
      data: { email: user.email, password: 'BrandNewPass1!' },
    });
    expect(reLogin.token).toBeTruthy();

    vi.doUnmock('next/headers');
  });
```

- [ ] **Step 2: Test laufen lassen — Erwartung FAIL**

Run: `pnpm exec vitest run tests/integration/audit-log-triggers.test.ts -t "REAL reset flow"`
Expected: FAIL — `expect(result.ok).toBe(true)` schlägt fehl, weil `setPasswordFromTokenAction` `'Token ungültig.'` returnt (sucht nur `setPasswordToken`-Feld). Das ist der Bug, den Task 4 fixt.

- [ ] **Step 3: Commit (RED-Phase festhalten)**

```bash
git add tests/integration/audit-log-triggers.test.ts
git commit -m "test(audit): RED — real reset flow via payload.forgotPassword (reveals bug)"
```

---

## Task 4: I-3 + I-4 + Reset-Bug-Fix — `setPasswordFromTokenAction` Big Refactor (GREEN)

**Files:**
- Modify: `src/lib/auth.ts:276-365` (Heuristik-Block + alte Action; ersetzt durch neue Struktur)

- [ ] **Step 1: Heuristik + Konstanten entfernen**

Lösche in `src/lib/auth.ts` Z. 276–292 komplett (4-Zeilen-Komment-Block, `INVITE_EXPIRY_HEURISTIC_MS`, `INVITE_PATTERN_TOLERANCE_MS`, `isInvitationAcceptPattern`-Funktion). Diese werden nicht ersetzt.

- [ ] **Step 2: `setPasswordFromTokenAction` + 2 Helpers durch neue Struktur ersetzen**

Ersetze die alte `setPasswordFromTokenAction` (Z. 294–365, alles bis zum nächsten `export`/Section-Header) durch:

```ts
export async function setPasswordFromTokenAction(
  token: string,
  newPassword: string,
  requestHeaders?: Headers,
): Promise<SetPasswordResult> {
  'use server';
  if (newPassword.length < 8) {
    return { ok: false, error: 'Passwort muss mindestens 8 Zeichen lang sein.' };
  }
  if (!token) {
    return { ok: false, error: 'Kein Token übergeben.' };
  }

  const loginContext: LoginContext = requestHeaders
    ? extractLoginContext(new Request('http://internal', { headers: requestHeaders }))
    : { ip: null, userAgent: null };

  try {
    const payload = await payloadInstance();

    // 1) Try V1.6-invitation token (custom setPasswordToken field). Order
    //    matters: if BOTH token fields are set on the same user (rare race
    //    between invite and forgot-password), invitation wins.
    const invFound = await payload.find({
      collection: 'users',
      where: { setPasswordToken: { equals: token } },
      depth: 0,
      limit: 1,
    });
    if (invFound.docs.length > 0) {
      const user = invFound.docs[0] as {
        id: number;
        email: string;
        role?: Role;
        displayName?: string;
        setPasswordTokenExpiresAt?: string | null;
      };
      return await handleInvitationAccept(payload, user, newPassword, loginContext);
    }

    // 2) Try Payload-native reset token.
    const resetFound = await payload.find({
      collection: 'users',
      where: { resetPasswordToken: { equals: token } },
      depth: 0,
      limit: 1,
    });
    if (resetFound.docs.length > 0) {
      const user = resetFound.docs[0] as {
        id: number;
        email: string;
        role?: Role;
        resetPasswordExpiration?: string | null;
      };
      return await handleResetComplete(payload, user, token, newPassword, loginContext);
    }

    return { ok: false, error: 'Token ungültig.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Set-Password failed.' };
  }
}

async function handleInvitationAccept(
  payload: Payload,
  user: { id: number; email: string; role?: Role; displayName?: string; setPasswordTokenExpiresAt?: string | null },
  newPassword: string,
  loginContext: LoginContext,
): Promise<SetPasswordResult> {
  if (!isTokenValid(user.setPasswordTokenExpiresAt)) {
    return { ok: false, error: 'Token abgelaufen.' };
  }

  await payload.update({
    collection: 'users',
    id: user.id,
    data: {
      password: newPassword,
      setPasswordToken: null,
      setPasswordTokenExpiresAt: null,
    } as never,
  });

  await writeAuditLog(payload, {
    eventType: 'invitation.accept',
    actor: user.id,
    actorEmail: user.email,
    subject: user.id,
    subjectEmail: user.email,
    loginContext,
  });

  // Welcome mail — invitation-only. Failure must NOT block login.
  try {
    const welcome = renderWelcomeMail({
      to: user.email,
      displayName: user.displayName ?? '',
      role: (user.role ?? 'contributor') as Role,
    });
    await sendMail({ to: user.email, ...welcome });
  } catch (err) {
    console.warn('[V1.6] welcome mail failed:', err);
  }

  // Auto-login. payload.login can throw (e.g. Disabled-Hook); guard silently
  // — user gets redirected without cookie and must log in manually. Existing
  // V1.6 behavior preserved.
  const loginResult = await payload.login({
    collection: 'users',
    data: { email: user.email, password: newPassword },
  });
  if (loginResult.token) {
    await setAuthCookie(loginResult.token);
  }

  const role = (user.role ?? 'contributor') as Role;
  return { ok: true, redirectTo: redirectForRole(role) };
}

async function handleResetComplete(
  payload: Payload,
  user: { id: number; email: string; role?: Role; resetPasswordExpiration?: string | null },
  token: string,
  newPassword: string,
  loginContext: LoginContext,
): Promise<SetPasswordResult> {
  // Pre-check expiration so we return the German message reliably, instead
  // of matching against Payload's English error text (which could be i18n'd
  // in the future).
  if (!isTokenValid(user.resetPasswordExpiration)) {
    return { ok: false, error: 'Token abgelaufen.' };
  }

  // Payload's resetPassword regenerates salt+hash, clears the token, and
  // returns a JWT — all transactionally correct. overrideAccess is needed
  // because resetPasswordToken is marked update:false at the field level.
  const result = await payload.resetPassword({
    collection: 'users',
    data: { token, password: newPassword },
    overrideAccess: true,
  });

  await writeAuditLog(payload, {
    eventType: 'password.reset.complete',
    actor: user.id,
    actorEmail: user.email,
    subject: user.id,
    subjectEmail: user.email,
    loginContext,
  });

  if (result.token) {
    await setAuthCookie(result.token);
  }

  const role = (user.role ?? 'contributor') as Role;
  return { ok: true, redirectTo: redirectForRole(role) };
}
```

- [ ] **Step 3: RED-Test aus Task 3 laufen lassen — Erwartung PASS**

Run: `pnpm exec vitest run tests/integration/audit-log-triggers.test.ts -t "REAL reset flow"`
Expected: PASS. Audit-Row geschrieben, neues Password funktioniert.

- [ ] **Step 4: Bestehende setPasswordFromTokenAction-Tests laufen lassen — Erwartung PASS**

Run: `pnpm exec vitest run tests/integration/auth-set-password-from-token.test.ts tests/integration/audit-log-triggers.test.ts`
Expected: alle Tests grün — invitation-Pfad-Verhalten unverändert.

- [ ] **Step 5: Lint + Type-Check**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts
git commit -m "fix(auth): reset-token flow + I-3/I-4 polish — token-field discriminator, requestHeaders, welcome-mail invitation-only"
```

---

## Task 5: Form-Action — `headers()` durchreichen

**Files:**
- Modify: `src/app/(frontend)/passwort-setzen/actions.ts`

- [ ] **Step 1: Form-Action anpassen**

Ersetze den Inhalt von `src/app/(frontend)/passwort-setzen/actions.ts` durch:

```ts
'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { setPasswordFromTokenAction } from '@/lib/auth';

export interface SetPasswordFormState {
  error?: string;
}

export async function setPasswordFormAction(
  _prev: SetPasswordFormState,
  formData: FormData,
): Promise<SetPasswordFormState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const repeat = String(formData.get('passwordRepeat') ?? '');
  const dsgvo = formData.get('dsgvo');
  // mode is read for DSGVO-UI gating only; the server uses authoritative
  // token-field-match to determine invitation vs reset, not this hint.
  const mode = String(formData.get('mode') ?? 'invitation');

  if (password.length < 8) {
    return { error: 'Passwort muss mindestens 8 Zeichen lang sein.' };
  }
  if (password !== repeat) {
    return { error: 'Die Passwörter stimmen nicht überein.' };
  }
  if (mode === 'invitation' && !dsgvo) {
    return { error: 'Bitte bestätige die Datenschutz-Hinweise.' };
  }

  const requestHeaders = await headers();
  const result = await setPasswordFromTokenAction(token, password, requestHeaders);
  if (!result.ok) {
    return { error: result.error ?? 'Passwort konnte nicht gesetzt werden.' };
  }
  redirect(result.redirectTo ?? '/mein-bereich');
}
```

- [ ] **Step 2: Type-Check + Lint**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Bestehende Tests laufen lassen**

Run: `pnpm exec vitest run tests/integration/auth-set-password-from-token.test.ts tests/integration/audit-log-triggers.test.ts`
Expected: PASS — der Caller-Change ist transparent (zusätzlicher optionaler Parameter).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(frontend\)/passwort-setzen/actions.ts
git commit -m "feat(auth): forward request headers to setPasswordFromTokenAction (I-4)"
```

---

## Task 6: Coverage-Tests hinzufügen

**Files:**
- Modify: `tests/integration/audit-log-triggers.test.ts` (4 neue Tests anhängen in `describe('audit-log triggers — invitation accept vs password reset complete')`-Block)

- [ ] **Step 1: Sendmail-Mock-Test (Welcome-Mail-Asymmetrie)**

Hänge folgenden Test im selben describe-Block an:

```ts
  it('sends welcome mail on invitation.accept but NOT on password.reset.complete', async () => {
    const sendMailSpy = vi.fn(async () => undefined);
    vi.doMock('@/lib/mail', () => ({ sendMail: sendMailSpy }));
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));

    // --- Invitation path: expects sendMail called ---
    const invitedAt = new Date();
    const tokenExpiresAt = new Date(invitedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const inviteUser = await payload.create({
      collection: 'users',
      data: {
        email: 'invitee-welcome-' + Date.now() + '@test.local',
        password: 'temp-' + Math.random(),
        displayName: 'Invitee Welcome',
        role: 'contributor',
        setPasswordToken: 'inv-welcome-tok-' + Date.now(),
        setPasswordTokenExpiresAt: tokenExpiresAt.toISOString(),
        invitedAt: invitedAt.toISOString(),
      } as never,
    });
    const inviteToken = (inviteUser as { setPasswordToken: string }).setPasswordToken;
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    await setPasswordFromTokenAction(inviteToken, 'NewPass123!');
    expect(sendMailSpy).toHaveBeenCalledTimes(1);

    // --- Reset path: expects sendMail NOT called ---
    sendMailSpy.mockClear();
    const resetUser = await createUserFixture(payload, 'contributor');
    await payload.forgotPassword({
      collection: 'users',
      data: { email: resetUser.email },
      disableEmail: true,
    });
    const freshReset = await payload.findByID({ collection: 'users', id: resetUser.id, depth: 0 });
    const resetToken = (freshReset as { resetPasswordToken: string }).resetPasswordToken;
    await setPasswordFromTokenAction(resetToken, 'BrandNewPass1!');
    expect(sendMailSpy).toHaveBeenCalledTimes(0);

    vi.doUnmock('@/lib/mail');
    vi.doUnmock('next/headers');
  });
```

- [ ] **Step 2: Headers-Threading-Tests — beide Pfade**

Hänge an:

```ts
  it('threads requestHeaders into invitation.accept audit (ipHash + userAgent)', async () => {
    const invitedAt = new Date();
    const tokenExpiresAt = new Date(invitedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'invitee-hdr-' + Date.now() + '@test.local',
        password: 'temp-' + Math.random(),
        displayName: 'Invitee Headers',
        role: 'contributor',
        setPasswordToken: 'inv-hdr-tok-' + Date.now(),
        setPasswordTokenExpiresAt: tokenExpiresAt.toISOString(),
        invitedAt: invitedAt.toISOString(),
      } as never,
    });
    const tokenValue = (user as { setPasswordToken: string }).setPasswordToken;
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const headers = new Headers({ 'x-forwarded-for': '10.0.0.1', 'user-agent': 'InviteUA/1.0' });
    const result = await setPasswordFromTokenAction(tokenValue, 'NewPass123!', headers);
    expect(result.ok).toBe(true);

    const audit = await findLatestAudit('invitation.accept');
    expect(audit).toBeTruthy();
    expect(audit!.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(audit!.userAgent).toBe('InviteUA/1.0');
    vi.doUnmock('next/headers');
  });

  it('threads requestHeaders into password.reset.complete audit (ipHash + userAgent)', async () => {
    const user = await createUserFixture(payload, 'contributor');
    await payload.forgotPassword({
      collection: 'users',
      data: { email: user.email },
      disableEmail: true,
    });
    const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0 });
    const tokenValue = (fresh as { resetPasswordToken: string }).resetPasswordToken;
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const headers = new Headers({ 'x-forwarded-for': '10.0.0.2', 'user-agent': 'ResetUA/1.0' });
    const result = await setPasswordFromTokenAction(tokenValue, 'BrandNewPass1!', headers);
    expect(result.ok).toBe(true);

    const audit = await findLatestAudit('password.reset.complete');
    expect(audit).toBeTruthy();
    expect(audit!.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(audit!.userAgent).toBe('ResetUA/1.0');
    vi.doUnmock('next/headers');
  });
```

- [ ] **Step 3: Expired-Reset-Token → deutsche Message**

Hänge an:

```ts
  it('returns German "Token abgelaufen." for expired resetPasswordToken', async () => {
    const user = await createUserFixture(payload, 'contributor');
    await payload.forgotPassword({
      collection: 'users',
      data: { email: user.email },
      disableEmail: true,
    });
    // Force expiration into the past via direct update
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { resetPasswordExpiration: new Date(Date.now() - 60 * 60 * 1000).toISOString() } as never,
      overrideAccess: true,
    });
    const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0 });
    const tokenValue = (fresh as { resetPasswordToken: string }).resetPasswordToken;
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction(tokenValue, 'WhateverPass1!');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Token abgelaufen.');
    vi.doUnmock('next/headers');
  });
```

- [ ] **Step 4: Token-Conflict — Invitation gewinnt**

Hänge an:

```ts
  it('when both setPasswordToken AND resetPasswordToken are set, invitation wins', async () => {
    const invitedAt = new Date();
    const tokenExpiresAt = new Date(invitedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'conflict-' + Date.now() + '@test.local',
        password: 'temp-' + Math.random(),
        displayName: 'Conflict User',
        role: 'contributor',
        setPasswordToken: 'shared-token-' + Date.now(),
        setPasswordTokenExpiresAt: tokenExpiresAt.toISOString(),
        invitedAt: invitedAt.toISOString(),
      } as never,
    });
    const tokenValue = (user as { setPasswordToken: string }).setPasswordToken;
    // Seed reset-token-pair with the SAME token value (unrealistic but tests dispatch order)
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        resetPasswordToken: tokenValue,
        resetPasswordExpiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      } as never,
      overrideAccess: true,
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction(tokenValue, 'NewPass123!');
    expect(result.ok).toBe(true);

    const audit = await findLatestAudit('invitation.accept');
    expect(audit).toBeTruthy();
    expect(audit!.actor).toBe(user.id as number);
    vi.doUnmock('next/headers');
  });
```

- [ ] **Step 5: Alle Tests laufen lassen**

Run: `pnpm exec vitest run tests/integration/audit-log-triggers.test.ts tests/integration/auth-set-password-from-token.test.ts`
Expected: alle Tests grün, inkl. der 4 neuen.

- [ ] **Step 6: Lint + Type-Check**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/integration/audit-log-triggers.test.ts
git commit -m "test(audit): coverage for welcome-mail asymmetry, headers threading, expired-reset i18n, token-conflict"
```

---

## Task 7: Altes Fake-Reset-Test entfernen + Helper-Migration

**Files:**
- Modify: `tests/integration/audit-log-triggers.test.ts` (alten fake-reset-Test löschen; alle `vi.doMock('next/headers', ...)`-Blöcke durch Helper ersetzen)
- Modify: `tests/integration/auth-set-password-from-token.test.ts` (1 `vi.doMock` durch Helper)

- [ ] **Step 1: Alten fake-reset-Test löschen**

In `tests/integration/audit-log-triggers.test.ts` den Test mit der Beschreibung `'writes password.reset.complete when token pattern matches reset (NO invitedAt OR tokenExpiresAt close to 1h)'` (originale Z. 182–207) komplett entfernen — Task 3 ersetzt ihn durch den realen Flow.

- [ ] **Step 2: Imports im Test-File erweitern**

Am Anfang von `tests/integration/audit-log-triggers.test.ts` den Import-Block ergänzen:

```ts
import { mockNextHeaders, unmockNextHeaders } from '../helpers/mock-next-headers';
```

Dasselbe in `tests/integration/auth-set-password-from-token.test.ts`.

- [ ] **Step 3: doMock-Aufrufe in `audit-log-triggers.test.ts` ersetzen**

In `tests/integration/audit-log-triggers.test.ts` jeden Block

```ts
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
```

ersetzen durch

```ts
    mockNextHeaders();
```

und jedes

```ts
    vi.doUnmock('next/headers');
```

durch

```ts
    unmockNextHeaders();
```

Der Helper ist parameterlos default-leere-Headers, was für die existierenden Tests semantisch identisch ist (Aufrufer, die ohnehin keine Headers brauchen).

- [ ] **Step 4: doMock-Aufruf in `auth-set-password-from-token.test.ts` ersetzen**

Analog die eine Vorkommnis dort. Falls die Form leicht abweicht (auch `delete`/`get`-Stubs in derselben Form), trotzdem durch `mockNextHeaders()` ersetzen — der Helper schreibt dieselben Stubs.

- [ ] **Step 5: Alle Tests laufen lassen**

Run: `pnpm exec vitest run tests/integration/audit-log-triggers.test.ts tests/integration/auth-set-password-from-token.test.ts`
Expected: alle Tests grün — Verhalten unverändert.

- [ ] **Step 6: Lint + Type-Check**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/integration/audit-log-triggers.test.ts tests/integration/auth-set-password-from-token.test.ts
git commit -m "test(refactor): drop fake reset test, migrate touched files to mockNextHeaders helper"
```

---

## Task 8: Full-Suite Verification

**Files:** (keine, nur Verifikation)

- [ ] **Step 1: Komplette Test-Suite laufen lassen**

Run: `pnpm test`
Expected: alle Tests grün, 425 Tests (vorher 420 + 6 neu – 1 entferntes fake-reset).

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: 0 Errors, 0 Warnings.

- [ ] **Step 3: Type-Check (CI-Step seit V1.7.1)**

Run: `pnpm exec tsc --noEmit`
Expected: 0 Errors.

- [ ] **Step 4: Audit-Trigger-Smoke gegen lokale DB**

Optional, falls Dev-DB läuft: navigiere lokal zu `/passwort-vergessen`, gebe die Test-Account-Email ein, fang die Reset-Mail aus Console-Output, klicke den Link, setze ein neues Passwort, prüfe in der Admin-UI von `audit-logs`, dass ein `password.reset.complete`-Event mit IP-Hash + UA gelandet ist.

- [ ] **Step 5: Branch-Status prüfen**

Run: `git log feat/auth-polish ^main --oneline`
Expected: 9 Commits (Spec + Plan + Task 1–7), `main` clean ahead.

- [ ] **Step 6: Fertig — kein weiterer Commit. Branch ist bereit für PR.**

---

## Notes

- **Sub-C2-Lesson "Plan auf Feature-Branch":** Branch `feat/auth-polish` ist bereits aktiv, Spec ist drauf committed. Plan-Commit folgt aus diesem Skill.
- **Sub-C3-Lesson "Subagent-Driven mit per-Task-Code-Review":** Plan ist explizit so dimensioniert, dass jeder Task von einem Implementer-Subagent + Code-Quality-Reviewer-Subagent allein ausgeführt werden kann. Die Step-Granularität ist bewusst Click-für-Click.
- **Sub-C1-Lesson "TDD-Test-Schwelle":** Task 3 (RED-Test für Reset-Flow) muss tatsächlich rot werden, bevor Task 4 grün macht. Wenn der RED-Test grün ist, ist die Bug-Theorie falsch — dann anhalten und neu denken.
- **V1.7.1-Lesson "lokaler `pnpm payload migrate` hängt":** für diesen PR irrelevant (keine Migrationen).
- **Spec-Out-Of-Scope-Item:** „T5-M1 Restmigration der ~22 anderen Aufrufer" als mechanischer Follow-up-PR ist bewusst nicht hier.
