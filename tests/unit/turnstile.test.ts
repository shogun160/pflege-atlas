import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstileToken } from '@/lib/turnstile';

describe('verifyTurnstileToken', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = originalFetch;
  });

  it('returns true via bypass when TURNSTILE_SECRET_KEY is empty', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    const result = await verifyTurnstileToken('any-token');
    expect(result).toBe(true);
  });

  it('returns true when Cloudflare siteverify responds success: true', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch;
    const result = await verifyTurnstileToken('valid-token');
    expect(result).toBe(true);
  });

  it('returns false when Cloudflare siteverify responds success: false', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    }) as unknown as typeof fetch;
    const result = await verifyTurnstileToken('invalid-token');
    expect(result).toBe(false);
  });

  it('returns false when fetch throws', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
    const result = await verifyTurnstileToken('any-token');
    expect(result).toBe(false);
  });

  it('returns false when token is empty even with secret set', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    const result = await verifyTurnstileToken('');
    expect(result).toBe(false);
  });
});
