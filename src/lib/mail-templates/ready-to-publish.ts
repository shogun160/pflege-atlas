import { escapeHtml, htmlLayout, textLayout } from './_layout';

export function renderReadyToPublishMail(args: {
  to: string;
  articleTitle: string;
  reviewer: string;
  adminLink: string;
}): { subject: string; html: string; text: string } {
  const subject = `Artikel "${args.articleTitle}" ist bereit zur Veröffentlichung`;
  const titleEsc = escapeHtml(args.articleTitle);
  const reviewerEsc = escapeHtml(args.reviewer);
  const adminLinkEsc = escapeHtml(args.adminLink);
  const bodyHtml = `
    <p>Hallo,</p>
    <p>Der Artikel <strong>&quot;${titleEsc}&quot;</strong> wurde von <strong>${reviewerEsc}</strong> zur Veröffentlichung freigegeben.</p>
    <p style="margin:24px 0;"><a href="${adminLinkEsc}" style="color:#1f5e6d;">Im Admin öffnen</a></p>
  `;
  const bodyText = `Artikel "${args.articleTitle}" wurde von ${args.reviewer} zur Veröffentlichung freigegeben.

Im Admin öffnen: ${args.adminLink}`;
  return { subject, html: htmlLayout({ title: subject, bodyHtml }), text: textLayout({ bodyText }) };
}
