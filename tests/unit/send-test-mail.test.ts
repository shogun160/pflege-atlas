import { describe, expect, it } from 'vitest';
import { parseRecipient } from '../../scripts/send-test-mail';

describe('parseRecipient', () => {
  it('returns the first CLI argument when given', () => {
    expect(parseRecipient(['node', 'script', 'a@b.de'], {})).toBe('a@b.de');
  });

  it('falls back to TEST_MAIL_TO env when no arg given', () => {
    expect(parseRecipient(['node', 'script'], { TEST_MAIL_TO: 'fallback@x.de' })).toBe(
      'fallback@x.de',
    );
  });

  it('prefers CLI arg over env var when both are present', () => {
    expect(
      parseRecipient(['node', 'script', 'cli@x.de'], { TEST_MAIL_TO: 'env@x.de' }),
    ).toBe('cli@x.de');
  });

  it('throws when neither arg nor env var is provided', () => {
    expect(() => parseRecipient(['node', 'script'], {})).toThrowError(
      /recipient/i,
    );
  });

  it('throws when recipient is not a valid email', () => {
    expect(() => parseRecipient(['node', 'script', 'not-an-email'], {})).toThrowError(
      /email/i,
    );
  });
});
