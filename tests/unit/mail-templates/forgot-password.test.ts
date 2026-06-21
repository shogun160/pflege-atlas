import { describe, it, expect } from 'vitest';
import { renderForgotPasswordMail } from '@/lib/mail-templates/forgot-password';

describe('renderForgotPasswordMail', () => {
  it('contains reset link', () => {
    const result = renderForgotPasswordMail({
      to: 'x@y.z',
      resetLink: 'https://x.y/reset?token=abc',
    });
    expect(result.html).toContain('https://x.y/reset?token=abc');
    expect(result.text).toContain('https://x.y/reset?token=abc');
  });
  it('subject is German + relevant', () => {
    const result = renderForgotPasswordMail({
      to: 'x@y.z',
      resetLink: 'https://x.y/reset?token=abc',
    });
    expect(result.subject).toMatch(/passwort/i);
  });
});
