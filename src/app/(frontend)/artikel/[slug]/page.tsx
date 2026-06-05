import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RichText } from '@payloadcms/richtext-lexical/react';
import { getPayloadClient } from '@/lib/payload';
import { buildMedicalArticleJsonLd } from '@/lib/schema-org';
import { ArticleLayout } from '@/components/ArticleLayout';
import { ArticleTOC } from '@/components/ArticleTOC';
import { ArticleDisclaimer } from '@/components/ArticleDisclaimer';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'articles',
    where: { and: [{ slug: { equals: slug } }, { status: { equals: 'published' } }] },
    limit: 1,
    depth: 0,
  });
  const article = result.docs[0];
  if (!article) return { title: 'Nicht gefunden' };
  return {
    title: `${article.title} – PflegeAtlas`,
    description: article.summary,
    openGraph: {
      title: article.title,
      description: article.summary,
      type: 'article',
      locale: 'de_DE',
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const payload = await getPayloadClient();

  const result = await payload.find({
    collection: 'articles',
    where: { and: [{ slug: { equals: slug } }, { status: { equals: 'published' } }] },
    limit: 1,
    depth: 2,
  });

  const article = result.docs[0];
  if (!article) notFound();

  const sections = [
    { id: 'definition', label: 'Definition' },
    { id: 'praxis', label: 'Praxis' },
    { id: 'risiken', label: 'Risiken & Fallstricke' },
    { id: 'quellen', label: 'Quellen' },
  ];

  const reviewedAt = article.lastReviewedAt
    ? new Date(article.lastReviewedAt).toLocaleDateString('de-DE')
    : undefined;
  const reviewerNames = Array.isArray(article.reviewedBy)
    ? article.reviewedBy
        .map((r: any) => (typeof r === 'object' ? r.displayName : null))
        .filter(Boolean)
        .join(', ')
    : undefined;

  return (
    <ArticleLayout
      toc={
        <ArticleTOC
          sections={sections}
          reviewedAt={reviewedAt}
          reviewerName={reviewerNames}
        />
      }
    >
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-gray-500">
          {article.intent === 'bedside' && 'Schnelle Hilfe am Bett'}
          {article.intent === 'background' && 'Hintergrundwissen'}
          {article.intent === 'learning' && 'Lernen'}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">{article.title}</h1>
        <p className="mt-2 text-gray-600">{article.summary}</p>
      </header>

      {(() => {
        const authors = (Array.isArray(article.authors) ? article.authors : [])
          .map((a: any) => (typeof a === 'object' ? a.displayName : null))
          .filter(Boolean) as string[];
        const json = buildMedicalArticleJsonLd({
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          authors,
          datePublished: (article.createdAt as any) instanceof Date
            ? (article.createdAt as unknown as Date).toISOString()
            : article.createdAt,
          dateModified: (article.updatedAt as any) instanceof Date
            ? (article.updatedAt as unknown as Date).toISOString()
            : article.updatedAt,
          siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
        });
        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, '\\u003c') }}
          />
        );
      })()}

      <ArticleDisclaimer />

      <section id="definition" className="mb-8">
        <h2 className="text-xl font-semibold">1. Definition</h2>
        <RichText data={article.definition as any} />
      </section>

      <section id="praxis" className="mb-8">
        <h2 className="text-xl font-semibold">2. Praxis</h2>
        <RichText data={article.praxis as any} />
      </section>

      <section id="risiken" className="mb-8">
        <h2 className="text-xl font-semibold">3. Risiken &amp; Fallstricke</h2>
        <RichText data={article.risiken as any} />
      </section>

      <section id="quellen" className="mb-8">
        <h2 className="text-xl font-semibold">4. Quellen &amp; Weiterführendes</h2>
        <RichText data={article.quellen as any} />
      </section>

      <footer className="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-600">
        <a href="#" className="underline">
          Korrektur vorschlagen
        </a>{' '}
        ·{' '}
        <a href="#" className="underline">
          Neuen Artikel zu verwandtem Thema schreiben
        </a>
      </footer>
    </ArticleLayout>
  );
}
