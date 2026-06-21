import { escapeHtml, htmlLayout, textLayout } from './_layout';

export function renderForgotPasswordMail(args: {
  to: string;
  resetLink: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Passwort-Reset für deinen PflegeAtlas-Account';
  const resetLinkEsc = escapeHtml(args.resetLink);
  const bodyHtml = `
    <p>Hallo,</p>
    <p>Jemand hat einen Passwort-Reset für deinen PflegeAtlas-Account angefordert.</p>
    <p style="margin:32px 0;">
      <a href="${resetLinkEsc}" style="background:#1f5e6d;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Neues Passwort wählen</a>
    </p>
    <p style="font-size:14px;color:#555;">Der Link ist 1 Stunde gültig.</p>
    <p style="font-size:14px;color:#555;">Falls du das nicht warst, kannst du diese Mail einfach löschen.</p>
  `;
  const bodyText = `Hallo,

Passwort-Reset angefordert. Wähle ein neues Passwort:
${args.resetLink}

Der Link ist 1 Stunde gültig. Falls du das nicht warst, kannst du diese Mail einfach löschen.`;
  return { subject, html: htmlLayout({ title: subject, bodyHtml }), text: textLayout({ bodyText }) };
}
