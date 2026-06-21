import { describe, it, expect } from 'vitest';
import { shapeExport } from '@/lib/data-export';

describe('shapeExport', () => {
  it('strips password and includes expected sections', () => {
    const export_ = shapeExport({
      user: { id: 1, email: 'a@b.com', displayName: 'A', role: 'contributor', password: 'shouldnotappear' } as never,
      submissions: [{ id: 10, type: 'new_article', proposedTitle: 'X' } as never],
      articles: [{ id: 20, title: 'Y' } as never],
    });
    expect(export_.user.email).toBe('a@b.com');
    expect(export_.user).not.toHaveProperty('password');
    expect(export_.submissions).toHaveLength(1);
    expect(export_.articles).toHaveLength(1);
    expect(export_.exportedAt).toMatch(/T/);
  });
});
