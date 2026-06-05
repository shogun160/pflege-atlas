import { describe, expect, it } from 'vitest';
import { buildSubmissionMail } from '@/lib/submission-mail';

const baseSubmission = {
  id: 'sub-abc',
  type: 'new_article' as const,
  subject: 'Vorschlag: Dekubitusprophylaxe-Update',
  body: 'Beschreibung des neuen Inhalts.',
  submitterName: 'Anna Beispiel',
  submitterEmail: 'anna@example.org',
  createdAt: '2026-06-05T12:34:56Z',
};

describe('buildSubmissionMail', () => {
  it('returns to set to redaktion@pflegeatlas.org', () => {
    const mail = buildSubmissionMail({ submission: baseSubmission });
    expect(mail.to).toBe('redaktion@pflegeatlas.org');
  });

  it('builds a subject containing the submission subject', () => {
    const mail = buildSubmissionMail({ submission: baseSubmission });
    expect(mail.subject).toContain('Vorschlag: Dekubitusprophylaxe-Update');
    expect(mail.subject).toMatch(/PflegeAtlas/i);
  });

  it('includes submission body, submitter name and email in html', () => {
    const mail = buildSubmissionMail({ submission: baseSubmission });
    expect(mail.html).toContain('Beschreibung des neuen Inhalts.');
    expect(mail.html).toContain('Anna Beispiel');
    expect(mail.html).toContain('anna@example.org');
  });

  it('shows "anonym" when no submitter name given', () => {
    const mail = buildSubmissionMail({
      submission: { ...baseSubmission, submitterName: undefined },
    });
    expect(mail.text).toMatch(/anonym/i);
  });

  it('shows "—" for related article when none passed', () => {
    const mail = buildSubmissionMail({ submission: baseSubmission });
    expect(mail.text).toMatch(/Bezogen auf:\s*—/);
  });

  it('shows article title when correction with related article', () => {
    const correction = {
      ...baseSubmission,
      type: 'correction' as const,
    };
    const mail = buildSubmissionMail({
      submission: correction,
      articleTitle: 'Dekubitusprophylaxe Basics',
    });
    expect(mail.text).toContain('Dekubitusprophylaxe Basics');
  });

  it('includes admin URL with submission id', () => {
    const mail = buildSubmissionMail({ submission: baseSubmission });
    expect(mail.html).toContain('/admin/collections/submissions/sub-abc');
    expect(mail.text).toContain('/admin/collections/submissions/sub-abc');
  });
});
