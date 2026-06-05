'use server';

import { redirect } from 'next/navigation';
import { SubmissionSchema, flattenZodErrors } from '@/lib/submission-schema';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { buildSubmissionMail } from '@/lib/submission-mail';
import { getPayloadClient } from '@/lib/payload';

export type SubmitState = {
  fieldErrors?: Record<string, string>;
  error?: string;
};

export async function submitAction(
  _prevState: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = SubmissionSchema.safeParse(raw);

  if (!parsed.success) {
    return { fieldErrors: flattenZodErrors(parsed.error) };
  }

  const verified = await verifyTurnstileToken(parsed.data.turnstileToken);
  if (!verified) {
    return { error: 'Captcha-Verifikation fehlgeschlagen. Bitte erneut versuchen.' };
  }

  const payload = await getPayloadClient();

  let relatedArticleId: number | undefined;
  let relatedArticleTitle: string | undefined;
  if (parsed.data.type === 'correction' && parsed.data.relatedArticleSlug) {
    const found = await payload.find({
      collection: 'articles',
      where: { slug: { equals: parsed.data.relatedArticleSlug } },
      limit: 1,
    });
    if (!found.docs || found.docs.length === 0) {
      return { fieldErrors: { relatedArticleSlug: 'Artikel nicht gefunden.' } };
    }
    relatedArticleId = found.docs[0].id;
    relatedArticleTitle = (found.docs[0] as { title?: string }).title;
  }

  let submission;
  try {
    submission = await payload.create({
      collection: 'submissions',
      data: {
        type: parsed.data.type,
        subject: parsed.data.subject,
        body: parsed.data.body,
        relatedArticle: relatedArticleId,
        submitterName: parsed.data.submitterName || undefined,
        submitterEmail: parsed.data.submitterEmail || undefined,
        reviewStatus: 'pending',
      },
    });
  } catch (err) {
    console.error('Submission create failed', err);
    return { error: 'Es gab ein Problem beim Senden. Bitte später erneut versuchen.' };
  }

  try {
    const mail = buildSubmissionMail({
      submission: {
        id: String(submission.id),
        type: parsed.data.type,
        subject: parsed.data.subject,
        body: parsed.data.body,
        submitterName: parsed.data.submitterName || undefined,
        submitterEmail: parsed.data.submitterEmail || undefined,
        createdAt: String(submission.createdAt),
      },
      articleTitle: relatedArticleTitle,
    });
    await payload.sendEmail(mail);
  } catch (err) {
    console.error('Submission mail failed (non-fatal)', err);
  }

  redirect('/einreichen/danke');
}
