import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('deleteOwnAccountAction', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('anonymizes contributor account', async () => {
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
    const { deleteOwnAccountAction } = await import('@/lib/auth');
    const result = await deleteOwnAccountAction('LÖSCHEN');
    expect(result.ok).toBe(true);
    const refetched = await payload.findByID({ collection: 'users', id: user.id });
    expect((refetched as { disabled: boolean }).disabled).toBe(true);
    expect((refetched as { email: string }).email).toMatch(/^deleted-/);
    vi.doUnmock('next/headers');
  });

  it('rejects admin self-delete', async () => {
    const admin = await createUserFixture(payload, 'admin');
    const { token } = await payload.login({
      collection: 'users', data: { email: admin.email, password: admin.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { deleteOwnAccountAction } = await import('@/lib/auth');
    const result = await deleteOwnAccountAction('LÖSCHEN');
    expect(result.ok).toBe(false);
    vi.doUnmock('next/headers');
  });

  it('rejects without confirmation string', async () => {
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
    const { deleteOwnAccountAction } = await import('@/lib/auth');
    const result = await deleteOwnAccountAction('wrong');
    expect(result.ok).toBe(false);
    vi.doUnmock('next/headers');
  });
});
