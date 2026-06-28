import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';
import { createAvatarFixture } from '../helpers/avatar-fixture';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('cleanupOrphanAvatars', () => {
  it('deletes avatar-media without user-reference older than 24h', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const avatar = await createAvatarFixture(payload, user.id);
    // Backdate createdAt by 25h via direct DB
    const pgPool = (payload.db as { pool: { query: (s: string, p: unknown[]) => Promise<unknown> } }).pool;
    await pgPool.query(
      'UPDATE media SET created_at = NOW() - INTERVAL \'25 hours\' WHERE id = $1',
      [avatar.id],
    );

    const { cleanupOrphanAvatars } = await import('@/lib/avatar-orphan-cleanup');
    const deleted = await cleanupOrphanAvatars(payload);
    expect(deleted).toBeGreaterThanOrEqual(1);

    await expect(
      payload.findByID({ collection: 'media', id: avatar.id }),
    ).rejects.toThrow();
  });

  it('keeps avatar-media that IS referenced by a user', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const avatar = await createAvatarFixture(payload, user.id);
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { avatar: avatar.id } as never,
    });
    const pgPool = (payload.db as { pool: { query: (s: string, p: unknown[]) => Promise<unknown> } }).pool;
    await pgPool.query(
      'UPDATE media SET created_at = NOW() - INTERVAL \'25 hours\' WHERE id = $1',
      [avatar.id],
    );

    const { cleanupOrphanAvatars } = await import('@/lib/avatar-orphan-cleanup');
    await cleanupOrphanAvatars(payload);

    const stillThere = await payload.findByID({ collection: 'media', id: avatar.id });
    expect(stillThere).toBeTruthy();
  });

  it('keeps avatar-media younger than 24h (grace period)', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const avatar = await createAvatarFixture(payload, user.id);
    // createdAt = now (default) → in der Grace-Period

    const { cleanupOrphanAvatars } = await import('@/lib/avatar-orphan-cleanup');
    await cleanupOrphanAvatars(payload);

    const stillThere = await payload.findByID({ collection: 'media', id: avatar.id });
    expect(stillThere).toBeTruthy();
  });
});
