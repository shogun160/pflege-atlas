import { describe, it, expect, vi } from 'vitest';
import type { Payload, Where } from 'payload';
import {
  shapeExport,
  findAllForExport,
  EXPORT_HARD_CAP,
  EXPORT_PAGE_SIZE,
  ExportTooLargeError,
} from '@/lib/data-export';

describe('shapeExport', () => {
  it('strips password and includes expected sections', () => {
    const export_ = shapeExport({
      user: { id: 1, email: 'a@b.com', displayName: 'A', role: 'contributor', password: 'shouldnotappear' } as never,
      submissions: [{ id: 10, type: 'new_article', proposedTitle: 'X' } as never],
      articles: [{ id: 20, title: 'Y' } as never],
    });
    expect(export_.user.email).toBe('a@b.com');
    expect(export_.user).not.toHaveProperty('password');
    expect(export_.submissions).toHaveLength(1);
    expect(export_.articles).toHaveLength(1);
    expect(export_.exportedAt).toMatch(/T/);
  });

  it('strips all sensitive auth/credential fields', () => {
    // Intentionally duplicated inline (not imported from the module) to keep
    // the test independent — if the module's allow-list ever drifts, this
    // test still locks the security contract.
    const userInput = {
      id: 1,
      email: 'a@b.com',
      displayName: 'A',
      role: 'contributor',
      password: 'shouldnotappear',
      setPasswordToken: 'invite-token',
      setPasswordTokenExpiresAt: '2030-01-01T00:00:00.000Z',
      resetPasswordToken: 'reset-token',
      resetPasswordExpiration: '2030-01-01T00:00:00.000Z',
      salt: 'salt',
      hash: 'hash',
      loginAttempts: 2,
      lockUntil: '2030-01-01T00:00:00.000Z',
      sessions: [{ id: 'x' }],
      apiKey: 'k',
      apiKeyIndex: 'i',
    };
    const export_ = shapeExport({ user: userInput as never, submissions: [], articles: [] });
    for (const field of [
      'password',
      'setPasswordToken',
      'setPasswordTokenExpiresAt',
      'resetPasswordToken',
      'resetPasswordExpiration',
      'salt',
      'hash',
      'loginAttempts',
      'lockUntil',
      'sessions',
      'apiKey',
      'apiKeyIndex',
    ]) {
      expect(export_.user).not.toHaveProperty(field);
    }
    // Non-sensitive fields still pass through:
    expect(export_.user.email).toBe('a@b.com');
    expect(export_.user.role).toBe('contributor');
  });
});

describe('export constants and errors', () => {
  it('exports EXPORT_HARD_CAP = 10_000', () => {
    expect(EXPORT_HARD_CAP).toBe(10_000);
  });

  it('exports EXPORT_PAGE_SIZE = 500', () => {
    expect(EXPORT_PAGE_SIZE).toBe(500);
  });

  it('ExportTooLargeError carries collection name + count in message', () => {
    const err = new ExportTooLargeError('submissions', 10_000);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ExportTooLargeError');
    expect(err.message).toContain('submissions');
    expect(err.message).toContain('10000');
  });
});

function makePaginatedMock(pages: Array<Array<Record<string, unknown>>>) {
  const findMock = vi.fn(async ({ page }: { page?: number }) => {
    const idx = (page ?? 1) - 1;
    const docs = pages[idx] ?? [];
    return {
      docs,
      hasNextPage: idx < pages.length - 1,
      page: page ?? 1,
      totalDocs: pages.reduce((sum, p) => sum + p.length, 0),
    };
  });
  return { find: findMock } as unknown as Payload;
}

describe('findAllForExport', () => {
  it('collects docs across multiple pages', async () => {
    const page1 = Array.from({ length: 500 }, (_, i) => ({ id: i + 1 }));
    const page2 = Array.from({ length: 500 }, (_, i) => ({ id: i + 501 }));
    const page3 = Array.from({ length: 500 }, (_, i) => ({ id: i + 1001 }));
    const payload = makePaginatedMock([page1, page2, page3]);

    const result = await findAllForExport<{ id: number }>({
      payload,
      collection: 'submissions',
      where: {} as Where,
    });

    expect(result).toHaveLength(1500);
    expect(result[0]?.id).toBe(1);
    expect(result[1499]?.id).toBe(1500);
    expect(payload.find).toHaveBeenCalledTimes(3);
  });

  it('returns immediately when only one page exists', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
    const payload = makePaginatedMock([page1]);

    const result = await findAllForExport<{ id: number }>({
      payload,
      collection: 'articles',
      where: {} as Where,
    });

    expect(result).toHaveLength(100);
    expect(payload.find).toHaveBeenCalledTimes(1);
  });

  it('throws ExportTooLargeError when accumulated docs reach the cap', async () => {
    // 21 pages of 500 = 10_500 — overshoots the cap of 10_000 on page 20.
    const pages = Array.from({ length: 21 }, (_, p) =>
      Array.from({ length: 500 }, (_, i) => ({ id: p * 500 + i + 1 })),
    );
    const payload = makePaginatedMock(pages);

    await expect(
      findAllForExport({
        payload,
        collection: 'submissions',
        where: {} as Where,
      }),
    ).rejects.toBeInstanceOf(ExportTooLargeError);
  });

  it('shapeExport accepts a merged paginated list', () => {
    const merged = Array.from({ length: 1500 }, (_, i) => ({ id: i + 1 }));
    const out = shapeExport({
      user: { id: 1, email: 'a@b.com' } as never,
      submissions: merged as never,
      articles: [],
    });
    expect(out.submissions).toHaveLength(1500);
  });
});
