import { cookies } from 'next/headers';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { hasPermission, type Action, type Resource, type Role } from './auth-permissions';

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
  } catch {
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
