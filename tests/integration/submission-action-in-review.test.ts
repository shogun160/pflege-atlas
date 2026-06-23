import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOctokit: vi.fn(),
  createSubmissionPR: vi.fn(),
  getPayloadClient: vi.fn(),
  resolveUniqueSlug: vi.fn(),
  getSession: vi.fn(),
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
vi.mock('@/lib/auth', () => ({ getSession: mocks.getSession }));

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
    // Default: logged-in reviewer (most realistic case); tests that need
    // anonymous behavior override.
    mocks.getSession.mockResolvedValue({
      id: 99,
      email: 'rev@test.local',
      displayName: 'Rev',
      role: 'reviewer',
      disabled: false,
      avatar: null,
    });
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

  it('auto-claims submission by passing logged-in user so Submissions hook sets currentReviewer', async () => {
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
    mocks.createSubmissionPR.mockResolvedValue({
      prNumber: 42,
      prBranch: 'submission/7',
      prState: 'open',
    });

    const { inReviewAction } = await import('@/app/(payload)/admin/submission-actions');
    await inReviewAction(7);

    // Action must propagate the authenticated user to payload.update so the
    // Submissions beforeChange hook (req.user-gated) can auto-claim. Without
    // it the hook silent-fails and `current_reviewer_id` stays NULL — exact
    // V1.7 smoke symptom.
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ id: 99 }),
      }),
    );
  });

  it('still updates the submission when no session is present (anonymous fallback)', async () => {
    mocks.getSession.mockResolvedValue(null);
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
    mocks.createSubmissionPR.mockResolvedValue({
      prNumber: 42,
      prBranch: 'submission/7',
      prState: 'open',
    });

    const { inReviewAction } = await import('@/app/(payload)/admin/submission-actions');
    const result = await inReviewAction(7);

    expect(result.ok).toBe(true);
    // user should be absent (or undefined), not crash on session=null
    const call = payload.update.mock.calls[0]?.[0] as { user?: unknown };
    expect(call.user).toBeUndefined();
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
    if (result.ok) throw new Error('expected failure result');
    expect(result.error).toMatch(/GitHub API down/);
    expect(payload.db.rollbackTransaction).toHaveBeenCalled();
    expect(payload.db.commitTransaction).not.toHaveBeenCalled();
  });
});
