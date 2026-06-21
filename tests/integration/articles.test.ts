import { describe, it, expect, beforeAll, vi } from 'vitest';
import 'dotenv/config';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { upsertArticleMarkdown } from '@/lib/github-article-sync';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

/**
 * Minimal but complete Lexical editor state that passes Payload's validator.
 * All required fields (version, type, direction, format, indent, mode, detail,
 * style, text) are present so Lexical does not reject the state.
 */
function makeLexicalDoc(text: string) {
  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      children: [
        {
          type: 'paragraph',
          version: 1,
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          textFormat: 0,
          textStyle: '',
          children: [
            {
              type: 'text',
              version: 1,
              detail: 0,
              format: 0,
              mode: 'normal' as const,
              style: '',
              text,
            },
          ],
        },
      ],
    },
  };
}

describe('Articles Collection', () => {
  it('legt einen Artikel an und liest ihn über den Slug', async () => {
    // Use a timestamp-based title so re-runs don't collide on the unique slug
    const ts = Date.now();
    const title = `Test-Dekubitus-${ts}`;
    const expectedSlug = `test-dekubitus-${ts}`;

    const user = await payload.create({
      collection: 'users',
      data: {
        email: `test-${ts}@example.com`,
        password: 'test-pw-12345!',
        displayName: 'Test Autor',
        role: 'editor',
      },
    });

    const created = await payload.create({
      collection: 'articles',
      data: {
        title,
        intent: 'bedside',
        summary: 'Kurzbeschreibung für Test',
        definition: makeLexicalDoc('def') as any,
        praxis: makeLexicalDoc('pr') as any,
        risiken: makeLexicalDoc('ri') as any,
        quellen: makeLexicalDoc('qu') as any,
        authors: [user.id],
        status: 'published',
      },
    });

    expect(created.slug).toBe(expectedSlug);

    const found = await payload.find({
      collection: 'articles',
      where: { slug: { equals: expectedSlug } },
      limit: 1,
    });

    expect(found.docs.length).toBe(1);
    expect(found.docs[0]!.title).toBe(title);
  });

  // Regression: V1.5-Hook hat 2026-06-20 zwei echte Bot-Commits ins
  // main produziert (838284a, 5749a2d), weil dieser Test mit echten
  // GITHUB_APP_*-Credentials aus .env läuft. `tests/setup.node.ts`
  // mockt den GitHub-Layer global — hier prüfen wir den Mock.
  it('feuert den V1.5-Hook, ohne echtes Markdown ins Repo zu pushen', async () => {
    const ts = Date.now();
    const title = `Test-Dekubitus-${ts}`;
    const expectedSlug = `test-dekubitus-${ts}`;

    const user = await payload.create({
      collection: 'users',
      data: {
        email: `test-${ts}@example.com`,
        password: 'test-pw-12345!',
        displayName: 'Test Autor',
        role: 'editor',
      },
    });

    vi.mocked(upsertArticleMarkdown).mockClear();

    await payload.create({
      collection: 'articles',
      data: {
        title,
        intent: 'bedside',
        summary: 'Hook-Push-Regression',
        definition: makeLexicalDoc('def') as any,
        praxis: makeLexicalDoc('pr') as any,
        risiken: makeLexicalDoc('ri') as any,
        quellen: makeLexicalDoc('qu') as any,
        authors: [user.id],
        status: 'published',
      },
    });

    expect(vi.mocked(upsertArticleMarkdown)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(upsertArticleMarkdown).mock.calls[0]!;
    expect(call[1]).toMatchObject({ slug: expectedSlug });
  });

  it('Reader-Access: unauthenticated find sieht nur status=published', async () => {
    const ts = Date.now();
    const draftSlug = `reader-access-draft-${ts}`;
    const publishedSlug = `reader-access-pub-${ts}`;

    const user = await payload.create({
      collection: 'users',
      data: {
        email: `reader-access-${ts}@example.com`,
        password: 'test-pw-12345!',
        displayName: 'Test Autor',
        role: 'editor',
      },
    });

    await payload.create({
      collection: 'articles',
      data: {
        title: `Reader-Access-Draft-${ts}`,
        slug: draftSlug,
        intent: 'bedside',
        summary: 'draft',
        definition: makeLexicalDoc('d') as any,
        praxis: makeLexicalDoc('d') as any,
        risiken: makeLexicalDoc('d') as any,
        quellen: makeLexicalDoc('d') as any,
        authors: [user.id],
        status: 'draft',
      },
    });

    await payload.create({
      collection: 'articles',
      data: {
        title: `Reader-Access-Pub-${ts}`,
        slug: publishedSlug,
        intent: 'bedside',
        summary: 'pub',
        definition: makeLexicalDoc('p') as any,
        praxis: makeLexicalDoc('p') as any,
        risiken: makeLexicalDoc('p') as any,
        quellen: makeLexicalDoc('p') as any,
        authors: [user.id],
        status: 'published',
      },
    });

    const anonResult = await payload.find({
      collection: 'articles',
      where: { slug: { in: [draftSlug, publishedSlug] } },
      overrideAccess: false,
    });

    const slugs = anonResult.docs.map((d) => d.slug);
    expect(slugs).toContain(publishedSlug);
    expect(slugs).not.toContain(draftSlug);
  });

  it('akzeptiert status=in_review und status=archived (post enum extend)', async () => {
    const ts = Date.now();
    const inReviewSlug = `enum-in-review-${ts}`;
    const archivedSlug = `enum-archived-${ts}`;

    const user = await payload.create({
      collection: 'users',
      data: {
        email: `enum-extend-${ts}@example.com`,
        password: 'test-pw-12345!',
        displayName: 'Test Autor',
        role: 'editor',
      },
    });

    const inReviewArticle = await payload.create({
      collection: 'articles',
      data: {
        title: `Enum-In-Review-${ts}`,
        slug: inReviewSlug,
        intent: 'bedside',
        summary: 'in_review',
        definition: makeLexicalDoc('d') as any,
        praxis: makeLexicalDoc('d') as any,
        risiken: makeLexicalDoc('d') as any,
        quellen: makeLexicalDoc('d') as any,
        authors: [user.id],
        status: 'in_review',
      },
    });

    expect(inReviewArticle.status).toBe('in_review');

    const updated = await payload.update({
      collection: 'articles',
      id: inReviewArticle.id,
      data: { status: 'archived', slug: archivedSlug },
    });

    expect(updated.status).toBe('archived');

    const anonResult = await payload.find({
      collection: 'articles',
      where: { slug: { in: [inReviewSlug, archivedSlug] } },
      overrideAccess: false,
    });

    expect(anonResult.docs.map((d) => d.slug)).toEqual([]);
  });
});
