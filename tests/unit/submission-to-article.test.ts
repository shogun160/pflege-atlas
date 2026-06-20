import { describe, expect, it } from 'vitest';
import { applySubmissionToArticle } from '@/lib/submission-to-article';

const LEX = (text: string) => ({
  root: {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', text }] }],
  },
});

describe('applySubmissionToArticle (new_article)', () => {
  it('maps proposed fields to a fresh article patch', () => {
    const sub = {
      type: 'new_article',
      proposedTitle: 'Mein Titel',
      proposedIntent: 'bedside',
      proposedSummary: 'Kurz',
      proposedSlug: 'mein-titel',
      proposedDefinition: LEX('def'),
      proposedPraxis: LEX('prx'),
      proposedRisiken: LEX('rsk'),
      proposedQuellen: LEX('qul'),
    };
    const result = applySubmissionToArticle(sub, null);
    expect(result.mode).toBe('create');
    expect(result.slug).toBe('mein-titel');
    expect(result.patch.title).toBe('Mein Titel');
    expect(result.patch.intent).toBe('bedside');
    expect(result.patch.summary).toBe('Kurz');
    expect(result.patch.definition).toEqual(LEX('def'));
    expect(result.patch.status).toBe('published');
  });

  it('falls back to "background" intent when not proposed', () => {
    const sub = {
      type: 'new_article',
      proposedTitle: 'X',
      proposedSummary: '',
      proposedSlug: 'x',
      proposedDefinition: LEX('a'),
      proposedPraxis: LEX('a'),
      proposedRisiken: LEX('a'),
      proposedQuellen: LEX('a'),
    };
    const result = applySubmissionToArticle(sub, null);
    expect(result.patch.intent).toBe('background');
  });
});

describe('applySubmissionToArticle (correction)', () => {
  const article = {
    id: 5,
    slug: 'demo',
    title: 'Demo',
    intent: 'background',
    summary: 's',
    definition: LEX('old-def'),
    praxis: LEX('old-prx'),
    risiken: LEX('old-rsk'),
    quellen: LEX('old-qul'),
  };

  it('only replaces sections that have edited content', () => {
    const sub = {
      type: 'correction',
      editedPraxis: LEX('new-prx'),
    };
    const result = applySubmissionToArticle(sub, article);
    expect(result.mode).toBe('update');
    expect(result.patch.definition).toBeUndefined();
    expect(result.patch.praxis).toEqual(LEX('new-prx'));
    expect(result.patch.risiken).toBeUndefined();
    expect(result.patch.quellen).toBeUndefined();
  });

  it('returns slug from existing article (no override)', () => {
    const sub = { type: 'correction', editedDefinition: LEX('x') };
    const result = applySubmissionToArticle(sub, article);
    expect(result.slug).toBe('demo');
  });

  it('throws when correction has no article context', () => {
    const sub = { type: 'correction' as const, editedDefinition: LEX('x') };
    expect(() => applySubmissionToArticle(sub, null)).toThrow(/Correction.+requires.+article/i);
  });
});
