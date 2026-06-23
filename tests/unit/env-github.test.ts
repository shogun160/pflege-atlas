import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { getGithubConfig, assertGithubConfigInProduction } from '@/lib/env';

const VARS = [
  'GITHUB_APP_ID',
  'GITHUB_APP_INSTALLATION_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_REPO_OWNER',
  'GITHUB_REPO_NAME',
  'NODE_ENV',
  'NEXT_PHASE',
];

describe('getGithubConfig', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    VARS.forEach((k) => {
      saved[k] = process.env[k];
      delete process.env[k];
    });
  });
  afterEach(() => {
    VARS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });

  it('returns null when private key is missing', () => {
    expect(getGithubConfig()).toBeNull();
  });

  it('returns config with defaults when all vars are set', () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_INSTALLATION_ID = '67890';
    process.env.GITHUB_APP_PRIVATE_KEY = 'aGVsbG8=';
    const cfg = getGithubConfig();
    expect(cfg).toEqual({
      appId: '12345',
      installationId: '67890',
      privateKey: 'aGVsbG8=',
      owner: 'shogun160',
      repo: 'pflege-atlas',
    });
  });

  it('honours custom owner/repo overrides', () => {
    process.env.GITHUB_APP_ID = '1';
    process.env.GITHUB_APP_INSTALLATION_ID = '2';
    process.env.GITHUB_APP_PRIVATE_KEY = 'x';
    process.env.GITHUB_REPO_OWNER = 'sandbox-owner';
    process.env.GITHUB_REPO_NAME = 'sandbox-repo';
    expect(getGithubConfig()?.owner).toBe('sandbox-owner');
    expect(getGithubConfig()?.repo).toBe('sandbox-repo');
  });
});

describe('assertGithubConfigInProduction', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    VARS.forEach((k) => {
      saved[k] = process.env[k];
      delete process.env[k];
    });
  });
  afterEach(() => {
    VARS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });

  it('does nothing in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(() => assertGithubConfigInProduction()).not.toThrow();
  });

  it('throws in production when private key missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => assertGithubConfigInProduction()).toThrow(/GITHUB_APP_PRIVATE_KEY/);
  });

  it('passes in production when all vars set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.GITHUB_APP_ID = '1';
    process.env.GITHUB_APP_INSTALLATION_ID = '2';
    process.env.GITHUB_APP_PRIVATE_KEY = 'x';
    expect(() => assertGithubConfigInProduction()).not.toThrow();
  });

  it('does nothing during next build phase even in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.NEXT_PHASE = 'phase-production-build';
    expect(() => assertGithubConfigInProduction()).not.toThrow();
  });
});
