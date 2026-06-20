import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOctokit: vi.fn(),
  mergeSubmissionPR: vi.fn(),
  getPayloadClient: vi.fn(),
}));

vi.mock('@/lib/github-app', () => ({ getOctokit: mocks.getOctokit }));
vi.mock('@/lib/github-pr', () => ({
  createSubmissionPR: vi.fn(),
  pushSubmissionEdit: vi.fn(),
  mergeSubmissionPR: mocks.mergeSubmissionPR,
  closeSubmissionPR: vi.fn(),
}));
vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }));

function makePayload() {
  return {
    findByID: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 100 }),
    update: vi.fn().mockResolvedValue({}),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    sendEmail: vi.fn().mockResolvedValue({}),
    db: {
      beginTransaction: vi.fn().mockResolvedValue('txn'),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('acceptAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates article and merges PR for new_article submission', async () => {
    const payload = makePayload();
    payload.findByID.mockResolvedValue({
      id: 7,
      type: 'new_article',
      proposedTitle: 'Demo',
      proposedIntent: 'bedside',
      proposedSummary: 'sum',
      proposedSlug: 'demo',
      proposedDefinition: { root: { type: 'root', children: [] } },
      proposedPraxis: { root: { type: 'root', children: [] } },
      proposedRisiken: { root: { type: 'root', children: [] } },
      proposedQuellen: { root: { type: 'root', children: [] } },
      prNumber: 42,
      prBranch: 'submission/7',
      submitterEmail: 'maria@example.org',
    });
    mocks.getPayloadClient.mockResolvedValue(payload);
    mocks.getOctokit.mockReturnValue({} as never);
    mocks.mergeSubmissionPR.mockResolvedValue({
      prNumber: 42,
      prBranch: 'submission/7',
      prState: 'merged',
    });

    const { acceptAction } = await import('@/app/(payload)/admin/submission-actions');
    const result = await acceptAction(7);

    expect(result.ok).toBe(true);
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'articles',
        context: expect.objectContaining({ skipMarkdownSync: true }),
      }),
    );
    expect(mocks.mergeSubmissionPR).toHaveBeenCalled();
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        data: expect.objectContaining({ reviewStatus: 'accepted', prState: 'merged' }),
      }),
    );
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'maria@example.org' }),
    );
  });

  it('updates existing article for correction (no email when no submitter email)', async () => {
    const payload = makePayload();
    payload.findByID
      .mockResolvedValueOnce({
        id: 7,
        type: 'correction',
        relatedArticle: 5,
        editedPraxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'new' }] }] } },
        prNumber: 42,
        prBranch: 'submission/7',
      })
      .mockResolvedValueOnce({
        id: 5,
        slug: 'demo',
        title: 'Demo',
        intent: 'background',
        summary: 's',
        definition: { root: { type: 'root', children: [] } },
        praxis: { root: { type: 'root', children: [] } },
        risiken: { root: { type: 'root', children: [] } },
        quellen: { root: { type: 'root', children: [] } },
      });
    mocks.getPayloadClient.mockResolvedValue(payload);
    mocks.getOctokit.mockReturnValue({} as never);
    mocks.mergeSubmissionPR.mockResolvedValue({
      prNumber: 42,
      prBranch: 'submission/7',
      prState: 'merged',
    });

    const { acceptAction } = await import('@/app/(payload)/admin/submission-actions');
    await acceptAction(7);

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'articles',
        id: 5,
        context: expect.objectContaining({ skipMarkdownSync: true }),
      }),
    );
    expect(payload.sendEmail).not.toHaveBeenCalled();
  });
});
