import { getPayloadClient } from '@/lib/payload';

export const dynamic = 'force-dynamic';

export default async function IndexPage() {
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'articles',
    where: { status: { equals: 'published' } },
    limit: 500,
    sort: 'title',
    depth: 0,
  });

  const grouped = new Map<string, typeof result.docs>();
  for (const doc of result.docs) {
    const letter = doc.title.charAt(0).toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';
    const arr = grouped.get(key) ?? [];
    arr.push(doc);
    grouped.set(key, arr);
  }

  const letters = Array.from(grouped.keys()).sort();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">Alle Artikel A–Z</h1>

      <nav aria-label="A–Z" className="mb-10 flex flex-wrap gap-2">
        {letters.map((l) => (
          <a key={l} href={`#${l}`} className="rounded bg-gray-100 px-3 py-1 text-sm">
            {l}
          </a>
        ))}
      </nav>

      {letters.map((letter) => (
        <section key={letter} id={letter} className="mb-10">
          <h2 className="mb-3 text-xl font-bold text-gray-900">{letter}</h2>
          <ul className="space-y-2">
            {grouped.get(letter)!.map((doc) => (
              <li key={doc.id}>
                <a href={`/artikel/${doc.slug}`} className="text-blue-700 hover:underline">
                  {doc.title}
                </a>
                <span className="ml-2 text-sm text-gray-600">{doc.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
