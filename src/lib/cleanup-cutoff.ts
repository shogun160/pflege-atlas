/**
 * Retention period for submissions with reviewStatus='rejected'.
 * After this many days, the daily cron job auto-deletes them.
 *
 * V1.7 Brainstorm-Decision: 30 days (down from initial 90-day suggestion).
 * Reason: Art. 5(1)(c) DSGVO data minimization — rejected submissions
 * have no audit-trail value.
 */
export const REJECTED_RETENTION_DAYS = 30;

/**
 * Returns the ISO timestamp `REJECTED_RETENTION_DAYS` days before `now`.
 * Submissions with `updatedAt` older than this should be auto-deleted.
 */
export function computeCutoffISO(now: Date = new Date()): string {
  const ms = now.getTime() - REJECTED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}
