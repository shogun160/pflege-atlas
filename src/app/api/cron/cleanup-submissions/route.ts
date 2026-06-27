import configPromise from '@/payload.config';
import { getPayload, type Payload } from 'payload';
import { computeCutoffISO } from '@/lib/cleanup-cutoff';
import { cleanupExpiredAuditLogs } from '@/lib/audit-log-cleanup';
import { cleanupOrphanAvatars } from '@/lib/avatar-orphan-cleanup';

export const dynamic = 'force-dynamic';

/**
 * Daily cron job. Three cleanup tasks piggyback on this single route because
 * Vercel-Hobby has a 2-slot cron limit:
 *   1) V1.7 — auto-delete submissions with reviewStatus='rejected' older
 *      than REJECTED_RETENTION_DAYS (30d).
 *   2) V1.6.1 — auto-delete orphan avatar-media (purpose='avatar') older
 *      than 24h that no user references (Two-Step-Upload-UX orphans).
 *   3) Sub-C3 — auto-delete audit-log rows older than 90 days, with a
 *      heartbeat meta-event written on EVERY run.
 *
 * Triggered by Vercel Cron (configured in vercel.json). Vercel sends a
 * GET request with Authorization: Bearer ${CRON_SECRET} header.
 *
 * In Phase 2 (Hetzner+Coolify), the same route is triggered via curl from a
 * Coolify scheduled task — no code change needed, only the trigger mechanism.
 */

async function cleanupRejectedSubmissions(
  payload: Payload,
): Promise<{ deletedCount: number; errors: string[] }> {
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
      await payload.delete({ collection: 'submissions', id: doc.id });
      deletedCount++;
    } catch (e) {
      errors.push(`Submission ${doc.id}: ${(e as Error).message}`);
    }
  }

  console.log(
    `[cleanup-submissions] Cutoff ${cutoff}, found ${docs.length}, deleted ${deletedCount}, errors ${errors.length}`,
  );
  return { deletedCount, errors };
}

export async function GET(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await getPayload({ config: configPromise });

  // Sequential — same DB connection pool. Submissions first (existing V1.7
  // logic, untouched semantically). Orphan avatars second. Audit third.
  const submissionsResult = await cleanupRejectedSubmissions(payload);

  let orphanAvatarsDeleted: number;
  try {
    orphanAvatarsDeleted = await cleanupOrphanAvatars(payload);
  } catch (err) {
    console.error('[cleanup-orphan-avatars] failed', err);
    return Response.json(
      {
        submissionsDeleted: submissionsResult.deletedCount,
        submissionsErrors: submissionsResult.errors,
        orphanAvatarError: (err as Error).message,
      },
      { status: 500 },
    );
  }

  let auditDeleted: number;
  try {
    auditDeleted = await cleanupExpiredAuditLogs(payload, {
      orphanAvatarsDeleted,
      submissionsDeleted: submissionsResult.deletedCount,
    });
  } catch (err) {
    console.error('[cleanup-audit-logs] failed', err);
    return Response.json(
      {
        submissionsDeleted: submissionsResult.deletedCount,
        submissionsErrors: submissionsResult.errors,
        orphanAvatarsDeleted,
        auditError: (err as Error).message,
      },
      { status: 500 },
    );
  }

  return Response.json({
    submissionsDeleted: submissionsResult.deletedCount,
    submissionsErrors: submissionsResult.errors,
    orphanAvatarsDeleted,
    auditDeleted,
  });
}
