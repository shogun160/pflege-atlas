import { describe, expect, it } from 'vitest';
import { diffSection } from '@/lib/submission-section-diff';

describe('diffSection', () => {
  it('returns empty changeset for identical content', () => {
    const result = diffSection('Hallo Welt\nZeile zwei', 'Hallo Welt\nZeile zwei');
    expect(result.changed).toBe(false);
    expect(result.parts.every((p) => p.kind === 'equal')).toBe(true);
  });

  it('marks added lines as additions', () => {
    const result = diffSection('a\nb', 'a\nb\nc');
    expect(result.changed).toBe(true);
    const added = result.parts.filter((p) => p.kind === 'add');
    expect(added.length).toBeGreaterThan(0);
    expect(added.some((p) => p.text.includes('c'))).toBe(true);
  });

  it('marks removed lines as removals', () => {
    const result = diffSection('a\nb\nc', 'a\nc');
    expect(result.changed).toBe(true);
    const removed = result.parts.filter((p) => p.kind === 'remove');
    expect(removed.length).toBeGreaterThan(0);
    expect(removed.some((p) => p.text.includes('b'))).toBe(true);
  });

  it('handles empty original (pure addition)', () => {
    const result = diffSection('', 'neuer Text');
    expect(result.changed).toBe(true);
    expect(result.parts[0].kind).toBe('add');
  });
});
