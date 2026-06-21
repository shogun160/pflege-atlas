import { describe, it, expect } from 'vitest';
import { renderInvitationMail } from '@/lib/mail-templates/invitation';

describe('renderInvitationMail', () => {
  const args = {
    to: 'eingeladene@test.local',
    displayName: 'Test Name',
    role: 'reviewer' as const,
    invitedBy: 'Christoph',
    magicLink: 'https://example.com/passwort-setzen?token=abc123',
    expiresAt: new Date('2026-06-28T12:00:00Z'),
  };

  it('includes magic link in HTML and text', () => {
    const result = renderInvitationMail(args);
    expect(result.html).toContain(args.magicLink);
    expect(result.text).toContain(args.magicLink);
  });

  it('mentions inviter name and role', () => {
    const result = renderInvitationMail(args);
    expect(result.html).toContain('Christoph');
    expect(result.html).toContain('Reviewer');
  });

  it('mentions expiry date in human-readable form', () => {
    const result = renderInvitationMail(args);
    expect(result.text).toMatch(/28\.06\.2026|28\. Juni 2026/);
  });

  it('subject is non-empty German', () => {
    const result = renderInvitationMail(args);
    expect(result.subject).toMatch(/willkommen|einladung|account/i);
  });

  it('does not include the word "Passwort" with a value', () => {
    const result = renderInvitationMail(args);
    expect(result.html).not.toMatch(/Passwort:\s*\S+/);
  });

  it('HTML-escapes user-controlled fields (displayName, invitedBy)', () => {
    const result = renderInvitationMail({
      ...args,
      displayName: '<script>alert(1)</script>',
      invitedBy: 'Eve" onclick="evil()',
    });
    expect(result.html).not.toContain('<script>alert(1)</script>');
    expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result.html).not.toContain('onclick="evil()');
    expect(result.html).toContain('&quot;');
  });
});
