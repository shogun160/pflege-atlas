import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Payload } from 'payload';
import { hardDeleteAvatar } from '@/lib/avatar-cleanup';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

function makeMockPayload(deleteImpl: (args: unknown) => Promise<unknown>): Payload {
  return { delete: vi.fn(deleteImpl) } as unknown as Payload;
}

describe('hardDeleteAvatar', () => {
  it('returns deleted=false and no warn-log when oldMediaId is null', async () => {
    const payload = makeMockPayload(async () => {
      throw new Error('should not be called');
    });
    const result = await hardDeleteAvatar(payload, null, { userId: 1, trigger: 'account-delete' });
    expect(result).toEqual({ deleted: false });
    expect(payload.delete).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns deleted=false and no warn-log when oldMediaId is undefined', async () => {
    const payload = makeMockPayload(async () => {
      throw new Error('should not be called');
    });
    const result = await hardDeleteAvatar(payload, undefined, { userId: 1, trigger: 'profile-update' });
    expect(result).toEqual({ deleted: false });
    expect(payload.delete).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns deleted=true and calls payload.delete on success', async () => {
    const payload = makeMockPayload(async () => ({ id: 42 }));
    const result = await hardDeleteAvatar(payload, 42, { userId: 7, trigger: 'account-delete' });
    expect(result).toEqual({ deleted: true });
    expect(payload.delete).toHaveBeenCalledWith({ collection: 'media', id: 42 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns deleted=false with error and warn-log on payload.delete reject', async () => {
    const payload = makeMockPayload(async () => {
      throw new Error('R2 outage');
    });
    const result = await hardDeleteAvatar(payload, 42, { userId: 7, trigger: 'profile-update' });
    expect(result.deleted).toBe(false);
    expect(result.error).toContain('R2 outage');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warnArg = warnSpy.mock.calls[0]?.[0];
    expect(String(warnArg)).toContain('avatar-cleanup');
    expect(String(warnArg)).toContain('userId=7');
    expect(String(warnArg)).toContain('media=42');
    expect(String(warnArg)).toContain('profile-update');
  });
});
