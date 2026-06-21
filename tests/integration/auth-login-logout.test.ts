import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('loginAction', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns ok + redirect path for editor', async () => {
    const editor = await createUserFixture(payload, 'editor');
    const cookieSet = vi.fn();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: cookieSet, delete: vi.fn(), get: () => undefined }),
    }));
    const { loginAction } = await import('@/lib/auth');
    const result = await loginAction(editor.email, editor.password);
    expect(result.ok).toBe(true);
    expect(result.redirectTo).toBe('/admin');
    expect(cookieSet).toHaveBeenCalled();
    vi.doUnmock('next/headers');
  });

  it('returns ok + /mein-bereich redirect for contributor', async () => {
    const contributor = await createUserFixture(payload, 'contributor');
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { loginAction } = await import('@/lib/auth');
    const result = await loginAction(contributor.email, contributor.password);
    expect(result.redirectTo).toBe('/mein-bereich');
    vi.doUnmock('next/headers');
  });

  it('returns error for wrong password', async () => {
    const editor = await createUserFixture(payload, 'editor');
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { loginAction } = await import('@/lib/auth');
    const result = await loginAction(editor.email, 'wrong-password');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    vi.doUnmock('next/headers');
  });

  it('blocks login for disabled user even with correct password', async () => {
    const user = await createUserFixture(payload, 'contributor');
    await payload.update({ collection: 'users', id: user.id, data: { disabled: true } as never });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { loginAction } = await import('@/lib/auth');
    const result = await loginAction(user.email, user.password);
    expect(result.ok).toBe(false);
    vi.doUnmock('next/headers');
  });
});

describe('logoutAction', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('deletes payload-token cookie and redirects to /', async () => {
    const cookieDelete = vi.fn();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ delete: cookieDelete, set: vi.fn(), get: () => undefined }),
    }));
    const { logoutAction } = await import('@/lib/auth');
    const { isRedirectError } = await import('next/dist/client/components/redirect-error');
    // Post-B6: logoutAction throws a Next.js redirect control-flow.
    let thrown: unknown;
    try {
      await logoutAction();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeTruthy();
    expect(isRedirectError(thrown)).toBe(true);
    expect(cookieDelete).toHaveBeenCalledWith('payload-token');
    vi.doUnmock('next/headers');
  });
});
