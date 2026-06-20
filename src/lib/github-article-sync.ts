// src/lib/github-article-sync.ts
import 'server-only';
import type { Octokit } from '@octokit/rest';

type RepoRef = { owner: string; repo: string };
type UpsertArgs = RepoRef & { slug: string; markdown: string };
type DeleteArgs = RepoRef & { slug: string };

export type ArticleSyncResult = { committed: boolean };

function pathFor(slug: string): string {
  return `content/articles/${slug}.md`;
}

function toBase64(content: string): string {
  return Buffer.from(content, 'utf8').toString('base64');
}

function fromBase64(content: string): string {
  return Buffer.from(content, 'base64').toString('utf8');
}

type ExistingFile = { sha: string; content: string } | null;

async function fetchExisting(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
): Promise<ExistingFile> {
  try {
    const res = await octokit.rest.repos.getContent({ owner, repo, path, ref: 'main' });
    const data = res.data as { sha?: string; content?: string; encoding?: string };
    if (!data.sha) return null;
    const raw = data.content ?? '';
    const decoded = data.encoding === 'base64' ? fromBase64(raw) : raw;
    return { sha: data.sha, content: decoded };
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function upsertArticleMarkdown(
  octokit: Octokit | null,
  args: UpsertArgs,
): Promise<ArticleSyncResult> {
  if (!octokit) return { committed: false };
  const { owner, repo, slug, markdown } = args;
  const path = pathFor(slug);
  const existing = await fetchExisting(octokit, owner, repo, path);
  if (existing && existing.content === markdown) {
    return { committed: false };
  }
  const message = existing
    ? `article(${slug}): update from admin`
    : `article(${slug}): publish`;
  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    branch: 'main',
    message,
    content: toBase64(markdown),
    ...(existing ? { sha: existing.sha } : {}),
  });
  return { committed: true };
}

export async function deleteArticleMarkdown(
  octokit: Octokit | null,
  args: DeleteArgs,
): Promise<ArticleSyncResult> {
  if (!octokit) return { committed: false };
  const { owner, repo, slug } = args;
  const path = pathFor(slug);
  const existing = await fetchExisting(octokit, owner, repo, path);
  if (!existing) return { committed: false };
  await octokit.rest.repos.deleteFile({
    owner,
    repo,
    path,
    branch: 'main',
    message: `article(${slug}): archive`,
    sha: existing.sha,
  });
  return { committed: true };
}
