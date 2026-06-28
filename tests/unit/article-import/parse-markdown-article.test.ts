import { describe, it, expect } from 'vitest';
import { parseMarkdownArticle } from '@/lib/article-import/parse-markdown-article';

const happyPath = `---
title: Dekubitusprophylaxe
intent: bedside
summary: Wie man Druckgeschwüre erkennt und verhindert.
---

## Definition

Was Dekubitus ist.

## Praxis

**Wichtig:** Regelmäßig umlagern.

## Risiken & Fallstricke

- Reibung
- Scherkräfte

## Quellen & Weiterführendes

[Expertenstandard](https://example.com)
`;

describe('parseMarkdownArticle', () => {
  it('returns ok=true for a valid article', () => {
    const result = parseMarkdownArticle(happyPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.article.frontmatter.title).toBe('Dekubitusprophylaxe');
    expect(result.article.frontmatter.intent).toBe('bedside');
    expect(result.article.sections.definition).toContain('Was Dekubitus');
  });

  it('returns ok=false when frontmatter is invalid', () => {
    const result = parseMarkdownArticle('no frontmatter here');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'frontmatter-parse-error')).toBe(true);
  });

  it('returns ok=false when a section is missing', () => {
    const broken = happyPath.replace(/## Praxis[\s\S]*?(?=## Risiken)/, '');
    const result = parseMarkdownArticle(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'section-missing')).toBe(true);
  });

  it('carries frontmatter warnings into the result', () => {
    const withWarnings = happyPath.replace('---\n\n', '---\n').replace(
      'title: Dekubitusprophylaxe\n',
      'title: Dekubitusprophylaxe\npayloadId: 42\n',
    );
    const result = parseMarkdownArticle(withWarnings);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.article.warnings.some((w) => w.field === 'payloadId')).toBe(true);
  });
});
