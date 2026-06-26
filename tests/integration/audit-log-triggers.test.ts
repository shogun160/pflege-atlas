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

describe('audit-log triggers — users.afterChange', () => {
  let admin: { id: number; email: string; password: string; role: 'admin' };

  beforeEach(async () => {
    await clearAuditLogs();
    const adminDoc = await payload.create({
      collection: 'users',
      data: {
        email: 'admin-t5-' + Date.now() + '-' + Math.random() + '@test.local',
        password: 'AdminPass123!',
        displayName: 'Admin T5',
        role: 'admin',
      } as never,
    });
    admin = {
      id: adminDoc.id as number,
      email: (adminDoc as { email: string }).email,
      password: 'AdminPass123!',
      role: 'admin',
    };
    // Admin creation doesn't carry setPasswordToken+invitedAt, so no invitation.create row.
    // Still, clear defensively to keep findLatestAudit assertions deterministic.
    await clearAuditLogs();
  });

  it('writes role.change when role field changes via payload.update by admin', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'rc-' + Date.now() + '@test.local',
        password: 'TestPass123!',
        displayName: 'RC',
        role: 'reviewer',
      } as never,
    });

    await payload.update({
      collection: 'users',
      id: user.id,
      data: { role: 'editor' } as never,
      user: admin as never,
      overrideAccess: true,
    });

    const audit = await findLatestAudit('role.change');
    expect(audit).toBeTruthy();
    expect(audit!.actor).toBe(admin.id);
    expect(audit!.subject).toBe(user.id);
    expect((audit!.metadata as { oldRole?: string }).oldRole).toBe('reviewer');
    expect((audit!.metadata as { newRole?: string }).newRole).toBe('editor');
  });

  it('writes account.disable when disabled flips false → true', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'disable-' + Date.now() + '@test.local',
        password: 'TestPass123!',
        displayName: 'D',
        role: 'contributor',
        disabled: false,
      } as never,
    });

    await payload.update({
      collection: 'users',
      id: user.id,
      data: { disabled: true } as never,
      user: admin as never,
      overrideAccess: true,
    });

    const audit = await findLatestAudit('account.disable');
    expect(audit).toBeTruthy();
    expect(audit!.actor).toBe(admin.id);
    expect(audit!.subject).toBe(user.id);
  });

  it('does NOT write account.disable when disabled remains true (idempotent update)', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'disable-idemp-' + Date.now() + '@test.local',
        password: 'TestPass123!',
        displayName: 'DI',
        role: 'contributor',
        disabled: true,
      } as never,
    });

    await payload.update({
      collection: 'users',
      id: user.id,
      data: { displayName: 'DI-renamed', disabled: true } as never,
      user: admin as never,
      overrideAccess: true,
    });

    const audit = await findLatestAudit('account.disable');
    expect(audit).toBeNull();
  });

  it('writes invitation.create when new user is created with setPasswordToken + invitedAt', async () => {
    const newUser = await payload.create({
      collection: 'users',
      data: {
        email: 'invitee-t5-' + Date.now() + '@test.local',
        password: 'temp-' + Math.random(),
        displayName: 'Invitee T5',
        role: 'reviewer',
        setPasswordToken: 'inv-token-t5-' + Date.now(),
        setPasswordTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        invitedBy: admin.id,
        invitedAt: new Date().toISOString(),
      } as never,
      user: admin as never,
      overrideAccess: true,
    });

    const audit = await findLatestAudit('invitation.create');
    expect(audit).toBeTruthy();
    expect(audit!.actor).toBe(admin.id);
    expect(audit!.subject).toBe(newUser.id);
    expect((audit!.metadata as { assignedRole?: string }).assignedRole).toBe('reviewer');
  });

  it('writes email.change.admin when admin changes another users email', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'email-old-' + Date.now() + '@test.local',
        password: 'TestPass123!',
        displayName: 'EC',
        role: 'contributor',
      } as never,
    });
    const newEmail = 'email-new-' + Date.now() + '@test.local';

    await payload.update({
      collection: 'users',
      id: user.id,
      data: { email: newEmail } as never,
      user: admin as never,
      overrideAccess: true,
    });

    const audit = await findLatestAudit('email.change.admin');
    expect(audit).toBeTruthy();
    expect(audit!.actor).toBe(admin.id);
    expect(audit!.subject).toBe(user.id);
    expect((audit!.metadata as { oldEmail?: string }).oldEmail).toMatch(/^email-old-/);
    expect((audit!.metadata as { newEmail?: string }).newEmail).toBe(newEmail);
  });

  it('does NOT write email.change.admin when user changes own email (self-edit)', async () => {
    // Per V1.6 spec, self email-change is disabled — but the hook condition
    // still needs to defend in case that ever loosens.
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'self-edit-' + Date.now() + '@test.local',
        password: 'TestPass123!',
        displayName: 'SE',
        role: 'contributor',
      } as never,
    });

    await payload.update({
      collection: 'users',
      id: user.id,
      data: { email: 'self-new-' + Date.now() + '@test.local' } as never,
      user: { id: user.id, email: user.email, role: 'contributor' } as never,
      overrideAccess: true,
    });

    const audit = await findLatestAudit('email.change.admin');
    expect(audit).toBeNull();
  });
});

describe('audit-log trigger — account.soft_delete.self', () => {
  let payload: Awaited<ReturnType<typeof getPayload>>;

  beforeEach(async () => {
    payload = await getPayload({ config });
    await (payload.db as { drizzle: { execute: (sql: unknown) => Promise<unknown> } })
      .drizzle.execute('DELETE FROM audit_logs');
  });

  it('writes account.soft_delete.self when performSelfSoftDelete is called', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'self-delete-' + Date.now() + '@test.local',
        password: 'TestPass123!',
        displayName: 'SelfDelete',
        role: 'contributor',
      } as never,
    });

    const { performSelfSoftDelete } = await import('@/lib/auth');
    await performSelfSoftDelete(payload, user.id as number, (user as { email: string }).email);

    const res = await payload.find({
      collection: 'audit-logs',
      where: { eventType: { equals: 'account.soft_delete.self' } },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
    });
    const audit = res.docs[0] as null | {
      actor: number | null;
      actorEmail: string | null;
      subject: number | null;
      subjectEmail: string | null;
    };
    expect(audit).toBeTruthy();
    expect(audit!.actor).toBe(user.id);
    expect(audit!.subject).toBe(user.id);
    expect(audit!.actorEmail).toMatch(/^self-delete-/);
    expect(audit!.subjectEmail).toMatch(/^self-delete-/);
  });

  it('anonymizes the user record via anonymizeUserPatch', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: 'self-delete-anon-' + Date.now() + '@test.local',
        password: 'TestPass123!',
        displayName: 'AnonMe',
        role: 'contributor',
      } as never,
    });

    const { performSelfSoftDelete } = await import('@/lib/auth');
    await performSelfSoftDelete(payload, user.id as number, (user as { email: string }).email);

    // Verify the user record was anonymized (email rewritten to deleted-{id}@…)
    const after = await payload.findByID({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
    });
    expect((after as { email: string }).email).toMatch(/^deleted-/);
  });
});
