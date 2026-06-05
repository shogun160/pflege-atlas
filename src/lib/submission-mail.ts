type SubmissionForMail = {
  id: string;
  type: 'new_article' | 'correction';
  subject: string;
  body: string;
  submitterName?: string;
  submitterEmail?: string;
  createdAt: string;
};

type Args = {
  submission: SubmissionForMail;
  articleTitle?: string;
  siteUrl?: string;
};

const TYPE_LABELS = {
  new_article: 'Neuer Artikel-Vorschlag',
  correction: 'Korrektur',
} as const;

export function buildSubmissionMail({
  submission,
  articleTitle,
  siteUrl = 'https://pflegeatlas.org',
}: Args) {
  const typeLabel = TYPE_LABELS[submission.type];
  const senderName = submission.submitterName || 'anonym';
  const senderEmail = submission.submitterEmail || 'keine Mailadresse';
  const articleLabel = articleTitle || '—';
  const adminUrl = `${siteUrl}/admin/collections/submissions/${submission.id}`;

  const subject = `[PflegeAtlas] Neue Submission: ${submission.subject}`;

  const text = [
    `Neue Submission auf PflegeAtlas`,
    ``,
    `Eingegangen am: ${submission.createdAt}`,
    `Typ: ${typeLabel}`,
    `Betreff: ${submission.subject}`,
    `Bezogen auf: ${articleLabel}`,
    `Eingereicht von: ${senderName} (${senderEmail})`,
    ``,
    `—— Inhalt ——`,
    submission.body,
    ``,
    `—— Verwaltung ——`,
    `Im Admin öffnen: ${adminUrl}`,
  ].join('\n');

  const html = `
<div style="font-family: sans-serif; line-height: 1.5; color: #1f2937;">
  <h2 style="margin-bottom: 0.5rem;">Neue Submission auf PflegeAtlas</h2>
  <dl style="margin: 0;">
    <dt style="font-weight: 600;">Eingegangen am</dt><dd>${escapeHtml(submission.createdAt)}</dd>
    <dt style="font-weight: 600;">Typ</dt><dd>${escapeHtml(typeLabel)}</dd>
    <dt style="font-weight: 600;">Betreff</dt><dd>${escapeHtml(submission.subject)}</dd>
    <dt style="font-weight: 600;">Bezogen auf</dt><dd>${escapeHtml(articleLabel)}</dd>
    <dt style="font-weight: 600;">Eingereicht von</dt><dd>${escapeHtml(senderName)} (${escapeHtml(senderEmail)})</dd>
  </dl>
  <h3 style="margin-top: 1.5rem;">Inhalt</h3>
  <p style="white-space: pre-wrap;">${escapeHtml(submission.body)}</p>
  <hr style="margin: 1.5rem 0;">
  <p><a href="${adminUrl}">Im Admin öffnen</a></p>
</div>`.trim();

  return {
    to: 'redaktion@pflegeatlas.org',
    subject,
    text,
    html,
  };
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
