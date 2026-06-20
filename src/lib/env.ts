export type GithubConfig = {
  appId: string;
  installationId: string;
  privateKey: string;
  owner: string;
  repo: string;
};

export function getGithubConfig(): GithubConfig | null {
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !installationId || !privateKey) return null;
  return {
    appId,
    installationId,
    privateKey,
    owner: process.env.GITHUB_REPO_OWNER || 'shogun160',
    repo: process.env.GITHUB_REPO_NAME || 'pflege-atlas',
  };
}

export function assertGithubConfigInProduction(): void {
  if (process.env.NODE_ENV !== 'production') return;
  // Skip during `next build` (static generation phase) — only enforce at runtime
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const missing: string[] = [];
  if (!process.env.GITHUB_APP_ID) missing.push('GITHUB_APP_ID');
  if (!process.env.GITHUB_APP_INSTALLATION_ID) missing.push('GITHUB_APP_INSTALLATION_ID');
  if (!process.env.GITHUB_APP_PRIVATE_KEY) missing.push('GITHUB_APP_PRIVATE_KEY');
  if (missing.length === 0) return;
  throw new Error(
    `[V1.5 GitHub Sync] Missing required env vars in production: ${missing.join(', ')}. ` +
      `Set them in your deployment environment (values are in 1Password under "PflegeAtlas GitHub App").`,
  );
}
