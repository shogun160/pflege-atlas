// tests/unit/github-article-sync.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { Octokit } from '@octokit/rest';
import {
  upsertArticleMarkdown,
  deleteArticleMarkdown,
} from '@/lib/github-article-sync';

type MockOctokit = {
  rest: {
    repos: {
      getContent: ReturnType<typeof vi.fn>;
      createOrUpdateFileContents: ReturnType<typeof vi.fn>;
      deleteFile: ReturnType<typeof vi.fn>;
    };
  };
};

const asOctokit = (m: MockOctokit) => m as unknown as Octokit;

function mockOctokit(): MockOctokit {
  return {
    rest: {
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
        deleteFile: vi.fn().mockResolvedValue({}),
      },
    },
  };
}

const ref = { owner: 'shogun160', repo: 'pflege-atlas' };

describe('upsertArticleMarkdown', () => {
  it('no-ops when octokit is null', async () => {
    const result = await upsertArticleMarkdown(null, { ...ref, slug: 'x', markdown: 'hi' });
    expect(result.committed).toBe(false);
  });

  it('creates new file when path missing', async () => {
    const oct = mockOctokit();
    oct.rest.repos.getContent.mockRejectedValueOnce({ status: 404 });
    const result = await upsertArticleMarkdown(asOctokit(oct), {
      ...ref,
      slug: 'demo',
      markdown: 'hello',
    });
    expect(oct.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'content/articles/demo.md', branch: 'main' }),
    );
    expect(result.committed).toBe(true);
  });

  it('skips commit when content hash unchanged', async () => {
    const oct = mockOctokit();
    const existingB64 = Buffer.from('same', 'utf8').toString('base64');
    oct.rest.repos.getContent.mockResolvedValueOnce({
      data: { sha: 'sha-1', content: existingB64, encoding: 'base64' },
    });
    const result = await upsertArticleMarkdown(asOctokit(oct), {
      ...ref,
      slug: 'demo',
      markdown: 'same',
    });
    expect(oct.rest.repos.createOrUpdateFileContents).not.toHaveBeenCalled();
    expect(result.committed).toBe(false);
  });

  it('updates with existing sha when content changed', async () => {
    const oct = mockOctokit();
    const existingB64 = Buffer.from('old', 'utf8').toString('base64');
    oct.rest.repos.getContent.mockResolvedValueOnce({
      data: { sha: 'sha-1', content: existingB64, encoding: 'base64' },
    });
    await upsertArticleMarkdown(asOctokit(oct), { ...ref, slug: 'demo', markdown: 'new' });
    expect(oct.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
      expect.objectContaining({ sha: 'sha-1' }),
    );
  });
});

describe('deleteArticleMarkdown', () => {
  it('no-ops when file does not exist', async () => {
    const oct = mockOctokit();
    oct.rest.repos.getContent.mockRejectedValueOnce({ status: 404 });
    const result = await deleteArticleMarkdown(asOctokit(oct), { ...ref, slug: 'gone' });
    expect(oct.rest.repos.deleteFile).not.toHaveBeenCalled();
    expect(result.committed).toBe(false);
  });

  it('deletes existing file', async () => {
    const oct = mockOctokit();
    oct.rest.repos.getContent.mockResolvedValueOnce({ data: { sha: 'sha-x' } });
    const result = await deleteArticleMarkdown(asOctokit(oct), { ...ref, slug: 'gone' });
    expect(oct.rest.repos.deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'content/articles/gone.md', sha: 'sha-x' }),
    );
    expect(result.committed).toBe(true);
  });
});
