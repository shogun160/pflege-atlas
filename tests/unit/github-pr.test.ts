// tests/unit/github-pr.test.ts
import { describe, expect, it, vi } from 'vitest';
import {
  createSubmissionPR,
  pushSubmissionEdit,
  mergeSubmissionPR,
  closeSubmissionPR,
} from '@/lib/github-pr';

function mockOctokit() {
  return {
    rest: {
      git: {
        getRef: vi.fn().mockResolvedValue({ data: { object: { sha: 'main-sha' } } }),
        createRef: vi.fn().mockResolvedValue({}),
        deleteRef: vi.fn().mockResolvedValue({}),
      },
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi
          .fn()
          .mockResolvedValue({ data: { commit: { sha: 'commit-sha' } } }),
      },
      pulls: {
        create: vi.fn().mockResolvedValue({ data: { number: 42 } }),
        merge: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    },
  } as never;
}

const owner = 'shogun160';
const repo = 'pflege-atlas';

describe('createSubmissionPR', () => {
  it('returns no-op result when octokit is null (dev bypass)', async () => {
    const result = await createSubmissionPR(null, {
      owner,
      repo,
      submissionId: 7,
      slug: 'x',
      markdown: 'data',
      title: 'T',
      body: 'B',
    });
    expect(result).toEqual({ prNumber: null, prBranch: null, prState: 'skipped' });
  });

  it('creates branch, writes file, opens PR', async () => {
    const oct = mockOctokit();
    // Existing file lookup throws 404 → it's a new file
    (oct as never as { rest: { repos: { getContent: { mockRejectedValueOnce: (e: unknown) => void } } } })
      .rest.repos.getContent.mockRejectedValueOnce({ status: 404 });
    const result = await createSubmissionPR(oct, {
      owner,
      repo,
      submissionId: 7,
      slug: 'dekubitus',
      markdown: '---\nslug: dekubitus\n---\n## Definition\n\nhi\n',
      title: '[Vorschlag] Dekubitus',
      body: '**Typ:** Neuer Artikelvorschlag\n',
    });
    expect(oct.rest.git.createRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'refs/heads/submission/7', sha: 'main-sha' }),
    );
    expect(oct.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'content/articles/dekubitus.md',
        branch: 'submission/7',
      }),
    );
    expect(oct.rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        head: 'submission/7',
        base: 'main',
        title: '[Vorschlag] Dekubitus',
      }),
    );
    expect(result).toEqual({ prNumber: 42, prBranch: 'submission/7', prState: 'open' });
  });
});

describe('pushSubmissionEdit', () => {
  it('returns skipped when octokit is null', async () => {
    const result = await pushSubmissionEdit(null, {
      owner,
      repo,
      branch: 'submission/7',
      path: 'content/articles/x.md',
      markdown: 'new',
      message: 'edit',
    });
    expect(result.prState).toBe('skipped');
  });

  it('updates file with existing sha', async () => {
    const oct = mockOctokit();
    oct.rest.repos.getContent = vi.fn().mockResolvedValueOnce({
      data: { sha: 'old-sha' },
    });
    await pushSubmissionEdit(oct, {
      owner,
      repo,
      branch: 'submission/7',
      path: 'content/articles/x.md',
      markdown: 'new content',
      message: 'editorial revision',
    });
    expect(oct.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({
        sha: 'old-sha',
        message: 'editorial revision',
      }),
    );
  });

  it('replaces file at new path when slug changed (delete old, create new)', async () => {
    const oct = mockOctokit();
    // Old path lookup: found
    oct.rest.repos.getContent = vi
      .fn()
      .mockResolvedValueOnce({ data: { sha: 'old-sha' } })
      // New path lookup: 404
      .mockRejectedValueOnce({ status: 404 });
    oct.rest.repos.deleteFile = vi.fn().mockResolvedValue({});
    await pushSubmissionEdit(oct, {
      owner,
      repo,
      branch: 'submission/7',
      path: 'content/articles/new-slug.md',
      oldPath: 'content/articles/old-slug.md',
      markdown: 'new content',
      message: 'slug change',
    });
    expect(oct.rest.repos.deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'content/articles/old-slug.md', sha: 'old-sha' }),
    );
    expect(oct.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'content/articles/new-slug.md' }),
    );
  });
});

describe('mergeSubmissionPR', () => {
  it('returns skipped when octokit is null', async () => {
    const result = await mergeSubmissionPR(null, { owner, repo, prNumber: 42, branch: 'submission/7' });
    expect(result.prState).toBe('skipped');
  });

  it('squash-merges and deletes the branch', async () => {
    const oct = mockOctokit();
    await mergeSubmissionPR(oct, { owner, repo, prNumber: 42, branch: 'submission/7' });
    expect(oct.rest.pulls.merge).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 42, merge_method: 'squash' }),
    );
    expect(oct.rest.git.deleteRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'heads/submission/7' }),
    );
  });
});

describe('closeSubmissionPR', () => {
  it('returns skipped when octokit is null', async () => {
    const result = await closeSubmissionPR(null, { owner, repo, prNumber: 42, branch: 'submission/7' });
    expect(result.prState).toBe('skipped');
  });

  it('updates PR state to closed and deletes branch', async () => {
    const oct = mockOctokit();
    await closeSubmissionPR(oct, { owner, repo, prNumber: 42, branch: 'submission/7' });
    expect(oct.rest.pulls.update).toHaveBeenCalledWith(
      expect.objectContaining({ pull_number: 42, state: 'closed' }),
    );
    expect(oct.rest.git.deleteRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'heads/submission/7' }),
    );
  });
});
