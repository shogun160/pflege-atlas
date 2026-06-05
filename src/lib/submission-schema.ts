import { z, ZodError } from 'zod';

export const SubmissionSchema = z
  .object({
    type: z.enum(['new_article', 'correction']),
    subject: z.string().trim().min(3, 'Bitte mindestens 3 Zeichen.').max(200, 'Maximal 200 Zeichen.'),
    relatedArticleSlug: z.string().trim().optional(),
    body: z.string().trim().min(20, 'Bitte mindestens 20 Zeichen.').max(20000, 'Maximal 20000 Zeichen.'),
    submitterName: z.string().trim().max(100, 'Maximal 100 Zeichen.').optional(),
    submitterEmail: z
      .string()
      .trim()
      .email('Keine gültige E-Mail-Adresse.')
      .optional()
      .or(z.literal('')),
    turnstileToken: z.string().min(1, 'Captcha-Token fehlt.'),
  })
  .refine(
    (data) =>
      data.type !== 'correction' ||
      (typeof data.relatedArticleSlug === 'string' && data.relatedArticleSlug.length > 0),
    {
      path: ['relatedArticleSlug'],
      message: 'Bei Korrektur ist der bezogene Artikel Pflicht.',
    },
  );

export type SubmissionInput = z.infer<typeof SubmissionSchema>;

export function flattenZodErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? '_root';
    if (!out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}
