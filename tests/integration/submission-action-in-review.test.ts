import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOctokit: vi.fn(),
  createSubmissionPR: vi.fn(),
  getPayloadClient: vi.fn(),
  resolveUniqueSlug: vi.fn(),
}));

vi.mock('@/lib/github-app', () => ({ getOctokit: mocks.getOctokit }));
vi.mock('@/lib/github-pr', () => ({
  createSubmissionPR: mocks.createSubmissionPR,
  pushSubmissionEdit: vi.fn(),
  mergeSubmissionPR: vi.fn(),
  closeSubmissionPR: vi.fn(),
}));
vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }));
vi.mock('@/lib/slug-resolver', () => ({ resolveUniqueSlug: mocks.resolveUniqueSlug }));

function makePayload() {
  const findByID = vi.fn();
  const update = vi.fn();
  const find = vi.fn().mockResolvedValue({ docs: [] });
  return {
    findByID,
    update,
    find,
    db: {
      beginTransaction: vi.fn().mockResolvedValue('txn-1'),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('inReviewAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates PR and updates submission atomically', async () => {
    const payload = makePayload();
    payload.findByID.mockResolvedValue({
      id: 7,
      type: 'new_article',
      proposedTitle: 'Demo',
      proposedSlug: null,
      proposedIntent: 'bedside',
      proposedDefinition: { root: { type: 'root', children: [] } },
      proposedPraxis: { root: { type: 'root', children: [] } },
      proposedRisiken: { root: { type: 'root', children: [] } },
      proposedQuellen: { root: { type: 'root', children: [] } },
    });
    mocks.getPayloadClient.mockResolvedValue(payload);
    mocks.getOctokit.mockReturnValue({} as never);
    mocks.resolveUniqueSlug.mockResolvedValue('demo');
    mocks.createSubmissionPR.mockResolvedValue({
      prNumber: 42,
      prBranch: 'submission/7',
      prState: 'open',
    });

    const { inReviewAction } = await import('@/app/(payload)/admin/submission-actions');
    const result = await inReviewAction(7);

    expect(result.ok).toBe(true);
    expect(mocks.createSubmissionPR).toHaveBeenCalled();
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'submissions',
        id: 7,
        data: expect.objectContaining({
          reviewStatus: 'in_review',
          prNumber: 42,
          prBranch: 'submission/7',
          prState: 'open',
          proposedSlug: 'demo',
        }),
      }),
    );
    expect(payload.db.commitTransaction).toHaveBeenCalled();
    expect(payload.db.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('rolls back DB transaction when octokit throws', async () => {
    const payload = makePayload();
    payload.findByID.mockResolvedValue({
      id: 7,
      type: 'new_article',
      proposedTitle: 'Demo',
      proposedSlug: null,
      proposedDefinition: { root: { type: 'root', children: [] } },
      proposedPraxis: { root: { type: 'root', children: [] } },
      proposedRisiken: { root: { type: 'root', children: [] } },
      proposedQuellen: { root: { type: 'root', children: [] } },
    });
    mocks.getPayloadClient.mockResolvedValue(payload);
    mocks.getOctokit.mockReturnValue({} as never);
    mocks.resolveUniqueSlug.mockResolvedValue('demo');
    mocks.createSubmissionPR.mockRejectedValue(new Error('GitHub API down'));

    const { inReviewAction } = await import('@/app/(payload)/admin/submission-actions');
    const result = await inReviewAction(7);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/GitHub API down/);
    expect(payload.db.rollbackTransaction).toHaveBeenCalled();
    expect(payload.db.commitTransaction).not.toHaveBeenCalled();
  });
});
