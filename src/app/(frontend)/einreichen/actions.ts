'use server';

import { redirect } from 'next/navigation';
import { SubmissionSchema, flattenZodErrors, type SubmissionSection } from '@/lib/submission-schema';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { buildSubmissionMail, type SubmissionMailInput } from '@/lib/submission-mail';
import { getPayloadClient } from '@/lib/payload';
import { sanitizeLexicalRoot } from '@/lib/lexical-sanitize';
import { isLexicalDirty } from '@/lib/lexical-normalize';

export type SubmitState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  values?: {
    type?: string;
    submitterName?: string;
    submitterEmail?: string;
    relatedArticleSlug?: string;
    proposedTitle?: string;
    proposedIntent?: string;
    proposedSummary?: string;
    proposedDefinition?: string;
    proposedPraxis?: string;
    proposedRisiken?: string;
    proposedQuellen?: string;
    editedDefinition?: string;
    editedPraxis?: string;
    editedRisiken?: string;
    editedQuellen?: string;
    selectedSections?: string[];
    correctionReason?: string;
  };
};

const SECTIONS: SubmissionSection[] = ['definition', 'praxis', 'risiken', 'quellen'];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractValues(raw: Record<string, string>, selectedSections: string[]): SubmitState['values'] {
  return {
    type: raw.type,
    submitterName: raw.submitterName,
    submitterEmail: raw.submitterEmail,
    relatedArticleSlug: raw.relatedArticleSlug,
    proposedTitle: raw.proposedTitle,
    proposedIntent: raw.proposedIntent,
    proposedSummary: raw.proposedSummary,
    proposedDefinition: raw.proposedDefinition,
    proposedPraxis: raw.proposedPraxis,
    proposedRisiken: raw.proposedRisiken,
    proposedQuellen: raw.proposedQuellen,
    editedDefinition: raw.editedDefinition,
    editedPraxis: raw.editedPraxis,
    editedRisiken: raw.editedRisiken,
    editedQuellen: raw.editedQuellen,
    selectedSections,
    correctionReason: raw.correctionReason,
  };
}

function sanitizeLexicalString(json: string | undefined): unknown | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json);
    return sanitizeLexicalRoot(parsed);
  } catch {
    return undefined;
  }
}

export async function submitAction(
  _prevState: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).filter(([k]) => k !== 'selectedSections'),
  ) as Record<string, string>;
  const selectedSections = formData.getAll('selectedSections').map((v) => String(v));

  const parseInput = { ...raw, selectedSections };
  const parsed = SubmissionSchema.safeParse(parseInput);

  if (!parsed.success) {
    return { fieldErrors: flattenZodErrors(parsed.error), values: extractValues(raw, selectedSections) };
  }

  const verified = await verifyTurnstileToken(parsed.data.turnstileToken);
  if (!verified) {
    return {
      error: 'Captcha-Verifikation fehlgeschlagen. Bitte erneut versuchen.',
      values: extractValues(raw, selectedSections),
    };
  }

  const payload = await getPayloadClient();
  const adminUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000';

  let articleTitle: string | undefined;
  let articleId: number | undefined;

  if (parsed.data.type === 'correction') {
    const found = await payload.find({
      collection: 'articles',
      where: { slug: { equals: parsed.data.relatedArticleSlug } },
      limit: 1,
    });
    if (!found.docs || found.docs.length === 0) {
      return {
        fieldErrors: { relatedArticleSlug: 'Artikel nicht gefunden.' },
        values: extractValues(raw, selectedSections),
      };
    }
    const article = found.docs[0] as unknown as Record<string, unknown>;
    articleId = article.id as number;
    articleTitle = article.title as string;

    // Dirty-Check pro gewählter Sektion
    const fieldErrors: Record<string, string> = {};
    for (const section of parsed.data.selectedSections) {
      const editedKey = `edited${capitalize(section)}` as keyof typeof parsed.data;
      const editedRaw = parsed.data[editedKey] as string | undefined;
      if (!editedRaw) continue;
      let editedParsed: unknown;
      try {
        editedParsed = JSON.parse(editedRaw);
      } catch {
        fieldErrors[`edited${capitalize(section)}`] = 'Ungültiger Editor-Inhalt.';
        continue;
      }
      const original = article[section];
      if (!isLexicalDirty(editedParsed as Parameters<typeof isLexicalDirty>[0], original as Parameters<typeof isLexicalDirty>[1])) {
        fieldErrors[`edited${capitalize(section)}`] =
          'Keine Änderungen — bitte editieren oder Sektion abwählen.';
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors, values: extractValues(raw, selectedSections) };
    }
  }

  // Sanitize all Lexical-JSON fields
  const sanitizedData: Record<string, unknown> = { type: parsed.data.type };
  if (parsed.data.type === 'new_article') {
    sanitizedData.proposedTitle = parsed.data.proposedTitle;
    if (parsed.data.proposedIntent) sanitizedData.proposedIntent = parsed.data.proposedIntent;
    if (parsed.data.proposedSummary) sanitizedData.proposedSummary = parsed.data.proposedSummary;
    for (const section of SECTIONS) {
      const key = `proposed${capitalize(section)}` as keyof typeof parsed.data;
      const sanitized = sanitizeLexicalString(parsed.data[key] as string);
      if (sanitized) sanitizedData[key] = sanitized;
    }
  } else {
    sanitizedData.relatedArticle = articleId;
    if (parsed.data.correctionReason) sanitizedData.correctionReason = parsed.data.correctionReason;
    for (const section of parsed.data.selectedSections) {
      const key = `edited${capitalize(section)}` as keyof typeof parsed.data;
      const sanitized = sanitizeLexicalString(parsed.data[key] as string);
      if (sanitized) sanitizedData[key] = sanitized;
    }
  }
  if (parsed.data.submitterName) sanitizedData.submitterName = parsed.data.submitterName;
  if (parsed.data.submitterEmail) sanitizedData.submitterEmail = parsed.data.submitterEmail;
  sanitizedData.reviewStatus = 'pending';

  let submission;
  try {
    submission = await payload.create({
      collection: 'submissions',
      // Sanitized data is dynamically composed; Payload's generic create<>
      // expects a precise Submission shape we don't easily satisfy here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: sanitizedData as any,
    });
  } catch (err) {
    console.error('Submission create failed', err);
    return {
      error: 'Es gab ein Problem beim Senden. Bitte später erneut versuchen.',
      values: extractValues(raw, selectedSections),
    };
  }

  try {
    const submissionForMail: SubmissionMailInput =
      parsed.data.type === 'new_article'
        ? {
            id: String(submission.id),
            type: 'new_article',
            proposedTitle: parsed.data.proposedTitle,
            proposedIntent: parsed.data.proposedIntent,
            proposedSummary: parsed.data.proposedSummary,
            proposedDefinition: parsed.data.proposedDefinition,
            proposedPraxis: parsed.data.proposedPraxis,
            proposedRisiken: parsed.data.proposedRisiken,
            proposedQuellen: parsed.data.proposedQuellen,
            submitterName: parsed.data.submitterName,
            submitterEmail: parsed.data.submitterEmail || undefined,
            createdAt: String(submission.createdAt),
          }
        : {
            id: String(submission.id),
            type: 'correction',
            selectedSections: parsed.data.selectedSections,
            editedDefinition: parsed.data.editedDefinition,
            editedPraxis: parsed.data.editedPraxis,
            editedRisiken: parsed.data.editedRisiken,
            editedQuellen: parsed.data.editedQuellen,
            correctionReason: parsed.data.correctionReason,
            submitterName: parsed.data.submitterName,
            submitterEmail: parsed.data.submitterEmail || undefined,
            createdAt: String(submission.createdAt),
          };

    const mail = buildSubmissionMail({
      submission: submissionForMail,
      articleTitle,
      articleId,
      adminUrl,
    });
    await payload.sendEmail(mail);
  } catch (err) {
    console.error('Submission mail failed (non-fatal)', err);
  }

  redirect('/einreichen/danke');
}
