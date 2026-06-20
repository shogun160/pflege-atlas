import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOctokit: vi.fn(),
  upsertArticleMarkdown: vi.fn(),
  deleteArticleMarkdown: vi.fn(),
}));

vi.mock('@/lib/github-app', () => ({ getOctokit: mocks.getOctokit }));
vi.mock('@/lib/github-article-sync', () => ({
  upsertArticleMarkdown: mocks.upsertArticleMarkdown,
  deleteArticleMarkdown: mocks.deleteArticleMarkdown,
}));

describe('Articles.afterChange (markdown sync)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts markdown when status=published', async () => {
    mocks.getOctokit.mockReturnValue({} as never);
    mocks.upsertArticleMarkdown.mockResolvedValue({ committed: true });
    const { afterArticleChangeHook } = await import('@/collections/Articles');
    await afterArticleChangeHook({
      operation: 'update',
      doc: {
        id: 1,
        slug: 'demo',
        title: 'Demo',
        intent: 'background',
        summary: 's',
        status: 'published',
        definition: { root: { type: 'root', children: [] } },
        praxis: { root: { type: 'root', children: [] } },
        risiken: { root: { type: 'root', children: [] } },
        quellen: { root: { type: 'root', children: [] } },
      },
      previousDoc: { status: 'draft' } as never,
      req: { context: {}, payload: { find: vi.fn().mockResolvedValue({ docs: [] }) } } as never,
    });
    expect(mocks.upsertArticleMarkdown).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slug: 'demo' }),
    );
  });

  it('skips sync when req.context.skipMarkdownSync is true', async () => {
    const { afterArticleChangeHook } = await import('@/collections/Articles');
    await afterArticleChangeHook({
      operation: 'update',
      doc: { id: 1, status: 'published', slug: 'demo' } as never,
      previousDoc: {} as never,
      req: { context: { skipMarkdownSync: true }, payload: { find: vi.fn() } } as never,
    });
    expect(mocks.upsertArticleMarkdown).not.toHaveBeenCalled();
    expect(mocks.deleteArticleMarkdown).not.toHaveBeenCalled();
  });

  it('deletes markdown when status transitions away from published', async () => {
    mocks.getOctokit.mockReturnValue({} as never);
    mocks.deleteArticleMarkdown.mockResolvedValue({ committed: true });
    const { afterArticleChangeHook } = await import('@/collections/Articles');
    await afterArticleChangeHook({
      operation: 'update',
      doc: { id: 1, slug: 'demo', status: 'archived' } as never,
      previousDoc: { status: 'published' } as never,
      req: { context: {}, payload: { find: vi.fn() } } as never,
    });
    expect(mocks.deleteArticleMarkdown).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slug: 'demo' }),
    );
  });

  it('does nothing when status remains draft', async () => {
    const { afterArticleChangeHook } = await import('@/collections/Articles');
    await afterArticleChangeHook({
      operation: 'update',
      doc: { id: 1, slug: 'demo', status: 'draft' } as never,
      previousDoc: { status: 'draft' } as never,
      req: { context: {}, payload: { find: vi.fn() } } as never,
    });
    expect(mocks.upsertArticleMarkdown).not.toHaveBeenCalled();
    expect(mocks.deleteArticleMarkdown).not.toHaveBeenCalled();
  });

  it('deletes previous markdown when slug is renamed while published', async () => {
    mocks.getOctokit.mockReturnValue({} as never);
    mocks.deleteArticleMarkdown.mockResolvedValue({ committed: true });
    mocks.upsertArticleMarkdown.mockResolvedValue({ committed: true });
    const { afterArticleChangeHook } = await import('@/collections/Articles');
    await afterArticleChangeHook({
      operation: 'update',
      doc: {
        id: 1,
        slug: 'neuer-slug',
        title: 'Neuer Titel',
        intent: 'background',
        summary: 's',
        status: 'published',
        definition: { root: { type: 'root', children: [] } },
        praxis: { root: { type: 'root', children: [] } },
        risiken: { root: { type: 'root', children: [] } },
        quellen: { root: { type: 'root', children: [] } },
      },
      previousDoc: { status: 'published', slug: 'alter-slug' } as never,
      req: { context: {}, payload: { find: vi.fn().mockResolvedValue({ docs: [] }) } } as never,
    });
    expect(mocks.deleteArticleMarkdown).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slug: 'alter-slug' }),
    );
    expect(mocks.upsertArticleMarkdown).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slug: 'neuer-slug' }),
    );
  });

  it('does not delete previous markdown when slug is unchanged', async () => {
    mocks.getOctokit.mockReturnValue({} as never);
    mocks.upsertArticleMarkdown.mockResolvedValue({ committed: true });
    const { afterArticleChangeHook } = await import('@/collections/Articles');
    await afterArticleChangeHook({
      operation: 'update',
      doc: {
        id: 1,
        slug: 'demo',
        title: 'Demo',
        intent: 'background',
        summary: 's',
        status: 'published',
        definition: { root: { type: 'root', children: [] } },
        praxis: { root: { type: 'root', children: [] } },
        risiken: { root: { type: 'root', children: [] } },
        quellen: { root: { type: 'root', children: [] } },
      },
      previousDoc: { status: 'published', slug: 'demo' } as never,
      req: { context: {}, payload: { find: vi.fn().mockResolvedValue({ docs: [] }) } } as never,
    });
    expect(mocks.deleteArticleMarkdown).not.toHaveBeenCalled();
    expect(mocks.upsertArticleMarkdown).toHaveBeenCalled();
  });

  it('deletes previous slug (not current) when unpublishing with rename', async () => {
    mocks.getOctokit.mockReturnValue({} as never);
    mocks.deleteArticleMarkdown.mockResolvedValue({ committed: true });
    const { afterArticleChangeHook } = await import('@/collections/Articles');
    await afterArticleChangeHook({
      operation: 'update',
      doc: { id: 1, slug: 'neuer-slug', status: 'draft' } as never,
      previousDoc: { status: 'published', slug: 'alter-slug' } as never,
      req: { context: {}, payload: { find: vi.fn() } } as never,
    });
    expect(mocks.deleteArticleMarkdown).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slug: 'alter-slug' }),
    );
    expect(mocks.upsertArticleMarkdown).not.toHaveBeenCalled();
  });
});
