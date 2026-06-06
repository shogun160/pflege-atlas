import { describe, expect, it } from 'vitest';
import { unwrapLexicalRoot } from '@/lib/lexical-unwrap';

describe('unwrapLexicalRoot', () => {
  it('returns the inner root from a wrapped {root: {...}} shape', () => {
    const wrapped = {
      root: { type: 'root', children: [{ type: 'paragraph', children: [] }] },
    };
    const result = unwrapLexicalRoot(wrapped);
    expect(result?.type).toBe('root');
    expect(result?.children).toHaveLength(1);
  });

  it('returns the same object from a bare {type: "root", ...} shape', () => {
    const bare = { type: 'root' as const, children: [] };
    const result = unwrapLexicalRoot(bare);
    expect(result).toBe(bare);
  });

  it('returns null for null input', () => {
    expect(unwrapLexicalRoot(null)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(unwrapLexicalRoot('not an object')).toBeNull();
    expect(unwrapLexicalRoot(42)).toBeNull();
  });

  it('returns null when no root marker is found', () => {
    expect(unwrapLexicalRoot({ foo: 'bar' })).toBeNull();
    expect(unwrapLexicalRoot({ root: { type: 'paragraph' } })).toBeNull();
  });
});
