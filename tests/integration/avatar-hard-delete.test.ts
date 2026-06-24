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

describe('avatar hard-delete on profile-update', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hard-deletes old avatar when user removes avatar (id → null)', async () => {
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

    const { updateOwnProfileAction } = await import('@/lib/auth');
    const result = await updateOwnProfileAction({ avatar: null });
    expect(result.ok).toBe(true);

    await expect(
      payload.findByID({ collection: 'media', id: avatar.id }),
    ).rejects.toThrow();

    const refetched = await payload.findByID({ collection: 'users', id: user.id });
    expect((refetched as { avatar: number | null }).avatar).toBeNull();

    vi.doUnmock('next/headers');
  });

  it('hard-deletes old avatar when user replaces avatar (oldId → newId)', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const oldAvatar = await createAvatarFixture(payload, user.id);
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { avatar: oldAvatar.id } as never,
    });
    const newAvatar = await createAvatarFixture(payload, user.id);

    const { token } = await payload.login({
      collection: 'users',
      data: { email: user.email, password: user.password },
    });
    mockSessionCookie(token);

    const { updateOwnProfileAction } = await import('@/lib/auth');
    const result = await updateOwnProfileAction({ avatar: newAvatar.id });
    expect(result.ok).toBe(true);

    await expect(
      payload.findByID({ collection: 'media', id: oldAvatar.id }),
    ).rejects.toThrow();

    const newStill = await payload.findByID({ collection: 'media', id: newAvatar.id });
    expect((newStill as { id: number }).id).toBe(newAvatar.id);

    const refetched = await payload.findByID({ collection: 'users', id: user.id });
    const refAvatar = (refetched as { avatar: number | { id: number } | null }).avatar;
    const refAvatarId =
      typeof refAvatar === 'object' && refAvatar ? refAvatar.id : refAvatar;
    expect(refAvatarId).toBe(newAvatar.id);

    vi.doUnmock('next/headers');
  });
});
