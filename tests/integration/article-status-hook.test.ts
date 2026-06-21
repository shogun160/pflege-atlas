import { describe, it, expect, beforeAll } from 'vitest';
import 'dotenv/config';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;
let editor: { id: number };
let reviewer: { id: number };

beforeAll(async () => {
  payload = await getPayload({ config });
  editor = await createUserFixture(payload, 'editor');
  reviewer = await createUserFixture(payload, 'reviewer');
});

async function makeArticle(initialStatus: string = 'draft') {
  return await payload.create({
    collection: 'articles',
    data: {
      title: `Test ${Date.now()}-${Math.random()}`,
      slug: `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      intent: 'background',
      summary: 'test summary',
      definition: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'd' }] }] } },
      praxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'p' }] }] } },
      risiken: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'r' }] }] } },
      quellen: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'q' }] }] } },
      status: initialStatus,
    } as never,
  });
}

describe('article status transitions', () => {
  it('reviewer cannot transition draft → published', async () => {
    const article = await makeArticle('draft');
    await expect(
      payload.update({
        collection: 'articles',
        id: article.id,
        data: { status: 'published' } as never,
        overrideAccess: false,
        user: reviewer as never,
      }),
    ).rejects.toThrow(/permission|forbidden|verboten/i);
  });

  it('editor can transition draft → in_review → ready_to_publish → published', async () => {
    const article = await makeArticle('draft');
    let updated = await payload.update({
      collection: 'articles', id: article.id,
      data: { status: 'in_review' } as never,
      overrideAccess: false, user: editor as never,
    });
    expect((updated as { status: string }).status).toBe('in_review');

    updated = await payload.update({
      collection: 'articles', id: article.id,
      data: { status: 'ready_to_publish' } as never,
      overrideAccess: false, user: editor as never,
    });
    expect((updated as { status: string }).status).toBe('ready_to_publish');

    updated = await payload.update({
      collection: 'articles', id: article.id,
      data: { status: 'published' } as never,
      overrideAccess: false, user: editor as never,
    });
    expect((updated as { status: string }).status).toBe('published');
  });

  it('claim: status → in_review sets currentReviewer = req.user', async () => {
    const article = await makeArticle('draft');
    const updated = await payload.update({
      collection: 'articles', id: article.id,
      data: { status: 'in_review' } as never,
      overrideAccess: false, user: reviewer as never,
    });
    const currentReviewer = (updated as { currentReviewer?: number | { id: number } }).currentReviewer;
    const reviewerId = typeof currentReviewer === 'object' ? currentReviewer?.id : currentReviewer;
    expect(reviewerId).toBe(reviewer.id);
  });

  it('claim: status → published clears currentReviewer + appends to reviewedBy', async () => {
    const article = await payload.create({
      collection: 'articles',
      data: {
        title: `Test ${Date.now()}-c`,
        slug: `test-${Date.now()}-c`,
        intent: 'background',
        summary: 'x',
        definition: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'd' }] }] } },
        praxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'p' }] }] } },
        risiken: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'r' }] }] } },
        quellen: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'q' }] }] } },
        status: 'in_review',
        currentReviewer: reviewer.id,
      } as never,
    });
    const updated = await payload.update({
      collection: 'articles', id: article.id,
      data: { status: 'published' } as never,
      overrideAccess: false, user: editor as never,
    });
    expect((updated as { currentReviewer?: unknown }).currentReviewer).toBeFalsy();
    const reviewedBy = (updated as { reviewedBy?: Array<number | { id: number }> }).reviewedBy ?? [];
    const ids = reviewedBy.map((r) => typeof r === 'object' ? r.id : r);
    expect(ids).toContain(reviewer.id);
  });
});
