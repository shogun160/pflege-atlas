import { describe, expect, it } from 'vitest';
import { isLexicalDirty, normalizeLexical } from '@/lib/lexical-normalize';

const para = (text: string) => ({
  type: 'paragraph',
  version: 1,
  children: [{ type: 'text', version: 1, text, format: 0 }],
});

describe('normalizeLexical', () => {
  it('strips version field from a node', () => {
    const normalized = normalizeLexical({
      type: 'paragraph',
      version: 1,
      children: [],
    });
    expect(normalized).not.toHaveProperty('version');
  });

  it('strips key/__key/__type fields', () => {
    const normalized = normalizeLexical({
      type: 'text',
      version: 1,
      key: 'abc',
      __key: 'def',
      __type: 'text',
      text: 'foo',
      format: 0,
    });
    expect(normalized).not.toHaveProperty('key');
    expect(normalized).not.toHaveProperty('__key');
    expect(normalized).not.toHaveProperty('__type');
    expect(normalized?.text).toBe('foo');
  });

  it('recurses into children', () => {
    const normalized = normalizeLexical({
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          key: 'p-key',
          children: [{ type: 'text', version: 1, text: 'x', format: 0 }],
        },
      ],
    });
    expect(normalized?.children[0]).not.toHaveProperty('key');
    expect(normalized?.children[0]).not.toHaveProperty('version');
  });

  it('returns null for null input', () => {
    expect(normalizeLexical(null)).toBeNull();
  });
});

describe('isLexicalDirty', () => {
  it('returns false for identical content', () => {
    const a = { type: 'root', version: 1, children: [para('same')] };
    const b = { type: 'root', version: 1, children: [para('same')] };
    expect(isLexicalDirty(a, b)).toBe(false);
  });

  it('returns true for different text content', () => {
    const a = { type: 'root', version: 1, children: [para('alt')] };
    const b = { type: 'root', version: 1, children: [para('neu')] };
    expect(isLexicalDirty(a, b)).toBe(true);
  });

  it('returns false when only internal version differs', () => {
    const a = { type: 'root', version: 1, children: [para('same')] };
    const b = { type: 'root', version: 99, children: [para('same')] };
    expect(isLexicalDirty(a, b)).toBe(false);
  });

  it('returns false when only internal key differs', () => {
    const a = {
      type: 'root',
      version: 1,
      key: 'root-a',
      children: [para('same')],
    };
    const b = {
      type: 'root',
      version: 1,
      key: 'root-b',
      children: [para('same')],
    };
    expect(isLexicalDirty(a, b)).toBe(false);
  });

  it('preserves children order in compare', () => {
    const a = {
      type: 'root',
      version: 1,
      children: [para('a'), para('b')],
    };
    const b = {
      type: 'root',
      version: 1,
      children: [para('b'), para('a')],
    };
    expect(isLexicalDirty(a, b)).toBe(true);
  });
});
