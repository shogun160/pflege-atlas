import { randomBytes } from 'node:crypto';

export const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const RESET_EXPIRY_MS = 60 * 60 * 1000;            // 1 hour

/**
 * 32 random bytes → 43-char base64-url-safe string.
 * Used for both invitation-magic-links and password-reset-links.
 */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isTokenValid(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return expiry.getTime() > Date.now();
}
