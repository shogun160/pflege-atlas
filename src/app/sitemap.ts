import type { MetadataRoute } from 'next';
import { getPayloadClient } from '@/lib/payload';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'articles',
    where: { status: { equals: 'published' } },
    limit: 2000,
    depth: 0,
  });

  const articleEntries = result.docs.map((doc) => ({
    url: `${base}/artikel/${doc.slug}`,
    lastModified: new Date(doc.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const staticEntries = [
    { url: base, changeFrequency: 'daily' as const, priority: 1 },
    { url: `${base}/index`, changeFrequency: 'weekly' as const, priority: 0.6 },
  ];

  return [...staticEntries, ...articleEntries];
}
