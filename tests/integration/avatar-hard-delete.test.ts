import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';
import { createAvatarFixture } from '../helpers/avatar-fixture';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

function mockSessionCookie(token: string | undefined) {
  vi.doMock('next/headers', () => ({
    cookies: async () => ({
      get: (n: string) => (n === 'payload-token' ? { value: token } : undefined),
      set: vi.fn(),
      delete: vi.fn(),
    }),
  }));
}

describe('avatar hard-delete on account-delete', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hard-deletes avatar media when user deletes their account', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const avatar = await createAvatarFixture(payload, user.id);
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { avatar: avatar.id } as never,
    });

    const { token } = await payload.login({
      collection: 'users',
      data: { email: user.email, password: user.password },
    });
    mockSessionCookie(token);

    const { deleteOwnAccountAction } = await import('@/lib/auth');
    const result = await deleteOwnAccountAction('LÖSCHEN');
    expect(result.ok).toBe(true);

    await expect(
      payload.findByID({ collection: 'media', id: avatar.id }),
    ).rejects.toThrow();

    const refetched = await payload.findByID({ collection: 'users', id: user.id });
    expect((refetched as { disabled: boolean }).disabled).toBe(true);

    vi.doUnmock('next/headers');
  });

  it('no-ops gracefully when user has no avatar', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users',
      data: { email: user.email, password: user.password },
    });
    mockSessionCookie(token);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deleteSpy = vi.spyOn(payload, 'delete');

    const { deleteOwnAccountAction } = await import('@/lib/auth');
    const result = await deleteOwnAccountAction('LÖSCHEN');
    expect(result.ok).toBe(true);

    const avatarWarns = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('avatar-cleanup'),
    );
    expect(avatarWarns).toHaveLength(0);

    const mediaDeletes = deleteSpy.mock.calls.filter(
      (c) => (c[0] as { collection?: string })?.collection === 'media',
    );
    expect(mediaDeletes).toHaveLength(0);

    deleteSpy.mockRestore();
    warnSpy.mockRestore();
    vi.doUnmock('next/headers');
  });
});
