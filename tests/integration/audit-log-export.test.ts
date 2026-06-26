import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('audit-log export integration', () => {
  beforeEach(async () => {
    await (payload.db as { drizzle: { execute: (sql: unknown) => Promise<unknown> } })
      .drizzle.execute('DELETE FROM audit_logs');
  });

  it('includes own audit entries (actor=me OR subject=me) in performExportOwnData', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'export-t8-' + Date.now() + '@test.local',
        password: 'TestPass123!',
        displayName: 'Exporter T8',
        role: 'contributor',
      } as never,
    });
    const userId = user.id as number;
    const userEmail = (user as { email: string }).email;

    const stranger = await payload.create({
      collection: 'users',
      data: {
        email: 'stranger-' + Date.now() + '@test.local',
        password: 'TestPass123!',
        displayName: 'Stranger',
        role: 'contributor',
      } as never,
    });

    // Seed 3 audit rows for self (1 as actor only, 1 as subject only, 1 as both)
    await payload.create({
      collection: 'audit-logs',
      data: {
        eventType: 'login.success',
        actor: userId,
        actorEmail: userEmail,
        ipHash: 'aaaa',
        userAgent: 'TestUA',
      } as never,
      overrideAccess: true,
    });
    await payload.create({
      collection: 'audit-logs',
      data: {
        eventType: 'role.change',
        actor: stranger.id as number,
        subject: userId,
        subjectEmail: userEmail,
        metadata: { oldRole: 'contributor', newRole: 'reviewer' },
      } as never,
      overrideAccess: true,
    });
    await payload.create({
      collection: 'audit-logs',
      data: {
        eventType: 'password.reset.complete',
        actor: userId, actorEmail: userEmail,
        subject: userId, subjectEmail: userEmail,
      } as never,
      overrideAccess: true,
    });

    // Seed 1 stranger-only row that MUST NOT appear in our export
    await payload.create({
      collection: 'audit-logs',
      data: {
        eventType: 'login.success',
        actor: stranger.id as number,
        actorEmail: (stranger as { email: string }).email,
      } as never,
      overrideAccess: true,
    });

    const { performExportOwnData } = await import('@/lib/auth');
    const result = await performExportOwnData(payload, userId);

    expect(result.ok).toBe(true);
    const json = JSON.parse(result.json!);
    expect(json.auditLog).toBeDefined();
    expect(Array.isArray(json.auditLog)).toBe(true);
    expect(json.auditLog).toHaveLength(3);

    // Sorted by createdAt DESC: most-recent first
    expect(json.auditLog[0].eventType).toBe('password.reset.complete');

    // Stranger's row not present
    expect(json.auditLog.every((e: { actorEmail?: string }) =>
      e.actorEmail !== (stranger as { email: string }).email,
    )).toBe(true);

    // ipHash + userAgent + actor + subject must NOT be exported
    for (const entry of json.auditLog) {
      expect('ipHash' in entry).toBe(false);
      expect('userAgent' in entry).toBe(false);
      expect('actor' in entry).toBe(false);
      expect('subject' in entry).toBe(false);
    }

    // What IS exported per entry
    expect(json.auditLog[0]).toHaveProperty('createdAt');
    expect(json.auditLog[0]).toHaveProperty('eventType');
    expect(json.auditLog[0]).toHaveProperty('actorEmail');
    expect(json.auditLog[0]).toHaveProperty('subjectEmail');
    expect(json.auditLog[0]).toHaveProperty('metadata');
  });
});
