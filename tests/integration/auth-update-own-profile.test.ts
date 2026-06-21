import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('updateOwnProfileAction', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('updates whitelisted fields', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users', data: { email: user.email, password: user.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { updateOwnProfileAction } = await import('@/lib/auth');
    const result = await updateOwnProfileAction({
      displayName: 'New Name',
      bio: 'new bio',
      pflegerischeRolle: 'pflegefachkraft',
      bundesland: 'bayern',
    });
    expect(result.ok).toBe(true);
    const refetched = await payload.findByID({ collection: 'users', id: user.id });
    expect((refetched as { displayName: string }).displayName).toBe('New Name');
    vi.doUnmock('next/headers');
  });

  it('IGNORES non-whitelisted fields (role, disabled, email)', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users', data: { email: user.email, password: user.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { updateOwnProfileAction } = await import('@/lib/auth');
    await updateOwnProfileAction({
      displayName: 'X',
      role: 'admin' as never,
      disabled: true as never,
      email: 'hijack@x.com' as never,
    });
    const refetched = await payload.findByID({ collection: 'users', id: user.id });
    expect((refetched as { role: string }).role).toBe('contributor');
    expect((refetched as { disabled: boolean }).disabled).toBe(false);
    expect((refetched as { email: string }).email).toBe(user.email);
    vi.doUnmock('next/headers');
  });
});
