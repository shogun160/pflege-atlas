import configPromise from '@/payload.config';
import { getPayload } from 'payload';
import { computeCutoffISO } from '@/lib/cleanup-cutoff';

export const dynamic = 'force-dynamic';

/**
 * Daily cron job that auto-deletes submissions with reviewStatus='rejected'
 * older than 30 days (REJECTED_RETENTION_DAYS).
 *
 * Triggered by Vercel Cron (configured in vercel.json). Vercel sends a
 * GET request with Authorization: Bearer ${CRON_SECRET} header.
 *
 * In Phase 2 (Hetzner+Coolify), the same route is triggered via curl from a
 * Coolify scheduled task — no code change needed, only the trigger mechanism.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await getPayload({ config: configPromise });
  const cutoff = computeCutoffISO();

  const { docs } = await payload.find({
    collection: 'submissions',
    where: {
      and: [
        { reviewStatus: { equals: 'rejected' } },
        { updatedAt: { less_than: cutoff } },
      ],
    },
    limit: 1000,
    depth: 0,
  });

  let deletedCount = 0;
  const errors: string[] = [];
  for (const doc of docs) {
    try {
      await payload.delete({
        collection: 'submissions',
        id: doc.id,
      });
      deletedCount++;
    } catch (e) {
      errors.push(`Submission ${doc.id}: ${(e as Error).message}`);
    }
  }

  console.log(
    `[cleanup-submissions] Cutoff ${cutoff}, found ${docs.length}, deleted ${deletedCount}, errors ${errors.length}`,
  );

  return Response.json({ deletedCount, errors });
}
