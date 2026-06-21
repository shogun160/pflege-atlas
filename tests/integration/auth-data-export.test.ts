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
    // Hardens the C1 fix at the integration level: even if Payload's
    // findByID surfaced the invite token (currently it doesn't), our
    // export must never include it.
    expect(data.user).not.toHaveProperty('setPasswordToken');
    expect(data.submissions).toBeInstanceOf(Array);
    expect(data.submissions.some((s: { proposedTitle?: string }) => s.proposedTitle === 'Mine')).toBe(true);
    vi.doUnmock('next/headers');
  });

  it('includes articles where user is in authors hasMany array', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const title = `Export-Test Article ${suffix}`;
    const slug = `export-test-article-${suffix}`;
    await payload.create({
      collection: 'articles',
      data: {
        title,
        slug,
        intent: 'background',
        summary: 'Kurzbeschreibung für den Export-Integration-Test.',
        definition: {
          root: {
            type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
            children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr',
              children: [{ type: 'text', text: 'Def.', format: 0, mode: 'normal', style: '', detail: 0, version: 1 }] }],
          },
        },
        praxis: {
          root: {
            type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
            children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr',
              children: [{ type: 'text', text: 'Pr.', format: 0, mode: 'normal', style: '', detail: 0, version: 1 }] }],
          },
        },
        risiken: {
          root: {
            type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
            children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr',
              children: [{ type: 'text', text: 'Ri.', format: 0, mode: 'normal', style: '', detail: 0, version: 1 }] }],
          },
        },
        quellen: {
          root: {
            type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
            children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr',
              children: [{ type: 'text', text: 'Qu.', format: 0, mode: 'normal', style: '', detail: 0, version: 1 }] }],
          },
        },
        authors: [user.id],
        status: 'draft',
      } as never,
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
    expect(data.articles.some((a: { title?: string }) => a.title === title)).toBe(true);
    vi.doUnmock('next/headers');
  });
});
