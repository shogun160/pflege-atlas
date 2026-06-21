import type { Payload } from 'payload';
import type { Role } from '@/lib/auth-permissions';

export interface UserFixture {
  id: number;
  email: string;
  password: string;
  role: Role;
  displayName: string;
}

export async function createUserFixture(
  payload: Payload,
  role: Role,
  overrides: Partial<UserFixture> = {},
): Promise<UserFixture> {
  const email = overrides.email ?? `${role}-${Date.now()}-${Math.random()}@test.local`;
  const password = overrides.password ?? 'TestPass123!';
  const displayName = overrides.displayName ?? `${role} fixture`;
  const created = await payload.create({
    collection: 'users',
    data: { email, password, displayName, role, disabled: false } as never,
  });
  return { id: created.id as number, email, password, role, displayName };
}

export async function getUserToken(payload: Payload, email: string, password: string): Promise<string> {
  const result = await payload.login({
    collection: 'users',
    data: { email, password },
  });
  return result.token as string;
}
