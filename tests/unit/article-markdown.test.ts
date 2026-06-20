// tests/unit/article-markdown.test.ts
import { describe, expect, it } from 'vitest';
import { renderArticleMarkdown, hashContent } from '@/lib/article-markdown';

const SAMPLE_LEXICAL = {
  root: {
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', text: 'Hallo' }] },
    ],
  },
};

const SAMPLE_ARTICLE = {
  id: 42,
  title: 'Dekubitusprophylaxe',
  slug: 'dekubitusprophylaxe',
  intent: 'bedside',
  summary: 'Vorbeugung von Druckgeschwüren',
  status: 'published',
  lastReviewedAt: '2026-06-20',
  standardsBound: true,
  definition: SAMPLE_LEXICAL,
  praxis: SAMPLE_LEXICAL,
  risiken: SAMPLE_LEXICAL,
  quellen: SAMPLE_LEXICAL,
};

describe('renderArticleMarkdown', () => {
  it('emits frontmatter with all expected fields', () => {
    const md = renderArticleMarkdown(SAMPLE_ARTICLE, ['Christoph Brück']);
    expect(md).toContain('---\n');
    expect(md).toContain('payloadId: 42');
    expect(md).toContain('slug: dekubitusprophylaxe');
    expect(md).toContain('title: Dekubitusprophylaxe');
    expect(md).toContain('intent: bedside');
    expect(md).toContain('summary: Vorbeugung von Druckgeschwüren');
    expect(md).toContain('status: published');
    expect(md).toContain('lastReviewedAt: 2026-06-20');
    expect(md).toContain('standardsBound: true');
    expect(md).toContain('authors:\n  - Christoph Brück');
  });

  it('emits the four section headings in fixed order', () => {
    const md = renderArticleMarkdown(SAMPLE_ARTICLE, []);
    const defIdx = md.indexOf('## Definition');
    const prxIdx = md.indexOf('## Praxis');
    const rskIdx = md.indexOf('## Risiken & Fallstricke');
    const qulIdx = md.indexOf('## Quellen & Weiterführendes');
    expect(defIdx).toBeGreaterThan(0);
    expect(prxIdx).toBeGreaterThan(defIdx);
    expect(rskIdx).toBeGreaterThan(prxIdx);
    expect(qulIdx).toBeGreaterThan(rskIdx);
  });

  it('falls back to empty authors list when none provided', () => {
    const md = renderArticleMarkdown(SAMPLE_ARTICLE, []);
    expect(md).toContain('authors: []');
  });

  it('omits lastReviewedAt when not set', () => {
    const article = { ...SAMPLE_ARTICLE, lastReviewedAt: undefined };
    const md = renderArticleMarkdown(article, []);
    expect(md).not.toContain('lastReviewedAt');
  });

  it('quotes title and summary if they contain special chars', () => {
    const article = { ...SAMPLE_ARTICLE, title: 'Mit: Doppelpunkt', summary: 'Hat # Hash' };
    const md = renderArticleMarkdown(article, []);
    expect(md).toContain("title: 'Mit: Doppelpunkt'");
    expect(md).toContain("summary: 'Hat # Hash'");
  });
});

describe('hashContent', () => {
  it('returns same hash for identical content', () => {
    expect(hashContent('abc')).toBe(hashContent('abc'));
  });

  it('returns different hash for different content', () => {
    expect(hashContent('abc')).not.toBe(hashContent('abd'));
  });
});
