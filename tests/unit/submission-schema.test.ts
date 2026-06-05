import { describe, expect, it } from 'vitest';
import { SubmissionSchema, flattenZodErrors } from '@/lib/submission-schema';

const validBase = {
  type: 'new_article' as const,
  subject: 'Test-Betreff aus Plan',
  body: 'Test-Inhalt, mindestens zwanzig Zeichen lang um Validation zu bestehen.',
  turnstileToken: 'test-token',
};

describe('SubmissionSchema', () => {
  it('accepts a valid new_article submission with required fields only', () => {
    const result = SubmissionSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('rejects when subject is too short', () => {
    const result = SubmissionSchema.safeParse({ ...validBase, subject: 'ab' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(flat.subject).toMatch(/3 Zeichen/);
    }
  });

  it('rejects when body is too short', () => {
    const result = SubmissionSchema.safeParse({ ...validBase, body: 'kurz' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(flat.body).toMatch(/20 Zeichen/);
    }
  });

  it('rejects when turnstileToken is missing', () => {
    const { turnstileToken, ...withoutToken } = validBase;
    const result = SubmissionSchema.safeParse(withoutToken);
    expect(result.success).toBe(false);
  });

  it('accepts an optional email when correctly formatted', () => {
    const result = SubmissionSchema.safeParse({
      ...validBase,
      submitterEmail: 'oliver@example.org',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = SubmissionSchema.safeParse({
      ...validBase,
      submitterEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(flat.submitterEmail).toMatch(/gültige/);
    }
  });

  it('accepts an empty-string email (optional treatment)', () => {
    const result = SubmissionSchema.safeParse({
      ...validBase,
      submitterEmail: '',
    });
    expect(result.success).toBe(true);
  });

  it('requires relatedArticleSlug when type is correction', () => {
    const result = SubmissionSchema.safeParse({
      ...validBase,
      type: 'correction',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(flat.relatedArticleSlug).toMatch(/Korrektur/);
    }
  });

  it('accepts correction with relatedArticleSlug set', () => {
    const result = SubmissionSchema.safeParse({
      ...validBase,
      type: 'correction',
      relatedArticleSlug: 'dekubitus',
    });
    expect(result.success).toBe(true);
  });
});

describe('flattenZodErrors', () => {
  it('flattens nested errors into { fieldName: firstErrorMessage }', () => {
    const result = SubmissionSchema.safeParse({ ...validBase, subject: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(typeof flat.subject).toBe('string');
      expect(flat.subject.length).toBeGreaterThan(0);
    }
  });
});
