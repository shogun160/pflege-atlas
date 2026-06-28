import { describe, it, expect } from 'vitest';
import { matchAuthors } from '@/lib/article-import/match-author';

const users = [
  { id: 1, displayName: 'Christoph Mueller', email: 'c@x.de' },
  { id: 2, displayName: 'Oliver Wosnitza', email: 'o@x.de' },
  { id: 3, displayName: 'Oliver Wosnitza', email: 'o2@x.de' }, // duplicate displayName
];

describe('matchAuthors', () => {
  it('returns empty matches and no warnings for empty input', () => {
    const result = matchAuthors([], users);
    expect(result.matched).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('matches a unique displayName', () => {
    const result = matchAuthors(['Christoph Mueller'], users);
    expect(result.matched).toEqual([1]);
    expect(result.warnings).toEqual([]);
  });

  it('returns warning for unknown name', () => {
    const result = matchAuthors(['Unknown Person'], users);
    expect(result.matched).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe('author-unknown');
  });

  it('on duplicate match, picks first user-id and emits warning', () => {
    const result = matchAuthors(['Oliver Wosnitza'], users);
    expect(result.matched).toEqual([2]);
    expect(result.warnings.some((w) => w.code === 'author-unknown')).toBe(true);
  });

  it('mixes matched and unmatched', () => {
    const result = matchAuthors(['Christoph Mueller', 'Unknown'], users);
    expect(result.matched).toEqual([1]);
    expect(result.warnings).toHaveLength(1);
  });

  it('compares case-insensitively after trim', () => {
    const result = matchAuthors(['  christoph mueller  '], users);
    expect(result.matched).toEqual([1]);
  });
});
