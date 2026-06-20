type Lexical = unknown;

type NewArticleSub = {
  type: 'new_article';
  proposedTitle: string;
  proposedIntent?: 'bedside' | 'background' | 'learning';
  proposedSummary?: string;
  proposedSlug: string;
  proposedDefinition: Lexical;
  proposedPraxis: Lexical;
  proposedRisiken: Lexical;
  proposedQuellen: Lexical;
};

type CorrectionSub = {
  type: 'correction';
  editedDefinition?: Lexical;
  editedPraxis?: Lexical;
  editedRisiken?: Lexical;
  editedQuellen?: Lexical;
};

type ArticleInput = {
  id: number;
  slug: string;
  title: string;
  intent: string;
  summary: string;
  definition: Lexical;
  praxis: Lexical;
  risiken: Lexical;
  quellen: Lexical;
};

export type ApplyResult = {
  mode: 'create' | 'update';
  slug: string;
  patch: Record<string, unknown>;
};

function isEmpty(value: Lexical): boolean {
  if (!value) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

export function applySubmissionToArticle(
  sub: NewArticleSub | CorrectionSub,
  article: ArticleInput | null,
): ApplyResult {
  if (sub.type === 'new_article') {
    return {
      mode: 'create',
      slug: sub.proposedSlug,
      patch: {
        title: sub.proposedTitle,
        slug: sub.proposedSlug,
        intent: sub.proposedIntent ?? 'background',
        summary: sub.proposedSummary ?? '',
        definition: sub.proposedDefinition,
        praxis: sub.proposedPraxis,
        risiken: sub.proposedRisiken,
        quellen: sub.proposedQuellen,
        status: 'published',
      },
    };
  }

  if (!article) {
    throw new Error('Correction submission requires an existing article');
  }

  const patch: Record<string, unknown> = {};
  if (!isEmpty(sub.editedDefinition)) patch.definition = sub.editedDefinition;
  if (!isEmpty(sub.editedPraxis)) patch.praxis = sub.editedPraxis;
  if (!isEmpty(sub.editedRisiken)) patch.risiken = sub.editedRisiken;
  if (!isEmpty(sub.editedQuellen)) patch.quellen = sub.editedQuellen;

  return { mode: 'update', slug: article.slug, patch };
}
