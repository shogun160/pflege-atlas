import { describe, it, expect } from 'vitest';
import { renderWelcomeMail } from '@/lib/mail-templates/welcome';

describe('renderWelcomeMail', () => {
  it('greets by displayName', () => {
    const r = renderWelcomeMail({ to: 'x@y.z', displayName: 'Anna', role: 'contributor' });
    expect(r.html).toContain('Anna');
    expect(r.text).toContain('Anna');
  });
  it('links to /mein-bereich for contributor', () => {
    const r = renderWelcomeMail({ to: 'x@y.z', displayName: 'Anna', role: 'contributor' });
    expect(r.html).toContain('/mein-bereich');
  });
  it('links to /admin for editor', () => {
    const r = renderWelcomeMail({ to: 'x@y.z', displayName: 'Anna', role: 'editor' });
    expect(r.html).toContain('/admin');
  });
  it('HTML-escapes displayName', () => {
    const r = renderWelcomeMail({
      to: 'x@y.z',
      displayName: '<img src=x onerror=evil>',
      role: 'contributor',
    });
    expect(r.html).not.toContain('<img src=x onerror=evil>');
    expect(r.html).toContain('&lt;img');
  });
});
