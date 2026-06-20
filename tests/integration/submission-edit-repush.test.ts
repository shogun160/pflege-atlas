import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOctokit: vi.fn(),
  pushSubmissionEdit: vi.fn(),
}));

vi.mock('@/lib/github-app', () => ({ getOctokit: mocks.getOctokit }));
vi.mock('@/lib/github-pr', () => ({
  createSubmissionPR: vi.fn(),
  pushSubmissionEdit: mocks.pushSubmissionEdit,
  mergeSubmissionPR: vi.fn(),
  closeSubmissionPR: vi.fn(),
}));

describe('Submissions.afterChange (PR re-push)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('re-pushes edit when reviewStatus=in_review and prBranch exists', async () => {
    mocks.getOctokit.mockReturnValue({} as never);
    mocks.pushSubmissionEdit.mockResolvedValue({
      prNumber: 42,
      prBranch: 'submission/7',
      prState: 'open',
    });

    const { afterSubmissionChangeHook } = await import('@/collections/Submissions');
    await afterSubmissionChangeHook({
      operation: 'update',
      doc: {
        id: 7,
        type: 'correction',
        relatedArticle: 5,
        reviewStatus: 'in_review',
        prNumber: 42,
        prBranch: 'submission/7',
        proposedSlug: null,
        editedPraxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'updated' }] }] } },
      },
      previousDoc: {
        id: 7,
        type: 'correction',
        relatedArticle: 5,
        reviewStatus: 'in_review',
        prNumber: 42,
        prBranch: 'submission/7',
        editedPraxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'old' }] }] } },
      },
      req: {
        payload: {
          findByID: vi.fn().mockResolvedValue({
            id: 5,
            slug: 'demo',
            title: 'Demo',
            intent: 'background',
            summary: 's',
            definition: { root: { type: 'root', children: [] } },
            praxis: { root: { type: 'root', children: [] } },
            risiken: { root: { type: 'root', children: [] } },
            quellen: { root: { type: 'root', children: [] } },
          }),
        },
      } as never,
    });

    expect(mocks.pushSubmissionEdit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ branch: 'submission/7', path: 'content/articles/demo.md' }),
    );
  });

  it('skips re-push when reviewStatus is not in_review', async () => {
    const { afterSubmissionChangeHook } = await import('@/collections/Submissions');
    await afterSubmissionChangeHook({
      operation: 'update',
      doc: { id: 7, reviewStatus: 'pending', prBranch: null } as never,
      previousDoc: {} as never,
      req: { payload: { findByID: vi.fn() } } as never,
    });
    expect(mocks.pushSubmissionEdit).not.toHaveBeenCalled();
  });

  it('skips re-push when prBranch is null', async () => {
    const { afterSubmissionChangeHook } = await import('@/collections/Submissions');
    await afterSubmissionChangeHook({
      operation: 'update',
      doc: { id: 7, reviewStatus: 'in_review', prBranch: null } as never,
      previousDoc: {} as never,
      req: { payload: { findByID: vi.fn() } } as never,
    });
    expect(mocks.pushSubmissionEdit).not.toHaveBeenCalled();
  });
});
