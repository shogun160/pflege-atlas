import { createHash } from 'crypto';
import type { Payload } from 'payload';
import { slugify } from '@/lib/slugify';
import { parseMarkdownArticle } from '@/lib/article-import/parse-markdown-article';
import { markdownToLexical } from '@/lib/article-import/markdown-to-lexical';
import { matchAuthors, type KnownUser } from '@/lib/article-import/match-author';
import { writeAuditLog } from '@/lib/audit-log';
import type {
  ImportRow,
  ImportResultRow,
  ParseResult,
  ValidationIssue,
} from '@/lib/article-import/types';

export const MAX_FILES = 50;
export const MAX_FILE_BYTES = 256 * 1024;
export const TOO_LARGE_SENTINEL = '__TOO_LARGE__';

export interface RawFile {
  filename: string;
  content: string;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function buildInvalidRow(filename: string, content: string, issues: ValidationIssue[]): ImportRow {
  return {
    filename,
    sourceHash: hashContent(content),
    status: 'invalid',
    title: '',
    resolvedSlug: '',
    parseResult: { ok: false, issues },
  };
}

/**
 * Pure (testable) variant — same logic as the action below, but takes a
 * Payload instance and already-decoded files. Used by integration tests
 * to bypass FormData + session.
 */
export async function parseFilesPure(
  payload: Payload,
  files: RawFile[],
): Promise<ImportRow[]> {
  // First pass: parse + resolve slug
  const interim: Array<{ filename: string; content: string; parse: ParseResult; resolvedSlug: string }> = [];
  for (const file of files) {
    if (file.content === TOO_LARGE_SENTINEL) {
      interim.push({
        filename: file.filename,
        content: '',
        resolvedSlug: '',
        parse: {
          ok: false,
          issues: [{
            code: 'file-too-large',
            severity: 'hard',
            message: `Datei überschreitet das Limit von ${MAX_FILE_BYTES} Bytes.`,
          }],
        },
      });
      continue;
    }
    const parse = parseMarkdownArticle(file.content);
    const resolvedSlug = parse.ok
      ? (parse.article.frontmatter.slug ?? slugify(parse.article.frontmatter.title))
      : '';
    interim.push({ filename: file.filename, content: file.content, parse, resolvedSlug });
  }

  const slugsToCheck = interim
    .map((i) => i.resolvedSlug)
    .filter((s) => s.length > 0);

  let existingSlugs = new Set<string>();
  if (slugsToCheck.length > 0) {
    const existing = await payload.find({
      collection: 'articles',
      where: { slug: { in: slugsToCheck } },
      limit: 200,
      depth: 0,
    });
    existingSlugs = new Set(
      (existing.docs as Array<{ slug: string }>).map((d) => d.slug),
    );
  }

  const rows: ImportRow[] = [];
  const seenInBatch = new Set<string>();
  for (const item of interim) {
    if (!item.parse.ok) {
      rows.push(buildInvalidRow(item.filename, item.content, item.parse.issues));
      continue;
    }
    const sourceHash = hashContent(item.content);
    const title = item.parse.article.frontmatter.title;
    const slug = item.resolvedSlug;

    // Duplicate against DB OR earlier batch entry
    if (existingSlugs.has(slug) || seenInBatch.has(slug)) {
      rows.push({
        filename: item.filename,
        sourceHash,
        status: 'skip-duplicate',
        title,
        resolvedSlug: slug,
        parseResult: item.parse,
      });
      continue;
    }
    seenInBatch.add(slug);
    rows.push({
      filename: item.filename,
      sourceHash,
      status: 'ready',
      title,
      resolvedSlug: slug,
      parseResult: item.parse,
    });
  }
  return rows;
}

export async function runImportPure(
  payload: Payload,
  userId: number,
  rows: ImportRow[],
): Promise<ImportResultRow[]> {
  // Preload candidate users once for author matching
  const candidateNames = new Set<string>();
  for (const row of rows) {
    if (row.status !== 'ready' || !row.parseResult.ok) continue;
    for (const a of row.parseResult.article.frontmatter.authors ?? []) {
      candidateNames.add(a);
    }
  }
  let userPool: KnownUser[] = [];
  if (candidateNames.size > 0) {
    try {
      const usersRes = await payload.find({
        collection: 'users',
        where: { disabled: { equals: false } },
        limit: 500,
        depth: 0,
      });
      userPool = (usersRes.docs as Array<{ id: number; displayName?: string | null; email: string }>).map(
        (u) => ({ id: u.id, displayName: u.displayName ?? null, email: u.email }),
      );
    } catch (err) {
      console.error('[bulk-import] userPool fetch failed, author matching will return all-unknown', err);
      // userPool stays empty — matchAuthors will emit author-unknown warnings for all names
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const results: ImportResultRow[] = [];

  for (const row of rows) {
    if (row.status === 'skip-duplicate') {
      results.push({
        filename: row.filename,
        ok: false,
        status: 'skip-duplicate',
        error: 'Slug existiert bereits — übersprungen.',
      });
      continue;
    }
    if (row.status === 'invalid' || !row.parseResult.ok) {
      const issues = row.parseResult.ok ? [] : row.parseResult.issues;
      results.push({
        filename: row.filename,
        ok: false,
        status: 'invalid',
        error: issues.map((i) => i.message).join('; ') || 'Ungültig',
      });
      continue;
    }

    const fm = row.parseResult.article.frontmatter;
    const sections = row.parseResult.article.sections;
    const allWarnings = [...row.parseResult.article.warnings];

    try {
      const authorMatch = matchAuthors(fm.authors ?? [], userPool);
      allWarnings.push(...authorMatch.warnings);

      const data: Record<string, unknown> = {
        title: fm.title,
        slug: row.resolvedSlug,
        intent: fm.intent,
        summary: fm.summary,
        standardsBound: fm.standardsBound ?? false,
        definition: markdownToLexical(sections.definition),
        praxis: markdownToLexical(sections.praxis),
        risiken: markdownToLexical(sections.risiken),
        quellen: markdownToLexical(sections.quellen),
        status: 'draft',
      };
      if (authorMatch.matched.length > 0) data.authors = authorMatch.matched;
      if (fm.lastReviewedAt) data.lastReviewedAt = fm.lastReviewedAt;

      const created = await payload.create({
        collection: 'articles',
        data: data as never,
        overrideAccess: true,
      });

      await writeAuditLog(payload, {
        eventType: 'article.bulk_import',
        actor: userId,
        metadata: {
          articleId: created.id,
          filename: row.filename,
          sourceHash: row.sourceHash,
        },
      });

      results.push({
        filename: row.filename,
        ok: true,
        status: 'created',
        articleId: created.id as number,
        adminUrl: `${baseUrl}/admin/collections/articles/${created.id}`,
        warnings: allWarnings.length > 0 ? allWarnings : undefined,
      });
    } catch (err) {
      results.push({
        filename: row.filename,
        ok: false,
        status: row.status,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
