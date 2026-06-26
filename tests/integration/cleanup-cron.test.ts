import 'dotenv/config';
import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { GET } from '@/app/api/cron/cleanup-submissions/route';
import type { Payload } from 'payload';

const CRON_SECRET = 'test-cron-secret-12345';

/**
 * Helper: force-set `updated_at` on a submission row via raw SQL.
 *
 * Plan-Original used `payload.db.drizzle.execute(sql\`...\`)`, but `drizzle-orm`
 * is not a direct dependency (only transitive via @payloadcms/db-postgres) so it
 * is not resolvable from app/test code. Plan-Fallback A (`payload.update({
 * data: { updatedAt } })`) also fails — Payload's hooks override `updatedAt`
 * back to `now` on every update.
 *
 * The postgres adapter exposes `payload.db.pool` (a `pg.Pool`), which lets us
 * run raw parameterised SQL without adding a dependency. Semantically identical
 * to the plan's intent.
 */
async function setUpdatedAt(payload: Payload, id: string | number, when: Date): Promise<void> {
  const pool = (payload.db as unknown as { pool: { query: (text: string, values: unknown[]) => Promise<unknown> } })
    .pool;
  await pool.query('UPDATE submissions SET updated_at = $1 WHERE id = $2', [when.toISOString(), id]);
}

describe('cleanup-cron route', () => {
  let payload: Payload;

  beforeAll(async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    payload = await getPayload({ config: configPromise });
  });

  beforeEach(async () => {
    // Clear submissions table before each test
    const all = await payload.find({
      collection: 'submissions',
      limit: 1000,
    });
    for (const sub of all.docs) {
      await payload.delete({ collection: 'submissions', id: sub.id });
    }
  });

  it('returns 401 without Authorization header', async () => {
    const req = new Request('http://test/api/cron/cleanup-submissions');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong Bearer token', async () => {
    const req = new Request('http://test/api/cron/cleanup-submissions', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct Bearer token', async () => {
    const req = new Request('http://test/api/cron/cleanup-submissions', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('submissionsDeleted');
    expect(body).toHaveProperty('auditDeleted');
  });

  it('deletes rejected submissions older than 30 days, keeps others', async () => {
    const now = new Date();
    const longAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
    const recent = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    // 1) rejected, >30 days old → SHOULD be deleted
    const oldRejected = await payload.create({
      collection: 'submissions',
      data: {
        type: 'new_article',
        proposedTitle: 'Old rejected submission',
        reviewStatus: 'rejected',
      } as never,
    });
    // Manually set updatedAt to longAgo (see setUpdatedAt JSDoc above).
    await setUpdatedAt(payload, oldRejected.id, longAgo);

    // 2) rejected, <30 days old → SHOULD survive
    const recentRejected = await payload.create({
      collection: 'submissions',
      data: {
        type: 'new_article',
        proposedTitle: 'Recent rejected submission',
        reviewStatus: 'rejected',
      } as never,
    });
    await setUpdatedAt(payload, recentRejected.id, recent);

    // 3) accepted, >30 days old → SHOULD survive (acceptance protects)
    const oldAccepted = await payload.create({
      collection: 'submissions',
      data: {
        type: 'new_article',
        proposedTitle: 'Old accepted submission',
        reviewStatus: 'accepted',
      } as never,
    });
    await setUpdatedAt(payload, oldAccepted.id, longAgo);

    const req = new Request('http://test/api/cron/cleanup-submissions', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.submissionsDeleted).toBe(1);

    // Verify the right ones survived
    const survivors = await payload.find({ collection: 'submissions', limit: 100 });
    const survivorIds = survivors.docs.map((s) => s.id);
    expect(survivorIds).not.toContain(oldRejected.id);
    expect(survivorIds).toContain(recentRejected.id);
    expect(survivorIds).toContain(oldAccepted.id);
  });

  it('is idempotent — running twice yields no errors and 0 deletions on second run', async () => {
    const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const oldRejected = await payload.create({
      collection: 'submissions',
      data: {
        type: 'new_article',
        proposedTitle: 'Idempotency test',
        reviewStatus: 'rejected',
      } as never,
    });
    await setUpdatedAt(payload, oldRejected.id, longAgo);

    const req = new Request('http://test/api/cron/cleanup-submissions', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res1 = await GET(req);
    expect(res1.status).toBe(200);
    expect((await res1.json()).submissionsDeleted).toBe(1);

    const res2 = await GET(req);
    expect(res2.status).toBe(200);
    expect((await res2.json()).submissionsDeleted).toBe(0);
  });
});
