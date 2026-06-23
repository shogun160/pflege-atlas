import { describe, it, expect } from 'vitest';
import {
  shapeExport,
  EXPORT_HARD_CAP,
  EXPORT_PAGE_SIZE,
  ExportTooLargeError,
} from '@/lib/data-export';

describe('shapeExport', () => {
  it('strips password and includes expected sections', () => {
    const export_ = shapeExport({
      user: { id: 1, email: 'a@b.com', displayName: 'A', role: 'contributor', password: 'shouldnotappear' } as never,
      submissions: [{ id: 10, type: 'new_article', proposedTitle: 'X' } as never],
      articles: [{ id: 20, title: 'Y' } as never],
    });
    expect(export_.user.email).toBe('a@b.com');
    expect(export_.user).not.toHaveProperty('password');
    expect(export_.submissions).toHaveLength(1);
    expect(export_.articles).toHaveLength(1);
    expect(export_.exportedAt).toMatch(/T/);
  });

  it('strips all sensitive auth/credential fields', () => {
    // Intentionally duplicated inline (not imported from the module) to keep
    // the test independent — if the module's allow-list ever drifts, this
    // test still locks the security contract.
    const userInput = {
      id: 1,
      email: 'a@b.com',
      displayName: 'A',
      role: 'contributor',
      password: 'shouldnotappear',
      setPasswordToken: 'invite-token',
      setPasswordTokenExpiresAt: '2030-01-01T00:00:00.000Z',
      resetPasswordToken: 'reset-token',
      resetPasswordExpiration: '2030-01-01T00:00:00.000Z',
      salt: 'salt',
      hash: 'hash',
      loginAttempts: 2,
      lockUntil: '2030-01-01T00:00:00.000Z',
      sessions: [{ id: 'x' }],
      apiKey: 'k',
      apiKeyIndex: 'i',
    };
    const export_ = shapeExport({ user: userInput as never, submissions: [], articles: [] });
    for (const field of [
      'password',
      'setPasswordToken',
      'setPasswordTokenExpiresAt',
      'resetPasswordToken',
      'resetPasswordExpiration',
      'salt',
      'hash',
      'loginAttempts',
      'lockUntil',
      'sessions',
      'apiKey',
      'apiKeyIndex',
    ]) {
      expect(export_.user).not.toHaveProperty(field);
    }
    // Non-sensitive fields still pass through:
    expect(export_.user.email).toBe('a@b.com');
    expect(export_.user.role).toBe('contributor');
  });
});

describe('export constants and errors', () => {
  it('exports EXPORT_HARD_CAP = 10_000', () => {
    expect(EXPORT_HARD_CAP).toBe(10_000);
  });

  it('exports EXPORT_PAGE_SIZE = 500', () => {
    expect(EXPORT_PAGE_SIZE).toBe(500);
  });

  it('ExportTooLargeError carries collection name + count in message', () => {
    const err = new ExportTooLargeError('submissions', 10_000);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ExportTooLargeError');
    expect(err.message).toContain('submissions');
    expect(err.message).toContain('10000');
  });
});
