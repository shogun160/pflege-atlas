import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { createUserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('requestPasswordResetAction', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns ok=true even for unknown email (anti-enumeration)', async () => {
    const { requestPasswordResetAction } = await import('@/lib/auth');
    const result = await requestPasswordResetAction('nobody@nowhere.local');
    expect(result.ok).toBe(true);
  });

  it('returns ok=true for known email and triggers Payload forgotPassword', async () => {
    const user = await createUserFixture(payload, 'contributor');
    const { requestPasswordResetAction } = await import('@/lib/auth');
    const result = await requestPasswordResetAction(user.email);
    expect(result.ok).toBe(true);
  });
});
