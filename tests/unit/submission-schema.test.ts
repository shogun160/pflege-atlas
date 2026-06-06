import { describe, expect, it } from 'vitest';
import { SubmissionSchema, flattenZodErrors } from '@/lib/submission-schema';

const lexicalSample = JSON.stringify({
  type: 'root',
  version: 1,
  children: [
    {
      type: 'paragraph',
      version: 1,
      children: [{ type: 'text', version: 1, text: 'Inhalt', format: 0 }],
    },
  ],
});

const validNewArticle = {
  type: 'new_article' as const,
  proposedTitle: 'Dekubitusprophylaxe',
  proposedDefinition: lexicalSample,
  proposedPraxis: lexicalSample,
  proposedRisiken: lexicalSample,
  proposedQuellen: lexicalSample,
  turnstileToken: 'test-token',
};

const validCorrection = {
  type: 'correction' as const,
  relatedArticleSlug: 'dekubitus',
  selectedSections: ['praxis' as const],
  editedPraxis: lexicalSample,
  turnstileToken: 'test-token',
};

describe('SubmissionSchema — new_article path', () => {
  it('accepts a valid new_article submission with required fields only', () => {
    const result = SubmissionSchema.safeParse(validNewArticle);
    expect(result.success).toBe(true);
  });

  it('rejects when proposedTitle is too short', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, proposedTitle: 'ab' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(flat.proposedTitle).toMatch(/3 Zeichen/);
    }
  });

  it('rejects when proposedDefinition is missing', () => {
    const { proposedDefinition: _proposedDefinition, ...rest } = validNewArticle;
    const result = SubmissionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('accepts empty proposedIntent (optional)', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, proposedIntent: undefined });
    expect(result.success).toBe(true);
  });

  it('accepts a valid proposedIntent', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, proposedIntent: 'bedside' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid proposedIntent', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, proposedIntent: 'something' });
    expect(result.success).toBe(false);
  });

  it('accepts empty proposedSummary (optional)', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, proposedSummary: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a proposedSummary over 280 chars', () => {
    const result = SubmissionSchema.safeParse({
      ...validNewArticle,
      proposedSummary: 'x'.repeat(281),
    });
    expect(result.success).toBe(false);
  });

  it('accepts an optional submitterEmail when correctly formatted', () => {
    const result = SubmissionSchema.safeParse({
      ...validNewArticle,
      submitterEmail: 'oliver@example.org',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed submitterEmail', () => {
    const result = SubmissionSchema.safeParse({
      ...validNewArticle,
      submitterEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty-string submitterEmail (optional)', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, submitterEmail: '' });
    expect(result.success).toBe(true);
  });
});

describe('SubmissionSchema — correction path', () => {
  it('accepts a valid correction with one section', () => {
    const result = SubmissionSchema.safeParse(validCorrection);
    expect(result.success).toBe(true);
  });

  it('accepts a valid correction with multiple sections', () => {
    const result = SubmissionSchema.safeParse({
      ...validCorrection,
      selectedSections: ['praxis', 'risiken'],
      editedRisiken: lexicalSample,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty selectedSections array', () => {
    const result = SubmissionSchema.safeParse({ ...validCorrection, selectedSections: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(flat.selectedSections).toMatch(/Mindestens/);
    }
  });

  it('rejects when selectedSections includes a section without edited content', () => {
    const result = SubmissionSchema.safeParse({
      ...validCorrection,
      selectedSections: ['praxis', 'risiken'],
      // editedRisiken missing
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing relatedArticleSlug on correction', () => {
    const { relatedArticleSlug: _relatedArticleSlug, ...rest } = validCorrection;
    const result = SubmissionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid section name in selectedSections', () => {
    const result = SubmissionSchema.safeParse({
      ...validCorrection,
      selectedSections: ['notasection'],
    });
    expect(result.success).toBe(false);
  });

  it('accepts an optional correctionReason', () => {
    const result = SubmissionSchema.safeParse({
      ...validCorrection,
      correctionReason: 'Standard X seit 2025 anders.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a correctionReason over 2000 chars', () => {
    const result = SubmissionSchema.safeParse({
      ...validCorrection,
      correctionReason: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('SubmissionSchema — turnstile + common', () => {
  it('rejects when turnstileToken is missing', () => {
    const { turnstileToken: _turnstileToken, ...rest } = validNewArticle;
    const result = SubmissionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe('flattenZodErrors', () => {
  it('flattens errors into { fieldName: firstErrorMessage }', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, proposedTitle: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(typeof flat.proposedTitle).toBe('string');
      expect(flat.proposedTitle.length).toBeGreaterThan(0);
    }
  });
});
