import { z, ZodError } from 'zod';
import { unwrapLexicalRoot } from './lexical-unwrap';

const Section = z.enum(['definition', 'praxis', 'risiken', 'quellen']);
export type SubmissionSection = z.infer<typeof Section>;

const LexicalJsonString = z
  .string()
  .min(1, 'Inhalt fehlt.')
  .refine(
    (s) => {
      try {
        return unwrapLexicalRoot(JSON.parse(s)) !== null;
      } catch {
        return false;
      }
    },
    { message: 'Ungültiger Editor-Inhalt.' },
  );

const CommonFields = {
  submitterName: z.string().trim().max(100, 'Maximal 100 Zeichen.').optional(),
  submitterEmail: z
    .string()
    .trim()
    .email('Keine gültige E-Mail-Adresse.')
    .optional()
    .or(z.literal('')),
  turnstileToken: z.string().min(1, 'Captcha-Token fehlt.'),
};

const NewArticleSchema = z.object({
  type: z.literal('new_article'),
  proposedTitle: z
    .string()
    .trim()
    .min(3, 'Bitte mindestens 3 Zeichen.')
    .max(200, 'Maximal 200 Zeichen.'),
  proposedIntent: z.enum(['bedside', 'background', 'learning']).optional(),
  proposedSummary: z
    .string()
    .trim()
    .max(280, 'Maximal 280 Zeichen.')
    .optional()
    .or(z.literal('')),
  proposedDefinition: LexicalJsonString,
  proposedPraxis: LexicalJsonString,
  proposedRisiken: LexicalJsonString,
  proposedQuellen: LexicalJsonString,
  ...CommonFields,
});

const CorrectionSchema = z
  .object({
    type: z.literal('correction'),
    relatedArticleSlug: z.string().trim().min(1, 'Artikel auswählen.'),
    selectedSections: z.array(Section).min(1, 'Mindestens eine Sektion auswählen.'),
    editedDefinition: LexicalJsonString.optional(),
    editedPraxis: LexicalJsonString.optional(),
    editedRisiken: LexicalJsonString.optional(),
    editedQuellen: LexicalJsonString.optional(),
    correctionReason: z.string().trim().max(2000, 'Maximal 2000 Zeichen.').optional(),
    ...CommonFields,
  })
  .refine(
    (data) =>
      data.selectedSections.every((s) => {
        const key = `edited${s.charAt(0).toUpperCase()}${s.slice(1)}` as keyof typeof data;
        return typeof data[key] === 'string' && (data[key] as string).length > 0;
      }),
    {
      path: ['selectedSections'],
      message: 'Editor-Inhalt fehlt für eine ausgewählte Sektion.',
    },
  );

export const SubmissionSchema = z.discriminatedUnion('type', [NewArticleSchema, CorrectionSchema]);

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
