import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';
import { MINIMAL_PNG } from '../helpers/avatar-fixture';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('avatar-upload backend', () => {
  it('resizes purpose=avatar upload to 256×256 JPEG via Sharp-Hook', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const created = await payload.create({
      collection: 'media',
      data: {
        alt: 'Test',
        purpose: 'avatar',
        uploadedBy: user.id,
      } as never,
      file: {
        data: MINIMAL_PNG,
        mimetype: 'image/png',
        name: `t-${Date.now()}.png`,
        size: MINIMAL_PNG.length,
      },
    });

    const doc = created as { id: number; width?: number; height?: number; mimeType?: string };
    expect(doc.width).toBe(256);
    expect(doc.height).toBe(256);
    expect(doc.mimeType).toBe('image/jpeg');
  });

  it('does NOT resize when purpose=article_image (only avatar gets resized)', async () => {
    const user = await createUserFixture(payload, 'editor');
    const created = await payload.create({
      collection: 'media',
      data: {
        alt: 'Article test',
        purpose: 'article_image',
        uploadedBy: user.id,
      } as never,
      file: {
        data: MINIMAL_PNG,
        mimetype: 'image/png',
        name: `art-${Date.now()}.png`,
        size: MINIMAL_PNG.length,
      },
    });

    const doc = created as { id: number; width?: number; height?: number; mimeType?: string };
    expect(doc.width).toBe(1);
    expect(doc.height).toBe(1);
    expect(doc.mimeType).toBe('image/png');
  });
});
