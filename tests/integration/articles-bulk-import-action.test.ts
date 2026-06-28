import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { parseFilesPure, runImportPure } from '@/components/admin/bulk-import-pure';
import { createHash } from 'crypto';

/** Minimal valid Lexical editor state accepted by Payload's RichText validator. */
function makeLexicalDoc(text: string) {
  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      children: [
        {
          type: 'paragraph',
          version: 1,
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          textFormat: 0,
          textStyle: '',
          children: [
            {
              type: 'text',
              version: 1,
              detail: 0,
              format: 0,
              mode: 'normal' as const,
              style: '',
              text,
            },
          ],
        },
      ],
    },
  };
}

let payload: Awaited<ReturnType<typeof getPayload>>;
let editorId: number;
let adminId: number;

const VALID_MD = `---
title: Test Article ${Date.now()}
intent: bedside
summary: A short summary for tests.
---

## Definition

Body D.

## Praxis

Body P.

## Risiken & Fallstricke

Body R.

## Quellen & Weiterführendes

Body Q.
`;

beforeAll(async () => {
  payload = await getPayload({ config });
});

beforeEach(async () => {
  await (payload.db as { drizzle: { execute: (sql: unknown) => Promise<unknown> } })
    .drizzle.execute("DELETE FROM audit_logs WHERE event_type = 'article.bulk_import'");
  // Clean up any articles created by previous test runs in this session so
  // slug-dedup checks start fresh. Matches the slug pattern generated from VALID_MD.
  await (payload.db as { drizzle: { execute: (sql: unknown) => Promise<unknown> } })
    .drizzle.execute("DELETE FROM articles WHERE slug LIKE 'test-article-%' OR slug LIKE 'dup-%'");
  // ensure an editor + admin user exist
  const e = await payload.create({
    collection: 'users',
    data: {
      email: `bulk-editor-${Date.now()}@test.local`,
      password: 'TestPass123!',
      displayName: 'Bulk Editor',
      role: 'editor',
    } as never,
  });
  editorId = e.id as number;
  const a = await payload.create({
    collection: 'users',
    data: {
      email: `bulk-admin-${Date.now()}@test.local`,
      password: 'TestPass123!',
      displayName: 'Bulk Admin',
      role: 'admin',
    } as never,
  });
  adminId = a.id as number;
});

describe('parseFilesPure', () => {
  it('returns ready rows for valid input', async () => {
    const rows = await parseFilesPure(
      payload,
      [{ filename: 'a.md', content: VALID_MD }],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ready');
    expect(rows[0].sourceHash).toBe(
      createHash('sha256').update(VALID_MD).digest('hex'),
    );
  });

  it('marks duplicate slug as skip-duplicate', async () => {
    const existingSlug = `dup-${Date.now()}`;
    await payload.create({
      collection: 'articles',
      data: {
        title: 'Existing',
        slug: existingSlug,
        intent: 'bedside',
        summary: 'x',
        definition: makeLexicalDoc('def') as never,
        praxis: makeLexicalDoc('pr') as never,
        risiken: makeLexicalDoc('ri') as never,
        quellen: makeLexicalDoc('qu') as never,
      } as never,
    });
    const md = VALID_MD.replace(/title: .*/, `title: Existing\nslug: ${existingSlug}`);
    const rows = await parseFilesPure(payload, [{ filename: 'dup.md', content: md }]);
    expect(rows[0].status).toBe('skip-duplicate');
  });

  it('marks invalid input', async () => {
    const rows = await parseFilesPure(payload, [
      { filename: 'broken.md', content: 'no frontmatter' },
    ]);
    expect(rows[0].status).toBe('invalid');
  });
});

describe('runImportPure', () => {
  it('creates articles with status=draft and writes audit log per article', async () => {
    const rows = await parseFilesPure(payload, [
      { filename: 'a.md', content: VALID_MD },
    ]);
    const results = await runImportPure(payload, editorId, rows);
    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(true);
    expect(results[0].status).toBe('created');
    expect(results[0].articleId).toBeGreaterThan(0);

    const article = await payload.findByID({
      collection: 'articles',
      id: results[0].articleId!,
    });
    expect((article as { status: string }).status).toBe('draft');

    const audits = await payload.find({
      collection: 'audit-logs',
      where: { eventType: { equals: 'article.bulk_import' } },
      limit: 10,
    });
    expect(audits.totalDocs).toBe(1);
    const audit = audits.docs[0] as unknown as { metadata: { filename: string; articleId: number } };
    expect(audit.metadata.filename).toBe('a.md');
    expect(audit.metadata.articleId).toBe(results[0].articleId);
  });

  it('skips skip-duplicate and invalid rows without error', async () => {
    const existingSlug = `dup-${Date.now()}`;
    await payload.create({
      collection: 'articles',
      data: {
        title: 'Existing',
        slug: existingSlug,
        intent: 'bedside',
        summary: 'x',
        definition: makeLexicalDoc('def') as never,
        praxis: makeLexicalDoc('pr') as never,
        risiken: makeLexicalDoc('ri') as never,
        quellen: makeLexicalDoc('qu') as never,
      } as never,
    });
    const dupMd = VALID_MD.replace(/title: .*/, `title: X\nslug: ${existingSlug}`);
    const rows = await parseFilesPure(payload, [
      { filename: 'dup.md', content: dupMd },
      { filename: 'broken.md', content: 'no frontmatter' },
      { filename: 'good.md', content: VALID_MD },
    ]);
    const results = await runImportPure(payload, adminId, rows);
    expect(results.find((r) => r.filename === 'dup.md')!.status).toBe('skip-duplicate');
    expect(results.find((r) => r.filename === 'broken.md')!.status).toBe('invalid');
    expect(results.find((r) => r.filename === 'good.md')!.status).toBe('created');
  });
});
