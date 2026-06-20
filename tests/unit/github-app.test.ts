import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAppAuth: vi.fn(),
  OctokitMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@octokit/auth-app', () => ({ createAppAuth: mocks.createAppAuth }));
vi.mock('@octokit/rest', () => ({ Octokit: mocks.OctokitMock }));

const ENV_KEYS = [
  'GITHUB_APP_ID',
  'GITHUB_APP_INSTALLATION_ID',
  'GITHUB_APP_PRIVATE_KEY',
];

describe('getOctokit', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    vi.resetModules();
    mocks.createAppAuth.mockReset();
    mocks.OctokitMock.mockReset();
    ENV_KEYS.forEach((k) => {
      saved[k] = process.env[k];
      delete process.env[k];
    });
  });
  afterEach(() => {
    ENV_KEYS.forEach((k) => {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    });
  });

  it('returns null when env vars are missing', async () => {
    const { getOctokit } = await import('@/lib/github-app');
    expect(getOctokit()).toBeNull();
    expect(mocks.OctokitMock).not.toHaveBeenCalled();
  });

  it('decodes base64 private key and constructs Octokit with auth strategy', async () => {
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_INSTALLATION_ID = '67890';
    // base64('---PEM---') → 'LS0tUEVNLS0t'
    process.env.GITHUB_APP_PRIVATE_KEY = 'LS0tUEVNLS0t';
    mocks.OctokitMock.mockImplementation(function () { return { rest: {} }; });
    const { getOctokit } = await import('@/lib/github-app');
    const client = getOctokit();
    expect(client).not.toBeNull();
    expect(mocks.OctokitMock).toHaveBeenCalledTimes(1);
    const call = mocks.OctokitMock.mock.calls[0][0];
    expect(call.authStrategy).toBe(mocks.createAppAuth);
    expect(call.auth.appId).toBe('12345');
    expect(call.auth.installationId).toBe('67890');
    expect(call.auth.privateKey).toBe('---PEM---');
  });

  it('returns cached instance on second call', async () => {
    process.env.GITHUB_APP_ID = '1';
    process.env.GITHUB_APP_INSTALLATION_ID = '2';
    process.env.GITHUB_APP_PRIVATE_KEY = 'LS0tUEVNLS0t';
    mocks.OctokitMock.mockImplementation(function () { return { rest: {} }; });
    const { getOctokit } = await import('@/lib/github-app');
    const first = getOctokit();
    const second = getOctokit();
    expect(first).toBe(second);
    expect(mocks.OctokitMock).toHaveBeenCalledTimes(1);
  });
});
