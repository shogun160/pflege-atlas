import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import 'dotenv/config';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { sendMail } from '@/lib/mail';
import { createUserFixture, type UserFixture } from '../helpers/user-fixtures';

let payload: Awaited<ReturnType<typeof getPayload>>;
let editor: UserFixture;
let reviewer: UserFixture;
let prevNodeEnv: string | undefined;

beforeAll(async () => {
  vi.resetModules();
  // B8: Articles.ts gates the ready-to-publish broadcast behind NODE_ENV=production
  // (otherwise dev/test would mail ~150 fixture-users on every test run).
  // Override here so the broadcast logic actually executes.
  prevNodeEnv = process.env.NODE_ENV;
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'production',
    configurable: true,
    writable: true,
    enumerable: true,
  });
  payload = await getPayload({ config });
  editor = await createUserFixture(payload, 'editor');
  reviewer = await createUserFixture(payload, 'reviewer');
});

afterAll(() => {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: prevNodeEnv ?? 'test',
    configurable: true,
    writable: true,
    enumerable: true,
  });
});

function makeLexical(text: string) {
  return { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text }] }] } };
}

describe('article ready-to-publish notification', () => {
  beforeEach(() => {
    vi.mocked(sendMail).mockClear();
  });

  it('sends ready-to-publish mail to all editors when status transitions to ready_to_publish', async () => {
    const article = await payload.create({
      collection: 'articles',
      data: {
        title: `NotifyTest ${Date.now()}`,
        slug: `notify-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        intent: 'background',
        summary: 's',
        definition: makeLexical('d'),
        praxis: makeLexical('p'),
        risiken: makeLexical('r'),
        quellen: makeLexical('q'),
        status: 'in_review',
        currentReviewer: reviewer.id,
      } as never,
    });

    vi.mocked(sendMail).mockClear();

    await payload.update({
      collection: 'articles',
      id: article.id,
      data: { status: 'ready_to_publish' } as never,
      overrideAccess: false,
      user: reviewer as never,
    });

    const calls = vi.mocked(sendMail).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const editorMail = calls.find((c) => (c[0] as { to: string }).to === editor.email);
    expect(editorMail).toBeTruthy();
    expect((editorMail![0] as { subject: string }).subject).toMatch(/bereit zur Veröffentlichung/i);
  });

  it('does not re-send on subsequent updates while status stays ready_to_publish', async () => {
    const article = await payload.create({
      collection: 'articles',
      data: {
        title: `NoResend ${Date.now()}`,
        slug: `noresend-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        intent: 'background',
        summary: 's',
        definition: makeLexical('d'),
        praxis: makeLexical('p'),
        risiken: makeLexical('r'),
        quellen: makeLexical('q'),
        status: 'in_review',
        currentReviewer: reviewer.id,
      } as never,
    });

    await payload.update({
      collection: 'articles',
      id: article.id,
      data: { status: 'ready_to_publish' } as never,
      overrideAccess: false,
      user: reviewer as never,
    });

    vi.mocked(sendMail).mockClear();

    await payload.update({
      collection: 'articles',
      id: article.id,
      data: { summary: 'updated summary' } as never,
      overrideAccess: false,
      user: editor as never,
    });

    expect(vi.mocked(sendMail).mock.calls.length).toBe(0);
  });
});
