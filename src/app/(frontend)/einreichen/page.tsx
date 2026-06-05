import type { Metadata } from 'next';
import { SectionLabel } from '@/components/SectionLabel';
import { SubmissionForm } from '@/components/SubmissionForm';
import { getPayloadClient } from '@/lib/payload';

export const metadata: Metadata = {
  title: 'Mitmachen – PflegeAtlas',
  description: 'Reiche einen neuen Artikel oder eine Korrektur ein.',
};

type SearchParams = { type?: 'correction' | 'new_article'; article?: string };

export default async function EinreichenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const initialType: 'correction' | 'new_article' =
    params.type === 'correction' ? 'correction' : 'new_article';
  const initialArticleSlug = params.article || '';

  const payload = await getPayloadClient();
  const articles = await payload.find({
    collection: 'articles',
    sort: '-updatedAt',
    limit: 50,
    select: { slug: true, title: true },
  });

  const articleOptions = articles.docs.map((a: { slug: string; title: string }) => ({
    slug: a.slug,
    title: a.title,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <SectionLabel className="mb-3">Mitmachen</SectionLabel>
      <h1 className="mb-6 font-serif text-3xl font-semibold leading-tight text-ink">
        Teile dein Pflege-Wissen
      </h1>
      <p className="mb-10 text-lg text-ink-muted">
        Alle Inhalte stehen unter <a
          href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
          className="text-brand underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >CC BY-SA 4.0</a>. Mit dem Einreichen erklärst du dich mit dieser Lizenz einverstanden.
      </p>

      <SubmissionForm
        articles={articleOptions}
        turnstileSiteKey={process.env.TURNSTILE_SITE_KEY ?? ''}
        initialType={initialType}
        initialArticleSlug={initialArticleSlug}
      />
    </div>
  );
}
