export type MedicalArticleInput = {
  title: string;
  slug: string;
  summary: string;
  authors: string[];
  datePublished: string;
  dateModified?: string;
  siteUrl: string;
};

export function buildMedicalArticleJsonLd(input: MedicalArticleInput) {
  const url = `${input.siteUrl.replace(/\/$/, '')}/artikel/${input.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    headline: input.title,
    description: input.summary,
    url,
    author: input.authors.map((name) => ({ '@type': 'Person' as const, name })),
    datePublished: input.datePublished,
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    license: 'https://creativecommons.org/licenses/by-sa/4.0/',
    inLanguage: 'de',
  };
}
