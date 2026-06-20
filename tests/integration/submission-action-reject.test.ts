import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOctokit: vi.fn(),
  closeSubmissionPR: vi.fn(),
  getPayloadClient: vi.fn(),
}));

vi.mock('@/lib/github-app', () => ({ getOctokit: mocks.getOctokit }));
vi.mock('@/lib/github-pr', () => ({
  createSubmissionPR: vi.fn(),
  pushSubmissionEdit: vi.fn(),
  mergeSubmissionPR: vi.fn(),
  closeSubmissionPR: mocks.closeSubmissionPR,
}));
vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }));

function makePayload() {
  return {
    findByID: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    db: {
      beginTransaction: vi.fn().mockResolvedValue('txn'),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('rejectAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('closes PR and updates status when PR exists', async () => {
    const payload = makePayload();
    payload.findByID.mockResolvedValue({
      id: 7,
      prNumber: 42,
      prBranch: 'submission/7',
    });
    mocks.getPayloadClient.mockResolvedValue(payload);
    mocks.getOctokit.mockReturnValue({} as never);
    mocks.closeSubmissionPR.mockResolvedValue({
      prNumber: 42,
      prBranch: 'submission/7',
      prState: 'closed',
    });

    const { rejectAction } = await import('@/app/(payload)/admin/submission-actions');
    const result = await rejectAction(7);

    expect(result.ok).toBe(true);
    expect(mocks.closeSubmissionPR).toHaveBeenCalled();
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewStatus: 'rejected', prState: 'closed' }),
      }),
    );
  });

  it('skips PR close when no PR exists, just updates status', async () => {
    const payload = makePayload();
    payload.findByID.mockResolvedValue({ id: 7 });
    mocks.getPayloadClient.mockResolvedValue(payload);

    const { rejectAction } = await import('@/app/(payload)/admin/submission-actions');
    await rejectAction(7);

    expect(mocks.closeSubmissionPR).not.toHaveBeenCalled();
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewStatus: 'rejected' }),
      }),
    );
  });
});
