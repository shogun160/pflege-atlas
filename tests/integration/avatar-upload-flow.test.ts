import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';
import { MINIMAL_PNG } from '../helpers/avatar-fixture';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('avatar-upload backend', () => {
  it('resizes purpose=avatar upload to 256×256 JPEG via Sharp-Hook', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const created = await payload.create({
      collection: 'media',
      data: {
        alt: 'Test',
        purpose: 'avatar',
        uploadedBy: user.id,
      } as never,
      file: {
        data: MINIMAL_PNG,
        mimetype: 'image/png',
        name: `t-${Date.now()}.png`,
        size: MINIMAL_PNG.length,
      },
    });

    const doc = created as { id: number; width?: number; height?: number; mimeType?: string };
    expect(doc.width).toBe(256);
    expect(doc.height).toBe(256);
    expect(doc.mimeType).toBe('image/jpeg');
  });

  it('does NOT resize when purpose=article_image (only avatar gets resized)', async () => {
    const user = await createUserFixture(payload, 'editor');
    const created = await payload.create({
      collection: 'media',
      data: {
        alt: 'Article test',
        purpose: 'article_image',
        uploadedBy: user.id,
      } as never,
      file: {
        data: MINIMAL_PNG,
        mimetype: 'image/png',
        name: `art-${Date.now()}.png`,
        size: MINIMAL_PNG.length,
      },
    });

    const doc = created as { id: number; width?: number; height?: number; mimeType?: string };
    expect(doc.width).toBe(1);
    expect(doc.height).toBe(1);
    expect(doc.mimeType).toBe('image/png');
  });

  it('Session.avatarUrl is null when user has no avatar', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users',
      data: { email: user.email, password: user.password },
    });
    const { vi } = await import('vitest');
    vi.resetModules();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => (n === 'payload-token' ? { value: token } : undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.avatar).toBeNull();
    expect(session!.avatarUrl).toBeNull();
    vi.doUnmock('next/headers');
  });

  it('Session.avatarUrl contains URL when user has avatar', async () => {
    const { createAvatarFixture } = await import('../helpers/avatar-fixture');
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
    const { vi } = await import('vitest');
    vi.resetModules();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => (n === 'payload-token' ? { value: token } : undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));
    const { getSession } = await import('@/lib/auth');
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.avatar).toBe(avatar.id);
    expect(session!.avatarUrl).toMatch(/^https?:\/\/|^\//);
    vi.doUnmock('next/headers');
  });
});
