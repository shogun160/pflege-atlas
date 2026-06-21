import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';
import { sendMail } from '@/lib/mail';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('inviteUserAction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(sendMail).mockClear();
  });

  it('admin can invite an editor; user created with token + invitation mail sent', async () => {
    const admin = await createUserFixture(payload, 'admin');
    const { token: adminToken } = await payload.login({
      collection: 'users', data: { email: admin.email, password: admin.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: adminToken } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { inviteUserAction } = await import('@/lib/auth');
    const email = `invited-${Date.now()}@test.local`;
    const result = await inviteUserAction(email, 'editor', 'Invited Editor');
    expect(result.ok).toBe(true);
    const found = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      depth: 0,
    });
    expect(found.docs).toHaveLength(1);
    const user = found.docs[0] as { setPasswordToken?: string; role?: string };
    expect(user.role).toBe('editor');
    expect(user.setPasswordToken).toBeTruthy();
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
    vi.doUnmock('next/headers');
  });

  it('editor can invite a reviewer but NOT an admin (privilege escalation)', async () => {
    const editor = await createUserFixture(payload, 'editor');
    const { token } = await payload.login({
      collection: 'users', data: { email: editor.email, password: editor.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { inviteUserAction } = await import('@/lib/auth');
    const okResult = await inviteUserAction(`rev-${Date.now()}@test.local`, 'reviewer', 'Rev');
    expect(okResult.ok).toBe(true);
    const blockedResult = await inviteUserAction(`adm-${Date.now()}@test.local`, 'admin', 'A');
    expect(blockedResult.ok).toBe(false);
    expect(blockedResult.error).toMatch(/permission|forbidden|verboten|berechtigung/i);
    vi.doUnmock('next/headers');
  });

  it('contributor cannot invite anyone', async () => {
    const contrib = await createUserFixture(payload, 'contributor');
    const { token } = await payload.login({
      collection: 'users', data: { email: contrib.email, password: contrib.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { inviteUserAction } = await import('@/lib/auth');
    const result = await inviteUserAction(`x-${Date.now()}@test.local`, 'contributor', 'X');
    expect(result.ok).toBe(false);
    vi.doUnmock('next/headers');
  });
});
