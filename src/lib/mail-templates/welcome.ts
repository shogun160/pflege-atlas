import { escapeHtml, htmlLayout, textLayout } from './_layout';

export function renderWelcomeMail(args: {
  to: string;
  displayName: string;
  role: string;
}): { subject: string; html: string; text: string } {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const target = args.role === 'contributor' ? `${baseUrl}/mein-bereich` : `${baseUrl}/admin`;
  const targetLabel = args.role === 'contributor' ? 'Mein Bereich' : 'Admin-Dashboard';
  const subject = 'Account aktiv — willkommen bei PflegeAtlas';
  const displayNameEsc = escapeHtml(args.displayName);
  const targetEsc = escapeHtml(target);
  const targetLabelEsc = escapeHtml(targetLabel);
  const bodyHtml = `
    <p>Hallo ${displayNameEsc},</p>
    <p>Dein Account ist jetzt aktiv. Willkommen bei PflegeAtlas!</p>
    <p style="margin:32px 0;">
      <a href="${targetEsc}" style="background:#1f5e6d;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">${targetLabelEsc} öffnen</a>
    </p>
  `;
  const bodyText = `Hallo ${args.displayName},

Dein Account ist jetzt aktiv. Willkommen bei PflegeAtlas!

${targetLabel}: ${target}`;
  return { subject, html: htmlLayout({ title: subject, bodyHtml }), text: textLayout({ bodyText }) };
}
