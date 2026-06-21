import { escapeHtml, htmlLayout, textLayout } from './_layout';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  editor: 'Redakteur:in',
  reviewer: 'Reviewer:in',
  contributor: 'Beitragende:r',
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function renderInvitationMail(args: {
  to: string;
  displayName: string;
  role: string;
  invitedBy: string;
  magicLink: string;
  expiresAt: Date;
}): { subject: string; html: string; text: string } {
  const roleLabel = ROLE_LABELS[args.role] ?? args.role;
  const expiry = formatDate(args.expiresAt);
  const subject = `Willkommen bei PflegeAtlas — Account aktivieren`;
  const displayNameEsc = escapeHtml(args.displayName);
  const invitedByEsc = escapeHtml(args.invitedBy);
  const roleLabelEsc = escapeHtml(roleLabel);
  const magicLinkEsc = escapeHtml(args.magicLink);
  const bodyHtml = `
    <p>Hallo ${displayNameEsc},</p>
    <p><strong>${invitedByEsc}</strong> hat dich als <strong>${roleLabelEsc}</strong> bei PflegeAtlas eingeladen.</p>
    <p>PflegeAtlas ist eine offene Wissensplattform für die professionelle Pflege. Beiträge stehen unter CC&nbsp;BY-SA 4.0.</p>
    <p style="margin:32px 0;">
      <a href="${magicLinkEsc}" style="background:#1f5e6d;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Account aktivieren</a>
    </p>
    <p style="font-size:14px;color:#555;">Der Link ist bis zum ${escapeHtml(expiry)} gültig.</p>
    <p style="font-size:14px;color:#555;">Falls der Knopf nicht funktioniert, kopiere bitte diesen Link in deinen Browser:<br><span style="word-break:break-all;">${magicLinkEsc}</span></p>
  `;
  const bodyText = `Hallo ${args.displayName},

${args.invitedBy} hat dich als ${roleLabel} bei PflegeAtlas eingeladen.

Aktiviere deinen Account: ${args.magicLink}

Der Link ist bis zum ${expiry} gültig.`;
  return {
    subject,
    html: htmlLayout({ title: subject, bodyHtml }),
    text: textLayout({ bodyText }),
  };
}
