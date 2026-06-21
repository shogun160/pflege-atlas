import { describe, expect, it, afterEach } from 'vitest';
import { buildStorageConfig } from '@/lib/storage-config';

describe('buildStorageConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns null when R2_ACCESS_KEY_ID is missing', () => {
    delete process.env.R2_ACCESS_KEY_ID;
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'bucket';
    process.env.R2_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    expect(buildStorageConfig()).toBeNull();
  });

  it('returns null when R2_SECRET_ACCESS_KEY is missing', () => {
    process.env.R2_ACCESS_KEY_ID = 'key';
    delete process.env.R2_SECRET_ACCESS_KEY;
    process.env.R2_BUCKET = 'bucket';
    process.env.R2_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    expect(buildStorageConfig()).toBeNull();
  });

  it('returns null when R2_BUCKET is missing', () => {
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    delete process.env.R2_BUCKET;
    process.env.R2_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    expect(buildStorageConfig()).toBeNull();
  });

  it('returns null when R2_ENDPOINT is missing', () => {
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'bucket';
    delete process.env.R2_ENDPOINT;
    expect(buildStorageConfig()).toBeNull();
  });

  it('returns config object when all 4 R2 envs are set', () => {
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'pflegeatlas-media';
    process.env.R2_ENDPOINT = 'https://abc.r2.cloudflarestorage.com';
    const config = buildStorageConfig();
    expect(config).not.toBeNull();
    expect(config?.bucket).toBe('pflegeatlas-media');
    expect(config?.config.endpoint).toBe('https://abc.r2.cloudflarestorage.com');
    expect(config?.config.region).toBe('auto');
    expect(config?.config.credentials.accessKeyId).toBe('key');
    expect(config?.config.credentials.secretAccessKey).toBe('secret');
  });
});
