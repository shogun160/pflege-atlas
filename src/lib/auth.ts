import { cookies } from 'next/headers';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { hasPermission, type Action, type Resource, type Role } from './auth-permissions';
import { generateToken, INVITE_EXPIRY_MS, isTokenValid } from './auth-tokens';
import { sendMail } from './mail';
import { renderInvitationMail } from './mail-templates/invitation';

export interface Session {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  disabled: boolean;
  avatar?: number | null;
}

async function payloadInstance() {
  return await getPayload({ config });
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
      disabled?: boolean; avatar?: number | { id: number } | null;
    };
    const avatar = typeof u.avatar === 'object' && u.avatar ? u.avatar.id : (u.avatar ?? null);
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName ?? '',
      role: u.role ?? 'contributor',
      disabled: u.disabled ?? false,
      avatar,
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

export async function loginAction(email: string, password: string): Promise<LoginResult> {
  'use server';
  try {
    const payload = await payloadInstance();
    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    });
    if (!result.token) {
      return { ok: false, error: 'Login fehlgeschlagen.' };
    }
    const cookieStore = await cookies();
    cookieStore.set('payload-token', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    const role = (result.user as { role?: Role }).role ?? 'contributor';
    return { ok: true, redirectTo: redirectForRole(role) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login fehlgeschlagen.';
    return { ok: false, error: message };
  }
}

export async function logoutAction(): Promise<void> {
  'use server';
  const cookieStore = await cookies();
  cookieStore.delete('payload-token');
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

export async function inviteUserAction(
  email: string,
  role: Role,
  displayName: string,
): Promise<InviteResult> {
  'use server';
  try {
    const session = await requireUser();
    const action = actionForInvite(role);
    if (!hasPermission(session, action, 'users')) {
      return { ok: false, error: `Permission denied: ${session.role} cannot invite ${role}.` };
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
): Promise<SetPasswordResult> {
  'use server';
  if (newPassword.length < 8) {
    return { ok: false, error: 'Passwort muss mindestens 8 Zeichen lang sein.' };
  }
  if (!token) {
    return { ok: false, error: 'Kein Token übergeben.' };
  }
  try {
    const payload = await payloadInstance();
    const found = await payload.find({
      collection: 'users',
      where: { setPasswordToken: { equals: token } },
      depth: 0,
      limit: 1,
    });
    if (found.docs.length === 0) {
      return { ok: false, error: 'Token ungültig.' };
    }
    const user = found.docs[0] as {
      id: number; email: string; role?: Role;
      setPasswordTokenExpiresAt?: string | null;
    };
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
    const loginResult = await payload.login({
      collection: 'users',
      data: { email: user.email, password: newPassword },
    });
    if (loginResult.token) {
      const cookieStore = await cookies();
      cookieStore.set('payload-token', loginResult.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24,
      });
    }
    const role = (user.role ?? 'contributor') as Role;
    return { ok: true, redirectTo: redirectForRole(role) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Set-Password failed.' };
  }
}
