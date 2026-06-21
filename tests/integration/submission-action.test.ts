import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockCreate, mockFind, mockSendEmail, mockVerify, mockRedirect } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFind: vi.fn(),
  mockSendEmail: vi.fn(),
  mockVerify: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/lib/payload', () => ({
  getPayloadClient: async () => ({
    create: mockCreate,
    find: mockFind,
    sendEmail: mockSendEmail,
  }),
}));

vi.mock('@/lib/turnstile', () => ({
  verifyTurnstileToken: mockVerify,
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

// /einreichen calls getSession() so the Submissions beforeChange hook can
// auto-fill submittedBy when a logged-in user submits. In this unit test we
// don't have a request scope (Next's cookies() would throw), so stub the
// session to null — the anonymous-submission path is what this suite covers.
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(async () => null),
}));

import { submitAction } from '@/app/(frontend)/einreichen/actions';

const lexicalSample = JSON.stringify({
  type: 'root',
  version: 1,
  children: [
    {
      type: 'paragraph',
      version: 1,
      children: [{ type: 'text', version: 1, text: 'X', format: 0 }],
    },
  ],
});

const editedLexical = JSON.stringify({
  type: 'root',
  version: 1,
  children: [
    {
      type: 'paragraph',
      version: 1,
      children: [{ type: 'text', version: 1, text: 'EDITIERT', format: 0 }],
    },
  ],
});

function formDataFrom(obj: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      for (const item of v) fd.append(k, item);
    } else {
      fd.append(k, v);
    }
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerify.mockResolvedValue(true);
  mockCreate.mockResolvedValue({ id: 42, createdAt: '2026-06-06T12:00:00Z' });
});

describe('submitAction — new_article happy path', () => {
  it('creates submission, sends mail, redirects to /einreichen/danke', async () => {
    const fd = formDataFrom({
      type: 'new_article',
      proposedTitle: 'Dekubitusprophylaxe',
      proposedDefinition: lexicalSample,
      proposedPraxis: lexicalSample,
      proposedRisiken: lexicalSample,
      proposedQuellen: lexicalSample,
      turnstileToken: 'ok',
    });

    await expect(submitAction({}, fd)).rejects.toThrow('NEXT_REDIRECT');
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith('/einreichen/danke');
    const createArgs = mockCreate.mock.calls[0][0];
    expect(createArgs.collection).toBe('submissions');
    expect(createArgs.data.type).toBe('new_article');
    expect(createArgs.data.proposedTitle).toBe('Dekubitusprophylaxe');
  });
});

describe('submitAction — correction happy path', () => {
  beforeEach(() => {
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 7,
          title: 'Dekubitus',
          definition: JSON.parse(lexicalSample),
          praxis: JSON.parse(lexicalSample),
          risiken: JSON.parse(lexicalSample),
          quellen: JSON.parse(lexicalSample),
        },
      ],
    });
  });

  it('accepts correction with one edited section', async () => {
    const fd = formDataFrom({
      type: 'correction',
      relatedArticleSlug: 'dekubitus',
      selectedSections: ['praxis'],
      editedPraxis: editedLexical,
      turnstileToken: 'ok',
    });

    await expect(submitAction({}, fd)).rejects.toThrow('NEXT_REDIRECT');
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith('/einreichen/danke');
    const createArgs = mockCreate.mock.calls[0][0];
    expect(createArgs.data.type).toBe('correction');
    expect(createArgs.data.relatedArticle).toBe(7);
    expect(createArgs.data.editedPraxis).toBeDefined();
  });

  it('accepts correction with multiple edited sections', async () => {
    const fd = formDataFrom({
      type: 'correction',
      relatedArticleSlug: 'dekubitus',
      selectedSections: ['praxis', 'risiken'],
      editedPraxis: editedLexical,
      editedRisiken: editedLexical,
      turnstileToken: 'ok',
    });

    await expect(submitAction({}, fd)).rejects.toThrow('NEXT_REDIRECT');
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

describe('submitAction — correction validation failures', () => {
  beforeEach(() => {
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 7,
          title: 'Dekubitus',
          definition: JSON.parse(lexicalSample),
          praxis: JSON.parse(lexicalSample),
          risiken: JSON.parse(lexicalSample),
          quellen: JSON.parse(lexicalSample),
        },
      ],
    });
  });

  it('rejects when edited content equals original (no changes)', async () => {
    const fd = formDataFrom({
      type: 'correction',
      relatedArticleSlug: 'dekubitus',
      selectedSections: ['praxis'],
      editedPraxis: lexicalSample, // identical to original
      turnstileToken: 'ok',
    });

    const result = await submitAction({}, fd);
    expect(result.fieldErrors?.editedPraxis).toMatch(/Keine Änderungen/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects when article slug not found', async () => {
    mockFind.mockResolvedValueOnce({ docs: [] });
    const fd = formDataFrom({
      type: 'correction',
      relatedArticleSlug: 'unbekannt',
      selectedSections: ['praxis'],
      editedPraxis: editedLexical,
      turnstileToken: 'ok',
    });

    const result = await submitAction({}, fd);
    expect(result.fieldErrors?.relatedArticleSlug).toMatch(/nicht gefunden/);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('submitAction — turnstile + values preservation', () => {
  it('returns state.error when turnstile fails', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const fd = formDataFrom({
      type: 'new_article',
      proposedTitle: 'Title',
      proposedDefinition: lexicalSample,
      proposedPraxis: lexicalSample,
      proposedRisiken: lexicalSample,
      proposedQuellen: lexicalSample,
      turnstileToken: 'bad',
    });

    const result = await submitAction({}, fd);
    expect(result.error).toMatch(/Captcha/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('preserves submitted values on fieldErrors', async () => {
    const fd = formDataFrom({
      type: 'new_article',
      proposedTitle: 'ab', // too short
      proposedDefinition: lexicalSample,
      proposedPraxis: lexicalSample,
      proposedRisiken: lexicalSample,
      proposedQuellen: lexicalSample,
      submitterName: 'Anna',
      turnstileToken: 'ok',
    });

    const result = await submitAction({}, fd);
    expect(result.values?.proposedTitle).toBe('ab');
    expect(result.values?.submitterName).toBe('Anna');
  });
});
