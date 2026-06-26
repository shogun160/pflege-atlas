import type { Payload } from 'payload';
import { writeAuditLog } from './audit-log';

/**
 * Sub-C3 T9 — pure-DB extraction so the runbook script's audit step is
 * integration-testable without prompts/readline/exit. The script
 * `scripts/right-to-erasure.ts` is the only production caller.
 *
 * Two stages, both spec-defined:
 *   - `anonymize` — what the script actually executes (avatar-hard-delete +
 *     anonymizeUserPatch). User-row stays.
 *   - `hard_delete` — manual psql per runbook Section 6, no script support.
 *     Admins setting this stage typically call writeAuditLog directly before
 *     running the psql DELETE (see docs/legal/audit-log-policy.md).
 *
 * Why `actor=null`: the script runs without an auth session (no req.user).
 * The accompanying stdout audit-trail block + the mail-confirmation copy
 * are the human-readable WHO. The audit row's subject + subjectEmail still
 * pin down WHO was erased.
 */
export async function performErasureRunbook(
  payload: Payload,
  args: {
    userId: number;
    originalEmail: string;
    stage: 'anonymize' | 'hard_delete';
    notes?: string;
  },
): Promise<void> {
  await writeAuditLog(payload, {
    eventType: 'account.erasure.runbook',
    actor: null,
    actorEmail: null,
    subject: args.userId,
    subjectEmail: args.originalEmail,
    metadata: {
      stage: args.stage,
      method: 'runbook_script',
      ...(args.notes ? { notes: args.notes } : {}),
    },
  });
}
