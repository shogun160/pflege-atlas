import type { Payload } from 'payload';
import { hardDeleteAvatar } from './avatar-cleanup';

/**
 * V1.6.1 — räumt orphan avatar-media auf. Two-Step-Upload-UX kann
 * Avatar-Media in R2 ablegen, die nie an einen User attached wurden
 * (User upload't, schließt Tab, vergisst „Speichern"). Cron sweep'd
 * sie nach 24h Grace-Period.
 */
const GRACE_PERIOD_HOURS = 24;

export async function cleanupOrphanAvatars(payload: Payload): Promise<number> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_HOURS * 60 * 60 * 1000).toISOString();
  const candidates = await payload.find({
    collection: 'media',
    where: {
      and: [
        { purpose: { equals: 'avatar' } },
        { createdAt: { less_than: cutoff } },
      ],
    },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  });

  let deletedCount = 0;
  for (const candidate of candidates.docs as Array<{ id: number; uploadedBy?: number | null }>) {
    const referencing = await payload.find({
      collection: 'users',
      where: { avatar: { equals: candidate.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (referencing.docs.length > 0) continue;

    await hardDeleteAvatar(payload, candidate.id, {
      userId: candidate.uploadedBy ?? null,
      trigger: 'orphan-cleanup',
    });
    deletedCount++;
  }

  return deletedCount;
}
