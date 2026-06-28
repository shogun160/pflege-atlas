import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPayload, LockedAuth, type Payload } from 'payload';
import config from '@/payload.config';
import { hasPermission, type Action, type Resource, type Role } from './auth-permissions';
import { generateToken, INVITE_EXPIRY_MS, isTokenValid } from './auth-tokens';
import { sendMail } from './mail';
import { renderInvitationMail } from './mail-templates/invitation';
import { renderWelcomeMail } from './mail-templates/welcome';
import { anonymizeUserPatch } from './user-soft-delete';
import { shapeExport, findAllForExport, ExportTooLargeError } from './data-export';
import { hardDeleteAvatar } from './avatar-cleanup';
import { writeAuditLog, extractLoginContext, type LoginContext } from './audit-log';

export interface Session {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  disabled: boolean;
  avatar?: number | null;
  avatarUrl?: string | null;
}

async function payloadInstance() {
  return await getPayload({ config });
}

// Single point of truth for the auth-cookie options. Security-relevant
// (httpOnly/sameSite/secure/maxAge) — change one place, change all flows.
async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('payload-token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('payload-token');
}

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

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');
  if (session.disabled) throw new Error('Account disabled');
  return session;
}

export async function requireRole(roles: Role[]): Promise<Session> {
  const session = await requireUser();
  if (!roles.includes(session.role)) throw new Error('Forbidden');
  return session;
}

export function can(session: Session | null, action: Action, resource: Resource): boolean {
  return hasPermission(session, action, resource);
}

// ---------------------------------------------------------------------------
// Server-Actions (T7)
// ---------------------------------------------------------------------------
// We intentionally use Function-Level `'use server'` directives instead of
// a File-Level one. The synchronous `can()` export above is incompatible
// with file-level `'use server'` (Next.js requires every export of such a
// module to be async). Function-level directives are plan-equivalent: Next
// still treats these as Server-Actions when called from a Client Component
// or `<form action={…}>`.

export interface LoginResult {
  ok: boolean;
  redirectTo?: string;
  error?: string;
}

function redirectForRole(role: Role): string {
  if (role === 'contributor') return '/mein-bereich';
  return '/admin';
}

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

export async function logoutAction(): Promise<never> {
  'use server';
  await clearAuthCookie();
  // Throws Next.js redirect control-flow; callers must not catch it.
  // Type is `Promise<never>` because the function never returns normally.
  redirect('/');
}

export interface InviteResult {
  ok: boolean;
  userId?: number;
  error?: string;
}

function actionForInvite(targetRole: Role): Action {
  if (targetRole === 'admin') return 'inviteAdmin';
  if (targetRole === 'editor') return 'inviteEditor';
  if (targetRole === 'reviewer') return 'inviteReviewer';
  return 'inviteContributor';
}

const VALID_ROLES: readonly Role[] = ['admin', 'editor', 'reviewer', 'contributor'];

export async function inviteUserAction(
  email: string,
  role: Role,
  displayName: string,
): Promise<InviteResult> {
  'use server';
  try {
    const session = await requireUser();
    // Guard against tampered POSTs: the action boundary must not trust the
    // client-supplied role. Without this, an unknown role would fall through
    // to `inviteContributor` permission gate but then ValidationError at the
    // DB layer with a developer-string we'd leak to the user.
    if (!VALID_ROLES.includes(role)) {
      return { ok: false, error: 'Ungültige Rolle.' };
    }
    const action = actionForInvite(role);
    if (!hasPermission(session, action, 'users')) {
      return { ok: false, error: `Keine Berechtigung: ${session.role} darf ${role} nicht einladen.` };
    }
    const payload = await payloadInstance();
    const token = generateToken();
    const expires = new Date(Date.now() + INVITE_EXPIRY_MS);
    const tempPassword = generateToken();
    const created = await payload.create({
      collection: 'users',
      data: {
        email,
        password: tempPassword,
        displayName,
        role,
        disabled: false,
        setPasswordToken: token,
        setPasswordTokenExpiresAt: expires.toISOString(),
        invitedBy: session.id,
        invitedAt: new Date().toISOString(),
      } as never,
    });
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const magicLink = `${baseUrl}/passwort-setzen?token=${encodeURIComponent(token)}`;
    const mail = renderInvitationMail({
      to: email,
      displayName,
      role,
      invitedBy: session.displayName,
      magicLink,
      expiresAt: expires,
    });
    await sendMail({ to: email, ...mail });
    return { ok: true, userId: created.id as number };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invite failed.' };
  }
}

export interface SetPasswordResult {
  ok: boolean;
  redirectTo?: string;
  error?: string;
}

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
    //    setPasswordToken/setPasswordTokenExpiresAt are only `admin: { hidden: true }`
    //    (UI-hidden), not field-level hidden — visible via Local API by default.
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

    // 2) Try Payload-native reset token. resetPasswordExpiration is a
    //    Payload base-auth field with field-level `hidden: true` — we need
    //    showHiddenFields:true to read it back for the isTokenValid check.
    const resetFound = await payload.find({
      collection: 'users',
      where: { resetPasswordToken: { equals: token } },
      depth: 0,
      limit: 1,
      showHiddenFields: true,
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
  user: {
    id: number;
    email: string;
    role?: Role;
    displayName?: string;
    setPasswordTokenExpiresAt?: string | null;
  },
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
  user: {
    id: number;
    email: string;
    role?: Role;
    resetPasswordExpiration?: string | null;
  },
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

// ---------------------------------------------------------------------------
// Server-Actions (T8): forgotPassword, updateProfile, deleteOwn, exportOwn
// ---------------------------------------------------------------------------

// Per-email throttle for password-reset requests, to prevent spamming a
// single victim's inbox. NOT a brute-force guard (anti-enumeration already
// returns ok:true on every input, so attackers gain no signal).
//
// In-memory Map — works for single-instance deployment. If PflegeAtlas ever
// scales to serverless or multi-pod, this becomes per-instance which is
// effectively no throttle. Migrate to Redis or DB-backed counter then.
//
// Window 10min, max 3 attempts per email key.
const forgotPasswordBucket = new Map<string, number[]>();
const FP_WINDOW_MS = 10 * 60 * 1000;
const FP_MAX = 3;

function rateLimitOk(key: string): boolean {
  const now = Date.now();
  const buf = (forgotPasswordBucket.get(key) ?? []).filter((t) => now - t < FP_WINDOW_MS);
  if (buf.length >= FP_MAX) {
    forgotPasswordBucket.set(key, buf);
    return false;
  }
  buf.push(now);
  forgotPasswordBucket.set(key, buf);
  // Best-effort GC once the map grows beyond a sensible budget. Prevents
  // unbounded growth from probing bots over long-running processes.
  if (forgotPasswordBucket.size > 1000) {
    for (const [k, v] of forgotPasswordBucket) {
      const live = v.filter((t) => now - t < FP_WINDOW_MS);
      if (live.length === 0) forgotPasswordBucket.delete(k);
      else forgotPasswordBucket.set(k, live);
    }
  }
  return true;
}

export async function requestPasswordResetAction(email: string): Promise<{ ok: true }> {
  'use server';
  // Always return ok (anti-enumeration), but check rate-limit silently
  if (!rateLimitOk(email)) {
    return { ok: true };
  }
  const payload = await payloadInstance();
  try {
    await payload.forgotPassword({
      collection: 'users',
      data: { email },
      disableEmail: false,
    });
  } catch {
    // Swallow — anti-enumeration
  }
  // Anti-enumeration means the client always sees ok:true, but the audit
  // row captures truth: subject is set when the user exists, null when ghost.
  // Forensic value for reset-attack analysis.
  try {
    const found = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      depth: 0,
      limit: 1,
    });
    const subjectUser = found.docs[0] as { id: number; email: string } | undefined;
    await writeAuditLog(payload, {
      eventType: 'password.reset.request',
      subject: subjectUser?.id ?? null,
      subjectEmail: subjectUser?.email ?? null,
      metadata: { emailAttempt: email },
    });
  } catch {
    // Audit failures must never break the anti-enumeration response.
  }
  return { ok: true };
}

export interface OwnProfilePatch {
  displayName?: string;
  bio?: string | null;
  pflegerischeRolle?: string | null;
  bundesland?: string | null;
  avatar?: number | null;
}

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

    await performSelfSoftDelete(payload, session.id, session.email);
    await clearAuthCookie();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Delete failed.' };
  }
}

/**
 * Pure DB-operation: anonymizes a user record and writes the audit row.
 * Extracted from deleteOwnAccountAction so it can be tested without
 * next/headers / cookie context.
 *
 * Avatar-hard-delete (Sub-C2) is NOT called here — keep that in the
 * action-layer because hardDeleteAvatar reads payload state and needs
 * the prior avatar id, which the action already has.
 */
export async function performSelfSoftDelete(
  payload: Payload,
  userId: number,
  userEmail: string,
): Promise<void> {
  await payload.update({
    collection: 'users',
    id: userId,
    data: anonymizeUserPatch() as never,
    overrideAccess: true,
  });
  await writeAuditLog(payload, {
    eventType: 'account.soft_delete.self',
    actor: userId,
    actorEmail: userEmail,
    subject: userId,
    subjectEmail: userEmail,
  });
}

/**
 * Pure DB-operation: builds the full export-JSON for a user. Extracted from
 * exportOwnDataAction so it can be tested without next/headers/cookie context.
 * Includes audit-log entries where actor=userId OR subject=userId
 * (DSGVO Art. 15 Auskunftsrecht für Audit-Daten).
 */
export async function performExportOwnData(
  payload: Payload,
  userId: number,
): Promise<{ ok: boolean; json?: string; error?: string }> {
  try {
    const user = await payload.findByID({ collection: 'users', id: userId, depth: 0 });

    const submissions = await findAllForExport<Record<string, unknown>>({
      payload,
      collection: 'submissions',
      where: { submittedBy: { equals: userId } },
    });

    // `authors` is a hasMany relationship — Payload's `equals` operator
    // matches any document whose array contains the given ID, which is
    // exactly what we want here.
    const articles = await findAllForExport<Record<string, unknown>>({
      payload,
      collection: 'articles',
      where: { authors: { equals: userId } },
    });

    // Sub-C3: audit-log entries — actor=me OR subject=me, sorted -createdAt.
    // Reuses Sub-C1's findAllForExport pagination + 10.000-hard-cap pattern.
    const auditLog = await findAllForExport<Record<string, unknown>>({
      payload,
      collection: 'audit-logs',
      where: {
        or: [
          { actor: { equals: userId } },
          { subject: { equals: userId } },
        ],
      },
      sort: '-createdAt',
    });

    const shape = shapeExport({
      user: user as never,
      submissions,
      articles,
      auditLog,
    });
    return { ok: true, json: JSON.stringify(shape, null, 2) };
  } catch (err) {
    if (err instanceof ExportTooLargeError) {
      return {
        ok: false,
        error:
          'Datenmenge übersteigt 10.000 Einträge — bitte datenschutz@pflegeatlas.org für manuellen Vollexport kontaktieren.',
      };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Export failed.' };
  }
}

export async function exportOwnDataAction(): Promise<{ ok: boolean; json?: string; error?: string }> {
  'use server';
  const session = await requireUser();
  const payload = await payloadInstance();
  return performExportOwnData(payload, session.id);
}
