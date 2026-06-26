import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

async function clearAuditLogs() {
  // Drizzle raw-SQL delete — Payload-collection-delete would be slow for cleanup
  await (payload.db as { drizzle: { execute: (sql: unknown) => Promise<unknown> } })
    .drizzle.execute('DELETE FROM audit_logs');
}

async function findLatestAudit(eventType: string) {
  const res = await payload.find({
    collection: 'audit-logs',
    where: { eventType: { equals: eventType } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
  });
  return (res.docs[0] ?? null) as null | {
    actor: number | null;
    actorEmail: string | null;
    subject: number | null;
    subjectEmail: string | null;
    metadata: Record<string, unknown> | null;
    ipHash: string | null;
    userAgent: string | null;
  };
}

describe('audit-log triggers — login', () => {
  beforeEach(async () => {
    vi.resetModules();
    await clearAuditLogs();
  });

  it('writes login.success with actor + ipHash + userAgent when request headers passed', async () => {
    const user = await createUserFixture(payload, 'contributor');
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { loginAction } = await import('@/lib/auth');
    const headers = new Headers({ 'x-forwarded-for': '1.2.3.4', 'user-agent': 'TestUA/1.0' });
    const result = await loginAction(user.email, user.password, headers);
    expect(result.ok).toBe(true);

    const audit = await findLatestAudit('login.success');
    expect(audit).toBeTruthy();
    expect(audit!.actor).toBe(user.id);
    expect(audit!.actorEmail).toBe(user.email);
    expect(audit!.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(audit!.userAgent).toBe('TestUA/1.0');
    vi.doUnmock('next/headers');
  });

  it('writes login.failure with bucket=wrong-password for invalid password', async () => {
    const user = await createUserFixture(payload, 'contributor');
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { loginAction } = await import('@/lib/auth');
    const result = await loginAction(user.email, 'WrongPassword');
    expect(result.ok).toBe(false);

    const audit = await findLatestAudit('login.failure');
    expect(audit).toBeTruthy();
    expect(audit!.actorEmail).toBe(user.email);
    expect((audit!.metadata as { bucket?: string }).bucket).toBe('wrong-password');
    expect((audit!.metadata as { emailAttempt?: string }).emailAttempt).toBe(user.email);
    vi.doUnmock('next/headers');
  });

  it('writes login.failure with bucket=unknown for nonexistent email (NO Email-Existence-Oracle)', async () => {
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { loginAction } = await import('@/lib/auth');
    const result = await loginAction('nonexistent-' + Date.now() + '@test.local', 'AnyPass');
    expect(result.ok).toBe(false);

    const audit = await findLatestAudit('login.failure');
    expect(audit).toBeTruthy();
    expect(audit!.actor).toBeNull();
    expect(audit!.actorEmail).toBeNull();
    expect((audit!.metadata as { bucket?: string }).bucket).toBe('unknown');
    expect((audit!.metadata as { emailAttempt?: string }).emailAttempt).toMatch(/^nonexistent-/);
    vi.doUnmock('next/headers');
  });

  it('writes login.failure with bucket=disabled for disabled account', async () => {
    const user = await createUserFixture(payload, 'contributor');
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { disabled: true } as never,
      overrideAccess: true,
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { loginAction } = await import('@/lib/auth');
    const result = await loginAction(user.email, user.password);
    expect(result.ok).toBe(false);

    const audit = await findLatestAudit('login.failure');
    expect(audit).toBeTruthy();
    expect((audit!.metadata as { bucket?: string }).bucket).toBe('disabled');
    vi.doUnmock('next/headers');
  });
});

describe('audit-log triggers — password reset', () => {
  beforeEach(async () => {
    await clearAuditLogs();
  });

  it('writes password.reset.request with subject for existing user', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { requestPasswordResetAction } = await import('@/lib/auth');
    await requestPasswordResetAction(user.email);

    const audit = await findLatestAudit('password.reset.request');
    expect(audit).toBeTruthy();
    expect(audit!.subject).toBe(user.id);
    expect((audit!.metadata as { emailAttempt?: string }).emailAttempt).toBe(user.email);
  });

  it('writes password.reset.request with subject=null for unknown email', async () => {
    const { requestPasswordResetAction } = await import('@/lib/auth');
    const ghost = 'ghost-' + Date.now() + '@test.local';
    await requestPasswordResetAction(ghost);

    const audit = await findLatestAudit('password.reset.request');
    expect(audit).toBeTruthy();
    expect(audit!.subject).toBeNull();
    expect((audit!.metadata as { emailAttempt?: string }).emailAttempt).toBe(ghost);
  });
});

describe('audit-log triggers — invitation accept vs password reset complete', () => {
  beforeEach(async () => {
    vi.resetModules();
    await clearAuditLogs();
  });

  it('writes invitation.accept when token pattern matches invitation (invitedAt + 7d ≈ tokenExpiresAt)', async () => {
    const invitedAt = new Date();
    const tokenExpiresAt = new Date(invitedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'invitee-' + Date.now() + '@test.local',
        password: 'temp-' + Math.random(),
        displayName: 'Invitee',
        role: 'contributor',
        setPasswordToken: 'inv-token-' + Date.now(),
        setPasswordTokenExpiresAt: tokenExpiresAt.toISOString(),
        invitedAt: invitedAt.toISOString(),
      } as never,
    });
    const tokenValue = (user as { setPasswordToken: string }).setPasswordToken;
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction(tokenValue, 'NewPass123!');
    expect(result.ok).toBe(true);

    const audit = await findLatestAudit('invitation.accept');
    expect(audit).toBeTruthy();
    expect(audit!.actor).toBe(user.id as number);
    vi.doUnmock('next/headers');
  });

  it('writes password.reset.complete when token pattern matches reset (NO invitedAt OR tokenExpiresAt close to 1h)', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        setPasswordToken: 'reset-token-' + Date.now(),
        setPasswordTokenExpiresAt: resetExpiresAt.toISOString(),
      } as never,
      overrideAccess: true,
    });
    const fresh = await payload.findByID({ collection: 'users', id: user.id });
    const tokenValue = (fresh as { setPasswordToken: string }).setPasswordToken;
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction(tokenValue, 'NewPass123!');
    expect(result.ok).toBe(true);

    const audit = await findLatestAudit('password.reset.complete');
    expect(audit).toBeTruthy();
    expect(audit!.actor).toBe(user.id);
    vi.doUnmock('next/headers');
  });
});
