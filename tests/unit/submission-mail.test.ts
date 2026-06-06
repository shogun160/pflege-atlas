import { describe, expect, it } from 'vitest';
import { buildSubmissionMail } from '@/lib/submission-mail';

const lexical = (text: string) =>
  JSON.stringify({
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text, format: 0 }],
      },
    ],
  });

describe('buildSubmissionMail — new_article', () => {
  it('uses proposedTitle in subject', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'new_article',
        proposedTitle: 'Dekubitusprophylaxe',
        proposedDefinition: lexical('Definition…'),
        proposedPraxis: lexical('Praxis…'),
        proposedRisiken: lexical('Risiken…'),
        proposedQuellen: lexical('Quellen…'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.subject).toContain('Neuer Artikel-Vorschlag');
    expect(mail.subject).toContain('Dekubitusprophylaxe');
  });

  it('renders all four sections in body', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'new_article',
        proposedTitle: 'X',
        proposedDefinition: lexical('Def-Text'),
        proposedPraxis: lexical('Prax-Text'),
        proposedRisiken: lexical('Risi-Text'),
        proposedQuellen: lexical('Quel-Text'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('Definition');
    expect(mail.text).toContain('Def-Text');
    expect(mail.text).toContain('Praxis');
    expect(mail.text).toContain('Prax-Text');
    expect(mail.text).toContain('Risiken');
    expect(mail.text).toContain('Risi-Text');
    expect(mail.text).toContain('Quellen');
    expect(mail.text).toContain('Quel-Text');
  });

  it('renders placeholder when intent or summary missing', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'new_article',
        proposedTitle: 'X',
        proposedDefinition: lexical('a'),
        proposedPraxis: lexical('a'),
        proposedRisiken: lexical('a'),
        proposedQuellen: lexical('a'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('Intent: — offen');
    expect(mail.text).toContain('Summary: — offen');
  });
});

describe('buildSubmissionMail — correction', () => {
  it('uses article title in subject', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'correction',
        selectedSections: ['praxis'],
        editedPraxis: lexical('Neuer Praxis-Text'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      articleTitle: 'Dekubitus',
      articleId: 42,
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.subject).toContain('Korrektur');
    expect(mail.subject).toContain('Dekubitus');
  });

  it('renders only selected sections', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'correction',
        selectedSections: ['praxis'],
        editedPraxis: lexical('PRAX-NEU'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      articleTitle: 'A',
      articleId: 1,
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('Praxis');
    expect(mail.text).toContain('PRAX-NEU');
    expect(mail.text).not.toContain('Risiken (neuer Stand)');
    expect(mail.text).not.toContain('Quellen (neuer Stand)');
    expect(mail.text).not.toContain('Definition (neuer Stand)');
  });

  it('includes article admin link', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '5',
        type: 'correction',
        selectedSections: ['praxis'],
        editedPraxis: lexical('x'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      articleTitle: 'A',
      articleId: 7,
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('http://localhost:3000/admin/collections/articles/7');
  });

  it('includes correctionReason when present', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '5',
        type: 'correction',
        selectedSections: ['praxis'],
        editedPraxis: lexical('x'),
        correctionReason: 'Standard X seit 2025 anders.',
        createdAt: '2026-06-06T12:00:00Z',
      },
      articleTitle: 'A',
      articleId: 7,
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('Standard X seit 2025 anders.');
  });

  it('shows „— keine —" placeholder when no correctionReason', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '5',
        type: 'correction',
        selectedSections: ['praxis'],
        editedPraxis: lexical('x'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      articleTitle: 'A',
      articleId: 7,
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('— keine —');
  });
});

describe('buildSubmissionMail — common', () => {
  it('shows submitterEmail when provided', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'new_article',
        proposedTitle: 'X',
        proposedDefinition: lexical('a'),
        proposedPraxis: lexical('a'),
        proposedRisiken: lexical('a'),
        proposedQuellen: lexical('a'),
        submitterName: 'Anna',
        submitterEmail: 'anna@example.org',
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('Anna');
    expect(mail.text).toContain('anna@example.org');
  });

  it('shows „anonym" placeholder when submitterName missing', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'new_article',
        proposedTitle: 'X',
        proposedDefinition: lexical('a'),
        proposedPraxis: lexical('a'),
        proposedRisiken: lexical('a'),
        proposedQuellen: lexical('a'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('anonym');
  });

  it('includes submission admin link', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '42',
        type: 'new_article',
        proposedTitle: 'X',
        proposedDefinition: lexical('a'),
        proposedPraxis: lexical('a'),
        proposedRisiken: lexical('a'),
        proposedQuellen: lexical('a'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('http://localhost:3000/admin/collections/submissions/42');
  });

  it('uses redaktion@pflegeatlas.org as to address', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'new_article',
        proposedTitle: 'X',
        proposedDefinition: lexical('a'),
        proposedPraxis: lexical('a'),
        proposedRisiken: lexical('a'),
        proposedQuellen: lexical('a'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.to).toBe('redaktion@pflegeatlas.org');
  });
});
