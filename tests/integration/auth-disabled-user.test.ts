import { describe, it, expect, beforeAll } from 'vitest';
import 'dotenv/config';
import { getPayload } from 'payload';
import config from '@/payload.config';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('disabled user login', () => {
  it('blocks login for disabled users with valid credentials', async () => {
    const email = `disabled-${Date.now()}@test.local`;
    await payload.create({
      collection: 'users',
      data: {
        email,
        password: 'TestPass123!',
        displayName: 'Disabled User',
        role: 'contributor',
        disabled: true,
      } as never,
    });

    await expect(
      payload.login({
        collection: 'users',
        data: { email, password: 'TestPass123!' },
      }),
    ).rejects.toThrow(/disabled|gesperrt/i);
  });

  it('allows login for non-disabled users', async () => {
    const email = `active-${Date.now()}@test.local`;
    await payload.create({
      collection: 'users',
      data: {
        email,
        password: 'TestPass123!',
        displayName: 'Active User',
        role: 'contributor',
        disabled: false,
      } as never,
    });

    const result = await payload.login({
      collection: 'users',
      data: { email, password: 'TestPass123!' },
    });
    expect(result.user.email).toBe(email);
  });
});
