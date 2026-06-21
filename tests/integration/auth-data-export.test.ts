import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('exportOwnDataAction', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns JSON with user + submissions, no password', async () => {
    const user = await createUserFixture(payload, 'contributor');
    await payload.create({
      collection: 'submissions',
      data: { type: 'new_article', proposedTitle: 'Mine', submittedBy: user.id } as never,
    });
    const { token } = await payload.login({
      collection: 'users', data: { email: user.email, password: user.password },
    });
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (n: string) => n === 'payload-token' ? { value: token } : undefined,
        set: vi.fn(), delete: vi.fn(),
      }),
    }));
    const { exportOwnDataAction } = await import('@/lib/auth');
    const result = await exportOwnDataAction();
    expect(result.ok).toBe(true);
    expect(result.json).toBeTruthy();
    const data = JSON.parse(result.json!);
    expect(data.user.email).toBe(user.email);
    expect(data.user).not.toHaveProperty('password');
    expect(data.submissions).toBeInstanceOf(Array);
    expect(data.submissions.some((s: { proposedTitle?: string }) => s.proposedTitle === 'Mine')).toBe(true);
    vi.doUnmock('next/headers');
  });
});
