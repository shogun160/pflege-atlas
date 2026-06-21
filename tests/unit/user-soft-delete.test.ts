import { describe, it, expect } from 'vitest';
import { anonymizeUserPatch } from '@/lib/user-soft-delete';

describe('anonymizeUserPatch', () => {
  it('returns patch with disabled=true and randomized email', () => {
    const patch = anonymizeUserPatch();
    expect(patch.disabled).toBe(true);
    expect(patch.email).toMatch(/^deleted-[A-Za-z0-9_-]+@invalid\.local$/);
    expect(patch.displayName).toBe('Gelöschte:r Beitragende:r');
    expect(patch.bio).toBeNull();
    expect(patch.pflegerischeRolle).toBeNull();
    expect(patch.bundesland).toBeNull();
    expect(patch.avatar).toBeNull();
  });

  it('produces unique emails per call', () => {
    const a = anonymizeUserPatch();
    const b = anonymizeUserPatch();
    expect(a.email).not.toBe(b.email);
  });
});
