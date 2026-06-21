import { describe, it, expect, beforeAll } from 'vitest';
import 'dotenv/config';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('claim mechanics — last-write-wins', () => {
  it('two simultaneous claims on the same article: last write wins', async () => {
    const r1 = await createUserFixture(payload, 'reviewer');
    const r2 = await createUserFixture(payload, 'reviewer');
    const article = await payload.create({
      collection: 'articles',
      data: {
        title: `Race ${Date.now()}`,
        slug: `race-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        intent: 'background',
        summary: 's',
        definition: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'd' }] }] } },
        praxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'p' }] }] } },
        risiken: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'r' }] }] } },
        quellen: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'q' }] }] } },
        status: 'draft',
      } as never,
    });

    await Promise.all([
      payload.update({
        collection: 'articles',
        id: article.id,
        data: { status: 'in_review' } as never,
        overrideAccess: false,
        user: r1 as never,
      }),
      payload.update({
        collection: 'articles',
        id: article.id,
        data: { status: 'in_review' } as never,
        overrideAccess: false,
        user: r2 as never,
      }),
    ]);

    const final = await payload.findByID({ collection: 'articles', id: article.id });
    const reviewer = (final as { currentReviewer?: number | { id: number } }).currentReviewer;
    const reviewerId =
      typeof reviewer === 'object' && reviewer ? reviewer.id : reviewer;
    expect([r1.id, r2.id]).toContain(reviewerId);
  });
});
