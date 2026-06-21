import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('mein-bereich page requireUser', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('throws Unauthorized when no session cookie is set', async () => {
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: () => undefined,
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));
    const { requireUser } = await import('@/lib/auth');
    await expect(requireUser()).rejects.toThrow(/unauthorized/i);
    vi.doUnmock('next/headers');
  });

  it('returns session for logged-in contributor', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users',
      data: { email: user.email, password: user.password },
    });

    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (name: string) =>
          name === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));
    const { requireUser } = await import('@/lib/auth');
    const session = await requireUser();
    expect(session.id).toBe(user.id);
    expect(session.role).toBe('contributor');
    vi.doUnmock('next/headers');
  });
});
