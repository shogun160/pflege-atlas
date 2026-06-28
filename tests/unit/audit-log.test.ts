import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashIp, truncateUserAgent, writeAuditLog, extractLoginContext, AUDIT_EVENT_TYPES } from '@/lib/audit-log';

describe('audit-log helper', () => {
  describe('hashIp', () => {
    it('produces deterministic 64-char hex hash for same IP + same secret', () => {
      process.env.AUDIT_IP_HASH_SECRET = 'secret-a';
      const h1 = hashIp('1.2.3.4');
      const h2 = hashIp('1.2.3.4');
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different hash for same IP + different secret (secret-bound)', () => {
      process.env.AUDIT_IP_HASH_SECRET = 'secret-a';
      const h1 = hashIp('1.2.3.4');
      process.env.AUDIT_IP_HASH_SECRET = 'secret-b';
      const h2 = hashIp('1.2.3.4');
      expect(h1).not.toBe(h2);
    });

    it('returns empty string and logs error if secret is unset', () => {
      const original = process.env.AUDIT_IP_HASH_SECRET;
      delete process.env.AUDIT_IP_HASH_SECRET;
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = hashIp('1.2.3.4');
      expect(result).toBe('');
      expect(errSpy).toHaveBeenCalled();
      process.env.AUDIT_IP_HASH_SECRET = original;
      errSpy.mockRestore();
    });
  });

  describe('truncateUserAgent', () => {
    it('returns null for null/undefined input', () => {
      expect(truncateUserAgent(null)).toBeNull();
      expect(truncateUserAgent(undefined)).toBeNull();
    });

    it('returns string unchanged if ≤ 200 chars', () => {
      const ua = 'Mozilla/5.0 (compatible)';
      expect(truncateUserAgent(ua)).toBe(ua);
    });

    it('truncates to 200 chars if longer', () => {
      const ua = 'x'.repeat(250);
      const result = truncateUserAgent(ua);
      expect(result).toHaveLength(200);
      expect(result).toBe('x'.repeat(200));
    });
  });

  describe('writeAuditLog', () => {
    beforeEach(() => {
      process.env.AUDIT_IP_HASH_SECRET = 'test-secret';
    });

    it('swallows payload.create errors and logs to console.error', async () => {
      const mockPayload = {
        create: vi.fn().mockRejectedValue(new Error('DB down')),
      };
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        writeAuditLog(mockPayload as never, { eventType: 'login.success', actor: 1 }),
      ).resolves.toBeUndefined();

      expect(errSpy).toHaveBeenCalledWith(
        '[audit] write failed',
        expect.objectContaining({ eventType: 'login.success' }),
      );
      errSpy.mockRestore();
    });

    it('calls payload.create with mapped data + hashed IP + truncated UA', async () => {
      const mockPayload = {
        create: vi.fn().mockResolvedValue({ id: 99 }),
      };

      await writeAuditLog(mockPayload as never, {
        eventType: 'login.success',
        actor: 42,
        actorEmail: 'a@b.c',
        loginContext: { ip: '1.2.3.4', userAgent: 'x'.repeat(250) },
      });

      expect(mockPayload.create).toHaveBeenCalledWith({
        collection: 'audit-logs',
        data: expect.objectContaining({
          eventType: 'login.success',
          actor: 42,
          actorEmail: 'a@b.c',
          ipHash: expect.stringMatching(/^[0-9a-f]{64}$/),
          userAgent: 'x'.repeat(200),
        }),
        overrideAccess: true,
      });
    });

    it('omits ipHash and userAgent when loginContext absent', async () => {
      const mockPayload = {
        create: vi.fn().mockResolvedValue({ id: 99 }),
      };

      await writeAuditLog(mockPayload as never, {
        eventType: 'role.change',
        actor: 1,
        subject: 2,
        metadata: { oldRole: 'reviewer', newRole: 'editor' },
      });

      const callArg = mockPayload.create.mock.calls[0][0] as { data: { ipHash: unknown; userAgent: unknown } };
      expect(callArg.data.ipHash).toBeNull();
      expect(callArg.data.userAgent).toBeNull();
    });
  });

  describe('extractLoginContext', () => {
    it('extracts ip from x-forwarded-for (first in comma list)', () => {
      const req = new Request('http://test', {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8', 'user-agent': 'UA' },
      });
      expect(extractLoginContext(req)).toEqual({ ip: '1.2.3.4', userAgent: 'UA' });
    });

    it('falls back to x-vercel-forwarded-for then x-real-ip', () => {
      const req1 = new Request('http://test', {
        headers: { 'x-vercel-forwarded-for': '9.9.9.9', 'user-agent': 'UA' },
      });
      expect(extractLoginContext(req1).ip).toBe('9.9.9.9');

      const req2 = new Request('http://test', {
        headers: { 'x-real-ip': '7.7.7.7', 'user-agent': 'UA' },
      });
      expect(extractLoginContext(req2).ip).toBe('7.7.7.7');
    });

    it('returns ip=null when no header set', () => {
      const req = new Request('http://test', { headers: { 'user-agent': 'UA' } });
      expect(extractLoginContext(req)).toEqual({ ip: null, userAgent: 'UA' });
    });

    it('falls through to vercel header when x-forwarded-for has leading empty entry', () => {
      const req = new Request('http://test', {
        headers: { 'x-forwarded-for': ', 1.2.3.4', 'x-vercel-forwarded-for': '9.9.9.9' },
      });
      expect(extractLoginContext(req).ip).toBe('9.9.9.9');
    });

    it('parses IPv6 from x-forwarded-for', () => {
      const req = new Request('http://test', {
        headers: { 'x-forwarded-for': '2001:db8::1, 5.6.7.8' },
      });
      expect(extractLoginContext(req).ip).toBe('2001:db8::1');
    });
  });

  describe('AUDIT_EVENT_TYPES', () => {
    it('exports exactly 13 event types', () => {
      expect(AUDIT_EVENT_TYPES).toHaveLength(13);
      expect(AUDIT_EVENT_TYPES).toContain('login.success');
      expect(AUDIT_EVENT_TYPES).toContain('account.erasure.runbook');
      expect(AUDIT_EVENT_TYPES).toContain('audit.cleanup.run');
      expect(AUDIT_EVENT_TYPES).toContain('article.bulk_import');
    });
  });
});
