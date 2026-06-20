// tests/unit/slug-resolver.test.ts
import { describe, expect, it } from 'vitest';
import { resolveUniqueSlug } from '@/lib/slug-resolver';

describe('resolveUniqueSlug', () => {
  it('returns base slug if not taken', async () => {
    const exists = async (s: string) => s === 'taken';
    expect(await resolveUniqueSlug('frei', exists)).toBe('frei');
  });

  it('appends -2 if base taken', async () => {
    const exists = async (s: string) => s === 'taken';
    expect(await resolveUniqueSlug('taken', exists)).toBe('taken-2');
  });

  it('appends -3 if base and -2 taken', async () => {
    const taken = new Set(['x', 'x-2']);
    const exists = async (s: string) => taken.has(s);
    expect(await resolveUniqueSlug('x', exists)).toBe('x-3');
  });

  it('gives up after 100 attempts', async () => {
    const exists = async () => true;
    await expect(resolveUniqueSlug('any', exists)).rejects.toThrow(/no unique slug/i);
  });
});
