import 'server-only';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { getGithubConfig } from './env';

let cached: Octokit | null = null;

export function getOctokit(): Octokit | null {
  if (cached) return cached;
  const cfg = getGithubConfig();
  if (!cfg) return null;
  const privateKeyPem = Buffer.from(cfg.privateKey, 'base64').toString('utf8');
  cached = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: cfg.appId,
      installationId: cfg.installationId,
      privateKey: privateKeyPem,
    },
  });
  return cached;
}

/** Test-only: reset singleton cache between test cases. */
export function __resetOctokitCacheForTests(): void {
  cached = null;
}
