// src/lib/github-pr.ts
import type { Octokit } from '@octokit/rest';

export type SyncResult = {
  prNumber: number | null;
  prBranch: string | null;
  prState: 'open' | 'merged' | 'closed' | 'skipped';
};

const NO_OP: SyncResult = { prNumber: null, prBranch: null, prState: 'skipped' };

type RepoRef = { owner: string; repo: string };

type CreateArgs = RepoRef & {
  submissionId: number;
  slug: string;
  markdown: string;
  title: string;
  body: string;
};

type PushArgs = RepoRef & {
  branch: string;
  path: string;
  oldPath?: string;
  markdown: string;
  message: string;
};

type MergeArgs = RepoRef & { prNumber: number; branch: string };
type CloseArgs = MergeArgs;

async function getFileSha(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | null> {
  try {
    const res = await octokit.rest.repos.getContent({ owner, repo, path, ref });
    const data = res.data as { sha?: string };
    return data.sha ?? null;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

function toBase64(content: string): string {
  return Buffer.from(content, 'utf8').toString('base64');
}

export async function createSubmissionPR(
  octokit: Octokit | null,
  args: CreateArgs,
): Promise<SyncResult> {
  if (!octokit) return NO_OP;
  const { owner, repo, submissionId, slug, markdown, title, body } = args;
  const branch = `submission/${submissionId}`;

  const main = await octokit.rest.git.getRef({ owner, repo, ref: 'heads/main' });
  // 422 "Reference already exists" wird abgefangen: vorheriger Versuch hatte den
  // Branch erstellt, aber file-write oder PR-open scheiterten. Branch wird dann
  // wiederverwendet — createOrUpdateFileContents nutzt den bestehenden tree und
  // pulls.create öffnet einen PR auf dem schon-bestehenden Branch.
  try {
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: main.data.object.sha,
    });
  } catch (err) {
    if ((err as { status?: number }).status !== 422) throw err;
  }

  const path = `content/articles/${slug}.md`;
  const existingSha = await getFileSha(octokit, owner, repo, path, branch);

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    branch,
    message: `submission(${submissionId}): initial proposal`,
    content: toBase64(markdown),
    ...(existingSha ? { sha: existingSha } : {}),
  });

  const pr = await octokit.rest.pulls.create({
    owner,
    repo,
    head: branch,
    base: 'main',
    title,
    body,
  });

  return { prNumber: pr.data.number, prBranch: branch, prState: 'open' };
}

export async function pushSubmissionEdit(
  octokit: Octokit | null,
  args: PushArgs,
): Promise<SyncResult> {
  if (!octokit) return NO_OP;
  const { owner, repo, branch, path, oldPath, markdown, message } = args;

  if (oldPath && oldPath !== path) {
    const oldSha = await getFileSha(octokit, owner, repo, oldPath, branch);
    if (oldSha) {
      await octokit.rest.repos.deleteFile({
        owner,
        repo,
        path: oldPath,
        branch,
        message: `${message} (move from ${oldPath})`,
        sha: oldSha,
      });
    }
  }

  const sha = await getFileSha(octokit, owner, repo, path, branch);
  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    branch,
    message,
    content: toBase64(markdown),
    ...(sha ? { sha } : {}),
  });

  return { prNumber: null, prBranch: branch, prState: 'open' };
}

export async function mergeSubmissionPR(
  octokit: Octokit | null,
  args: MergeArgs,
): Promise<SyncResult> {
  if (!octokit) return NO_OP;
  const { owner, repo, prNumber, branch } = args;
  await octokit.rest.pulls.merge({
    owner,
    repo,
    pull_number: prNumber,
    merge_method: 'squash',
    commit_title: `submission(${prNumber}): accepted, merging to main`,
  });
  await octokit.rest.git
    .deleteRef({ owner, repo, ref: `heads/${branch}` })
    .catch(() => undefined);
  return { prNumber, prBranch: branch, prState: 'merged' };
}

export async function closeSubmissionPR(
  octokit: Octokit | null,
  args: CloseArgs,
): Promise<SyncResult> {
  if (!octokit) return NO_OP;
  const { owner, repo, prNumber, branch } = args;
  await octokit.rest.pulls.update({
    owner,
    repo,
    pull_number: prNumber,
    state: 'closed',
  });
  await octokit.rest.git
    .deleteRef({ owner, repo, ref: `heads/${branch}` })
    .catch(() => undefined);
  return { prNumber, prBranch: branch, prState: 'closed' };
}
