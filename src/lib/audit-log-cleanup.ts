import type { Payload } from 'payload';
import { writeAuditLog } from './audit-log';

/**
 * Sub-C3 — retention enforcement. Daily-run via piggyback on the existing
 * V1.7 cleanup-submissions cron (Vercel-Hobby has only 2 cron slots).
 *
 * Returns the count of deleted rows. Writes an `audit.cleanup.run` meta-event
 * EVERY run (even on count=0) — that meta-event serves as a daily heartbeat.
 * If it ever stops appearing in /admin/collections/audit-logs, the cron has
 * failed silently.
 *
 * NOTE on failure-mode asymmetry:
 *   - The DELETE itself THROWS on failure → cron route returns 500, alerts.
 *   - The audit-write itself is silent-failure (writeAuditLog catches) →
 *     does not block the cron's return-value, which the caller needs.
 */
const RETENTION_DAYS = 90;

export async function cleanupExpiredAuditLogs(payload: Payload): Promise<number> {
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = new Date(cutoffMs).toISOString();

  const result = await payload.delete({
    collection: 'audit-logs',
    where: { createdAt: { less_than: cutoff } },
    overrideAccess: true,
  });
  const deletedCount = (result as { docs?: unknown[] }).docs?.length ?? 0;

  await writeAuditLog(payload, {
    eventType: 'audit.cleanup.run',
    metadata: { deletedCount, retentionDays: RETENTION_DAYS },
  });

  return deletedCount;
}
