import { lexicalToPlainText } from './lexical-to-plain-text';
import { unwrapLexicalRoot } from './lexical-unwrap';

export type SubmissionMailInput =
  | {
      id: string;
      type: 'new_article';
      proposedTitle: string;
      proposedIntent?: string;
      proposedSummary?: string;
      proposedDefinition: string;
      proposedPraxis: string;
      proposedRisiken: string;
      proposedQuellen: string;
      submitterName?: string;
      submitterEmail?: string;
      createdAt: string;
    }
  | {
      id: string;
      type: 'correction';
      selectedSections: Array<'definition' | 'praxis' | 'risiken' | 'quellen'>;
      editedDefinition?: string;
      editedPraxis?: string;
      editedRisiken?: string;
      editedQuellen?: string;
      correctionReason?: string;
      submitterName?: string;
      submitterEmail?: string;
      createdAt: string;
    };

interface BuildArgs {
  submission: SubmissionMailInput;
  articleTitle?: string;
  articleId?: number;
  adminUrl: string;
}

interface BuiltMail {
  to: string;
  from?: string;
  subject: string;
  text: string;
}

const SECTION_LABELS = {
  definition: 'Definition',
  praxis: 'Praxis',
  risiken: 'Risiken',
  quellen: 'Quellen',
} as const;

function safeRender(jsonString: string | undefined): string {
  if (!jsonString) return '';
  try {
    const root = unwrapLexicalRoot(JSON.parse(jsonString));
    if (!root) return '';
    return lexicalToPlainText(root as Parameters<typeof lexicalToPlainText>[0]);
  } catch {
    return '';
  }
}

function renderSubmitterLine(s: SubmissionMailInput): string {
  const name = s.submitterName?.trim() || 'anonym';
  const email = s.submitterEmail?.trim() || '—';
  return `Eingereicht von: ${name} <${email}>`;
}

function buildNewArticleBody(s: Extract<SubmissionMailInput, { type: 'new_article' }>, adminUrl: string): string {
  const lines: string[] = [];
  lines.push('Neuer Artikel-Vorschlag');
  lines.push('');
  lines.push(`Titel: ${s.proposedTitle}`);
  lines.push(`Intent: ${s.proposedIntent ?? '— offen, von Redaktion zu setzen —'}`);
  lines.push(`Summary: ${s.proposedSummary?.trim() || '— offen —'}`);
  lines.push('');
  for (const section of ['definition', 'praxis', 'risiken', 'quellen'] as const) {
    const key = `proposed${section.charAt(0).toUpperCase()}${section.slice(1)}` as
      | 'proposedDefinition'
      | 'proposedPraxis'
      | 'proposedRisiken'
      | 'proposedQuellen';
    lines.push(`--- ${SECTION_LABELS[section]} ---`);
    lines.push(safeRender(s[key]));
    lines.push('');
  }
  lines.push('—');
  lines.push(renderSubmitterLine(s));
  lines.push(`Submission-ID: ${s.id}`);
  lines.push(`Admin-Link: ${adminUrl}/admin/collections/submissions/${s.id}`);
  return lines.join('\n');
}

function buildCorrectionBody(
  s: Extract<SubmissionMailInput, { type: 'correction' }>,
  articleTitle: string,
  articleId: number,
  adminUrl: string,
): string {
  const lines: string[] = [];
  lines.push('Korrekturvorschlag');
  lines.push('');
  lines.push(`Artikel: ${articleTitle}`);
  lines.push(`Article-Admin-Link: ${adminUrl}/admin/collections/articles/${articleId}`);
  lines.push(`Sektionen mit Änderungen: ${s.selectedSections.join(', ')}`);
  lines.push('');
  lines.push('Begründung:');
  lines.push(s.correctionReason?.trim() || '— keine —');
  lines.push('');
  for (const section of s.selectedSections) {
    const key = `edited${section.charAt(0).toUpperCase()}${section.slice(1)}` as
      | 'editedDefinition'
      | 'editedPraxis'
      | 'editedRisiken'
      | 'editedQuellen';
    lines.push(`--- ${SECTION_LABELS[section]} (neuer Stand) ---`);
    lines.push(safeRender(s[key]));
    lines.push('');
  }
  lines.push('—');
  lines.push(renderSubmitterLine(s));
  lines.push(`Submission-ID: ${s.id}`);
  lines.push(`Admin-Link: ${adminUrl}/admin/collections/submissions/${s.id}`);
  return lines.join('\n');
}

export function buildSubmissionMail({ submission, articleTitle, articleId, adminUrl }: BuildArgs): BuiltMail {
  const to = 'redaktion@pflegeatlas.org';
  if (submission.type === 'new_article') {
    return {
      to,
      subject: `[PflegeAtlas] Neuer Artikel-Vorschlag: "${submission.proposedTitle}"`,
      text: buildNewArticleBody(submission, adminUrl),
    };
  }
  return {
    to,
    subject: `[PflegeAtlas] Korrektur: "${articleTitle ?? 'Artikel'}"`,
    text: buildCorrectionBody(submission, articleTitle ?? 'Artikel', articleId ?? 0, adminUrl),
  };
}
