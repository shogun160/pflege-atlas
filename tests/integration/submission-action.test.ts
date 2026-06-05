import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist mocks so they are available before vi.mock factory calls (hoisting requirement)
const { createMock, sendEmailMock, findMock, redirectMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  sendEmailMock: vi.fn(),
  findMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({
    create: createMock,
    sendEmail: sendEmailMock,
    find: findMock,
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import { submitAction } from '@/app/(frontend)/einreichen/actions';

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

const validForm = {
  type: 'new_article',
  subject: 'Testbetreff für Integration',
  body: 'Test-Inhalt mit mindestens zwanzig Zeichen Länge.',
  turnstileToken: 'token',
  submitterName: '',
  submitterEmail: '',
};

describe('submitAction', () => {
  beforeEach(() => {
    createMock.mockReset().mockResolvedValue({
      id: 'sub-1',
      type: 'new_article',
      subject: 'Testbetreff für Integration',
      body: 'Test-Inhalt mit mindestens zwanzig Zeichen Länge.',
      createdAt: '2026-06-05T00:00:00Z',
    });
    sendEmailMock.mockReset().mockResolvedValue({ id: 'mail-1' });
    findMock.mockReset().mockResolvedValue({ docs: [] });
    redirectMock.mockClear();
    vi.stubEnv('TURNSTILE_SECRET_KEY', ''); // bypass-Pfad
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns fieldErrors when schema validation fails', async () => {
    const result = await submitAction({}, fd({ ...validForm, subject: '' }));
    expect(result.fieldErrors?.subject).toBeDefined();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('calls payload.create on valid input', async () => {
    await expect(submitAction({}, fd(validForm))).rejects.toThrow('NEXT_REDIRECT');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0]).toMatchObject({
      collection: 'submissions',
      data: expect.objectContaining({
        type: 'new_article',
        subject: 'Testbetreff für Integration',
        reviewStatus: 'pending',
      }),
    });
  });

  it('sends notification email after successful create', async () => {
    await expect(submitAction({}, fd(validForm))).rejects.toThrow('NEXT_REDIRECT');
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].to).toBe('redaktion@pflegeatlas.org');
  });

  it('redirects to /einreichen/danke on success', async () => {
    await expect(submitAction({}, fd(validForm))).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/einreichen/danke');
  });

  it('returns error when related article slug not found for corrections', async () => {
    findMock.mockResolvedValue({ docs: [] });
    const result = await submitAction(
      {},
      fd({ ...validForm, type: 'correction', relatedArticleSlug: 'unknown' }),
    );
    expect(result.fieldErrors?.relatedArticleSlug).toMatch(/nicht gefunden/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('does not bounce submit if mail send fails — submission still created', async () => {
    sendEmailMock.mockRejectedValue(new Error('mail down'));
    await expect(submitAction({}, fd(validForm))).rejects.toThrow('NEXT_REDIRECT');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalled();
  });
});
