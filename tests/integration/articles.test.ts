import { describe, it, expect, beforeAll } from 'vitest';
import 'dotenv/config';
import { getPayload } from 'payload';
import config from '@/payload.config';

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
});
