import { describe, it, expect, beforeAll } from 'vitest';
import 'dotenv/config';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('submission auto-attribution', () => {
  it('auto-fills submittedBy when req.user is present', async () => {
    const contributor = await createUserFixture(payload, 'contributor');
    const created = await payload.create({
      collection: 'submissions',
      data: {
        type: 'new_article',
        proposedTitle: 'Auto-attribution Test',
      } as never,
      overrideAccess: false,
      user: contributor as never,
    });
    const submittedBy = (created as { submittedBy?: number | { id: number } | null }).submittedBy;
    const id = typeof submittedBy === 'object' && submittedBy ? submittedBy.id : submittedBy;
    expect(id).toBe(contributor.id);
  });

  it('leaves submittedBy null for anonymous submissions', async () => {
    const created = await payload.create({
      collection: 'submissions',
      data: {
        type: 'new_article',
        proposedTitle: 'Anonymous Test',
      } as never,
    });
    expect((created as { submittedBy?: unknown }).submittedBy).toBeFalsy();
  });
});
