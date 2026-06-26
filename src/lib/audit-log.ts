import { createHash } from 'crypto';
import type { Payload, PayloadRequest } from 'payload';

export const AUDIT_EVENT_TYPES = [
  'login.success',
  'login.failure',
  'password.reset.request',
  'password.reset.complete',
  'invitation.create',
  'invitation.accept',
  'role.change',
  'account.disable',
  'account.soft_delete.self',
  'account.erasure.runbook',
  'email.change.admin',
  'audit.cleanup.run',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export type LoginContext = { ip: string | null; userAgent: string | null };

export type AuditEventInput = {
  eventType: AuditEventType;
  /** users.id of the actor (who triggered the action). null for system events or unknown logins. */
  actor?: number | null;
  /** Email snapshot of the actor at event time — anonymization-resistant. */
  actorEmail?: string | null;
  /** users.id of the subject (target of the action). null for system events or events without a target. */
  subject?: number | null;
  /** Email snapshot of the subject at event time — anonymization-resistant. */
  subjectEmail?: string | null;
  metadata?: Record<string, unknown> | null;
  loginContext?: LoginContext;
  /**
   * Optional Payload request to join an outer transaction.
   * REQUIRED when called from a collection hook (e.g. users.afterChange) so the
   * audit-log insert sees the in-flight row that triggered the hook — otherwise
   * the subject FK constraint will fire before the parent row commits.
   */
  req?: PayloadRequest;
};

export function hashIp(ip: string): string {
  const secret = process.env.AUDIT_IP_HASH_SECRET;
  if (!secret) {
    console.error('[audit] AUDIT_IP_HASH_SECRET not set — ipHash unavailable');
    return '';
  }
  return createHash('sha256').update(`${ip}:${secret}`).digest('hex');
}

export function truncateUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  return ua.length > 200 ? ua.slice(0, 200) : ua;
}

export function extractLoginContext(request: Request): LoginContext {
  const xff = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip =
    xff ||
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    null;
  return { ip, userAgent: request.headers.get('user-agent') };
}

export async function writeAuditLog(payload: Payload, input: AuditEventInput): Promise<void> {
  try {
    const ipHashRaw = input.loginContext?.ip ? hashIp(input.loginContext.ip) : '';
    const data = {
      eventType: input.eventType,
      actor: input.actor ?? null,
      actorEmail: input.actorEmail ?? null,
      subject: input.subject ?? null,
      subjectEmail: input.subjectEmail ?? null,
      metadata: input.metadata ?? null,
      ipHash: ipHashRaw || null,
      userAgent: truncateUserAgent(input.loginContext?.userAgent),
    };
    await payload.create({
      collection: 'audit-logs',
      data: data as never,
      overrideAccess: true,
      ...(input.req ? { req: input.req } : {}),
    });
  } catch (err) {
    console.error('[audit] write failed', { eventType: input.eventType, err });
  }
}
