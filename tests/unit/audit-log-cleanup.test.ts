import { describe, it, expect, vi } from 'vitest';
import { cleanupExpiredAuditLogs } from '@/lib/audit-log-cleanup';

describe('cleanupExpiredAuditLogs', () => {
  it('passes a cutoff timestamp ≈ now - 90 days to payload.delete', async () => {
    const mockPayload = {
      delete: vi.fn().mockResolvedValue({ docs: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
      create: vi.fn().mockResolvedValue({ id: 99 }),
    };

    const count = await cleanupExpiredAuditLogs(mockPayload as never);

    expect(count).toBe(3);
    expect(mockPayload.delete).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'audit-logs',
      where: expect.objectContaining({
        createdAt: expect.objectContaining({
          less_than: expect.any(String),
        }),
      }),
      overrideAccess: true,
    }));
    const cutoffArg = (mockPayload.delete as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .where.createdAt.less_than;
    const cutoff = new Date(cutoffArg as string).getTime();
    const expected = Date.now() - 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff - expected)).toBeLessThan(5000);
  });

  it('writes audit.cleanup.run meta-event even when deletedCount=0 (daily heartbeat)', async () => {
    const mockPayload = {
      delete: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn().mockResolvedValue({ id: 99 }),
    };

    await cleanupExpiredAuditLogs(mockPayload as never);

    expect(mockPayload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'audit-logs',
      overrideAccess: true,
      data: expect.objectContaining({
        eventType: 'audit.cleanup.run',
        metadata: { deletedCount: 0, retentionDays: 90 },
      }),
    }));
  });

  it('throws when payload.delete fails (cron must observe the failure)', async () => {
    const mockPayload = {
      delete: vi.fn().mockRejectedValue(new Error('DB error')),
      create: vi.fn(),
    };

    await expect(cleanupExpiredAuditLogs(mockPayload as never)).rejects.toThrow('DB error');
    expect(mockPayload.create).not.toHaveBeenCalled();
  });
});
