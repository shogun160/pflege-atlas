import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildEmailConfig } from '@/lib/email-config';

describe('buildEmailConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns undefined when RESEND_API_KEY is missing', () => {
    vi.stubEnv('RESEND_API_KEY', '');
    expect(buildEmailConfig()).toBeUndefined();
  });

  it('returns undefined when RESEND_API_KEY is the literal string "undefined"', () => {
    vi.stubEnv('RESEND_API_KEY', 'undefined');
    expect(buildEmailConfig()).toBeUndefined();
  });

  it('returns a resend adapter factory when RESEND_API_KEY is set', () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_xxx');
    vi.stubEnv('RESEND_FROM_ADDRESS', 'noreply@pflegeatlas.org');
    const factory = buildEmailConfig();
    expect(factory).toBeDefined();
    expect(typeof factory).toBe('function');
    const adapter = factory!();
    expect(adapter).toHaveProperty('name', 'resend-rest');
    expect(adapter).toHaveProperty('defaultFromAddress', 'noreply@pflegeatlas.org');
  });

  it('falls back to "PflegeAtlas" when RESEND_FROM_NAME is not set', () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_xxx');
    vi.stubEnv('RESEND_FROM_ADDRESS', 'noreply@pflegeatlas.org');
    vi.stubEnv('RESEND_FROM_NAME', '');
    const factory = buildEmailConfig();
    const adapter = factory!();
    expect(adapter).toHaveProperty('defaultFromName', 'PflegeAtlas');
  });
});
