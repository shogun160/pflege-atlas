import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { generateToken, INVITE_EXPIRY_MS } from '@/lib/auth-tokens';

let payload: Awaited<ReturnType<typeof getPayload>>;

beforeAll(async () => {
  payload = await getPayload({ config });
});

async function makeInvitedUser(tokenOverride?: string, expiryMs: number = INVITE_EXPIRY_MS) {
  const email = `invited-${Date.now()}-${Math.random()}@test.local`;
  const token = tokenOverride ?? generateToken();
  const user = await payload.create({
    collection: 'users',
    data: {
      email,
      password: generateToken(),
      displayName: 'X',
      role: 'contributor',
      disabled: false,
      setPasswordToken: token,
      setPasswordTokenExpiresAt: new Date(Date.now() + expiryMs).toISOString(),
    } as never,
  });
  return { id: user.id as number, email, token };
}

describe('setPasswordFromTokenAction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ set: vi.fn(), delete: vi.fn(), get: () => undefined }),
    }));
  });
  afterEach(() => vi.doUnmock('next/headers'));

  it('sets password + clears token + returns login redirect', async () => {
    const { token, email } = await makeInvitedUser();
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction(token, 'NewSecurePass1!');
    expect(result.ok).toBe(true);
    expect(result.redirectTo).toBe('/mein-bereich');
    const refetched = await payload.find({
      collection: 'users', where: { email: { equals: email } }, depth: 0,
    });
    expect((refetched.docs[0] as { setPasswordToken?: string | null }).setPasswordToken).toBeFalsy();
    const loginResult = await payload.login({
      collection: 'users', data: { email, password: 'NewSecurePass1!' },
    });
    expect(loginResult.token).toBeTruthy();
  });

  it('rejects expired tokens', async () => {
    const { token } = await makeInvitedUser(undefined, -1000);
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction(token, 'NewPass1!');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/expired|abgelaufen|invalid|ungültig/i);
  });

  it('rejects unknown tokens', async () => {
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction('not-a-real-token', 'NewPass1!');
    expect(result.ok).toBe(false);
  });

  it('rejects reusing the same token twice', async () => {
    const { token } = await makeInvitedUser();
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const first = await setPasswordFromTokenAction(token, 'NewPass1!');
    expect(first.ok).toBe(true);
    const second = await setPasswordFromTokenAction(token, 'Other2!');
    expect(second.ok).toBe(false);
  });

  it('rejects passwords shorter than 8 chars', async () => {
    const { token } = await makeInvitedUser();
    const { setPasswordFromTokenAction } = await import('@/lib/auth');
    const result = await setPasswordFromTokenAction(token, 'short');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/8|kurz|short/i);
  });
});
