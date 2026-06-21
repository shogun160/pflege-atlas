import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('auth.getSession', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns user data when valid token is in cookies', async () => {
    const editor = await createUserFixture(payload, 'editor');
    const { token } = await payload.login({
      collection: 'users',
      data: { email: editor.email, password: editor.password },
    });

    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (name: string) => name === 'payload-token' ? { value: token } : undefined,
      }),
    }));

    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    expect(session?.email).toBe(editor.email);
    expect(session?.role).toBe('editor');
    expect(session?.disabled).toBe(false);
    expect(session).not.toHaveProperty('password');
    vi.doUnmock('next/headers');
  });

  it('returns null when no token cookie is set', async () => {
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ get: () => undefined }),
    }));
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    expect(session).toBeNull();
    vi.doUnmock('next/headers');
  });
});
