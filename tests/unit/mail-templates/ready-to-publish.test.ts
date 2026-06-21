import { describe, it, expect } from 'vitest';
import { renderReadyToPublishMail } from '@/lib/mail-templates/ready-to-publish';

describe('renderReadyToPublishMail', () => {
  it('includes article title and reviewer name', () => {
    const r = renderReadyToPublishMail({
      to: 'editor@x.de',
      articleTitle: 'Dekubitus',
      reviewer: 'Anna',
      adminLink: 'https://x.de/admin/collections/articles/42',
    });
    expect(r.html).toContain('Dekubitus');
    expect(r.html).toContain('Anna');
    expect(r.html).toContain('https://x.de/admin/collections/articles/42');
  });
  it('HTML-escapes articleTitle and reviewer', () => {
    const r = renderReadyToPublishMail({
      to: 'editor@x.de',
      articleTitle: '<script>x()</script>',
      reviewer: '" onclick="evil()',
      adminLink: 'https://x.de/admin/collections/articles/42',
    });
    expect(r.html).not.toContain('<script>x()</script>');
    expect(r.html).toContain('&lt;script&gt;');
    expect(r.html).not.toContain('onclick="evil()');
  });
});
