import { describe, it, expect } from 'vitest';
import { splitSections } from '@/lib/article-import/split-sections';

describe('splitSections', () => {
  const valid = `
## Definition

Def body.

## Praxis

Prax body.

## Risiken & Fallstricke

Risk body.

## Quellen & Weiterführendes

Q body.
`;

  it('extracts all four sections in canonical case', () => {
    const result = splitSections(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sections.definition.trim()).toBe('Def body.');
    expect(result.sections.praxis.trim()).toBe('Prax body.');
    expect(result.sections.risiken.trim()).toBe('Risk body.');
    expect(result.sections.quellen.trim()).toBe('Q body.');
  });

  it('matches headings case-insensitively and trims', () => {
    const input = valid
      .replace('## Definition', '##   definition   ')
      .replace('## Praxis', '## PRAXIS');
    const result = splitSections(input);
    expect(result.ok).toBe(true);
  });

  it('reports missing section', () => {
    const input = valid.replace(/## Praxis[\s\S]*?(?=## Risiken)/, '');
    const result = splitSections(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.some((i) => i.code === 'section-missing' && i.field === 'praxis'),
    ).toBe(true);
  });

  it('reports empty section', () => {
    const input = valid.replace('Def body.', '   \n  \n');
    const result = splitSections(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.some((i) => i.code === 'section-empty' && i.field === 'definition'),
    ).toBe(true);
  });

  it('accepts sections in any order', () => {
    const reordered = `
## Quellen & Weiterführendes
q
## Risiken & Fallstricke
r
## Praxis
p
## Definition
d
`;
    const result = splitSections(reordered);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sections.definition.trim()).toBe('d');
    expect(result.sections.quellen.trim()).toBe('q');
  });
});
