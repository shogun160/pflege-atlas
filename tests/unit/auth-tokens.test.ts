import { describe, it, expect } from 'vitest';
import { generateToken, isTokenValid, INVITE_EXPIRY_MS, RESET_EXPIRY_MS } from '@/lib/auth-tokens';

describe('auth-tokens', () => {
  it('generateToken returns 43-char base64-url-safe string', () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('generateToken returns unique values', () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) tokens.add(generateToken());
    expect(tokens.size).toBe(100);
  });

  it('isTokenValid returns false for null expiry', () => {
    expect(isTokenValid(null)).toBe(false);
    expect(isTokenValid(undefined)).toBe(false);
  });

  it('isTokenValid returns false for past expiry', () => {
    const past = new Date(Date.now() - 1000);
    expect(isTokenValid(past)).toBe(false);
  });

  it('isTokenValid returns true for future expiry', () => {
    const future = new Date(Date.now() + 1000);
    expect(isTokenValid(future)).toBe(true);
  });

  it('isTokenValid accepts ISO-string', () => {
    const future = new Date(Date.now() + 1000).toISOString();
    expect(isTokenValid(future)).toBe(true);
  });

  it('INVITE_EXPIRY_MS is 7 days', () => {
    expect(INVITE_EXPIRY_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('RESET_EXPIRY_MS is 1 hour', () => {
    expect(RESET_EXPIRY_MS).toBe(60 * 60 * 1000);
  });
});
