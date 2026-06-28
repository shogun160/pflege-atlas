import type { Payload } from 'payload';

// Minimal valid 1x1 RGB PNG (70 bytes). Payload's upload pipeline uses
// `image-size` which validates the IHDR chunk, so an 8-byte signature
// alone is rejected as "Invalid PNG". Generated once and inlined to keep
// the fixture deterministic & dependency-free.
export const MINIMAL_PNG = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
  0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 13, 73, 68, 65, 84, 120,
  156, 99, 248, 255, 255, 63, 3, 0, 8, 252, 2, 254, 167, 154, 160, 160, 0, 0,
  0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

export async function createAvatarFixture(
  payload: Payload,
  userId: number,
): Promise<{ id: number }> {
  const created = await payload.create({
    collection: 'media',
    data: {
      alt: 'Test avatar',
      purpose: 'avatar',
      uploadedBy: userId,
    } as never,
    file: {
      data: MINIMAL_PNG,
      mimetype: 'image/png',
      name: `avatar-${userId}-${Date.now()}.png`,
      size: MINIMAL_PNG.length,
    },
  });
  return { id: created.id as number };
}
