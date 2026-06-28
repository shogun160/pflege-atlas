import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '@/lib/article-import/parse-frontmatter';

describe('parseFrontmatter', () => {
  it('extracts a valid frontmatter block and body', () => {
    const input = `---
title: Hello
intent: bedside
summary: A short summary.
---

## Definition

Body text.`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe('Hello');
    expect(result.data.intent).toBe('bedside');
    expect(result.data.summary).toBe('A short summary.');
    expect(result.body.trim().startsWith('## Definition')).toBe(true);
  });

  it('fails when no frontmatter block is present', () => {
    const result = parseFrontmatter('## Definition\n\nx');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].code).toBe('frontmatter-parse-error');
  });

  it('fails when title is missing', () => {
    const input = `---
intent: bedside
summary: x
---
## Definition
y`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'title-missing')).toBe(true);
  });

  it('fails when intent is invalid', () => {
    const input = `---
title: A
intent: foo
summary: x
---
## Definition
y`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'intent-invalid')).toBe(true);
  });

  it('fails when summary exceeds 280 chars', () => {
    const long = 'x'.repeat(281);
    const input = `---
title: A
intent: bedside
summary: ${long}
---
## Definition
y`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'summary-too-long')).toBe(true);
  });

  it('accepts optional fields and emits warnings for unknown keys', () => {
    const input = `---
title: A
intent: bedside
summary: ok
slug: custom-slug
standardsBound: true
authors:
  - Christoph Mueller
  - Oliver Wosnitza
lastReviewedAt: 2026-06-21
payloadId: 42
status: published
---
## Definition
y`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.slug).toBe('custom-slug');
    expect(result.data.standardsBound).toBe(true);
    expect(result.data.authors).toEqual(['Christoph Mueller', 'Oliver Wosnitza']);
    expect(result.data.lastReviewedAt).toBe('2026-06-21');
    expect(result.warnings.some((w) => w.field === 'payloadId')).toBe(true);
    expect(result.warnings.some((w) => w.field === 'status')).toBe(true);
  });

  it('emits soft warning for invalid lastReviewedAt format', () => {
    const input = `---
title: A
intent: bedside
summary: ok
lastReviewedAt: not-a-date
---
## Definition
y`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.lastReviewedAt).toBeUndefined();
    expect(
      result.warnings.some((w) => w.code === 'last-reviewed-at-invalid-format'),
    ).toBe(true);
  });
});
