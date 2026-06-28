# Articles Bulk-Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editor:innen können mehrere Artikel per Drag&Drop von `.md`-Dateien (oder einem `.zip`) im Admin-Panel auf einmal als `draft` anlegen — Format = das bestehende `renderArticleMarkdown`-Format.

**Architecture:** Payload Custom-View unter `/admin/articles-import`, registriert via `admin.components.views`. Zwei Server-Actions (Dry-Run-Parse und tatsächlicher Import). Reiner Parser ohne Payload-Dependency (`src/lib/article-import/`). Markdown→Lexical via handgeschriebenem Mini-Parser für unsere unterstützten Knoten (Paragraph/Bold/Italic/Link/UL/OL/Heading). Audit-Log-Event pro angelegtem Artikel.

**Tech Stack:** Payload 3.85 + Next.js 16 App Router, Lexical 0.41, `js-yaml` (vorhanden), `yauzl` (neu, für ZIP), Vitest, React-Testing-Library.

**Referenz-Spec:** `docs/superpowers/specs/2026-06-28-pflegeatlas-articles-bulk-import-design.md`

---

## File Structure

**Modify:**
- `src/lib/auth-permissions.ts` — neue Action `bulkImport`
- `src/lib/audit-log.ts` — neuer Event-Typ `article.bulk_import`
- `src/payload.config.ts` — Custom-View registrieren + Nav-Link
- `package.json` / `pnpm-lock.yaml` — `yauzl` als dependency
- `src/app/(payload)/admin/importMap.js` — wird durch `payload generate:importmap` neu erzeugt

**Create:**
- `src/lib/article-import/types.ts`
- `src/lib/article-import/parse-frontmatter.ts`
- `src/lib/article-import/split-sections.ts`
- `src/lib/article-import/markdown-to-lexical.ts`
- `src/lib/article-import/parse-markdown-article.ts` (orchestrator)
- `src/lib/article-import/match-author.ts`
- `src/lib/article-import/unzip-bundle.ts`
- `src/components/admin/BulkArticleImport.server.tsx`
- `src/components/admin/BulkArticleImport.tsx` (Client)
- `src/components/admin/BulkArticleImportNavLink.server.tsx`
- `src/components/admin/bulk-import-actions.ts` (Server Actions)
- `docs/examples/bulk-import-sample.md`

**Test-Files (mirroring source):**
- `tests/unit/article-import/parse-frontmatter.test.ts`
- `tests/unit/article-import/split-sections.test.ts`
- `tests/unit/article-import/markdown-to-lexical.test.ts`
- `tests/unit/article-import/parse-markdown-article.test.ts`
- `tests/unit/article-import/match-author.test.ts`
- `tests/unit/article-import/unzip-bundle.test.ts`
- `tests/integration/articles-bulk-import-action.test.ts`
- `tests/component/BulkArticleImport.test.tsx`

---

## Task 1: Permission-Action `bulkImport` + Audit-Event-Typ

**Files:**
- Modify: `src/lib/auth-permissions.ts`
- Modify: `src/lib/audit-log.ts`
- Test: `tests/unit/auth-permissions.test.ts` (existiert; ergänzen)

- [ ] **Step 1: Write failing test for new permission**

Add to `tests/unit/auth-permissions.test.ts` (vor dem letzten `});` der `describe`):

```typescript
describe('bulkImport permission', () => {
  it('allows admin', () => {
    expect(hasRolePermission('admin', 'bulkImport', 'articles')).toBe(true);
  });
  it('allows editor', () => {
    expect(hasRolePermission('editor', 'bulkImport', 'articles')).toBe(true);
  });
  it('denies reviewer', () => {
    expect(hasRolePermission('reviewer', 'bulkImport', 'articles')).toBe(false);
  });
  it('denies contributor', () => {
    expect(hasRolePermission('contributor', 'bulkImport', 'articles')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/auth-permissions.test.ts`
Expected: TS compile error oder FAIL because `'bulkImport'` is not in `Action` type.

- [ ] **Step 3: Extend Action type and PERMISSIONS map**

In `src/lib/auth-permissions.ts`, add `'bulkImport'` to the `Action` union (in the `// articles`-Block, nach `'delete'`):

```typescript
  | 'delete'
  | 'bulkImport'
```

Then add `'bulkImport'` to `PERMISSIONS.admin` and `PERMISSIONS.editor` arrays (after `'delete'` for admin, after `'archive'` for editor — at the end of the articles permissions block in each role):

```typescript
  admin: s(
    'read', 'readAllStati', 'createArticle', 'updateContent',
    'transitionToReview', 'transitionToReadyToPublish', 'publish', 'archive', 'delete',
    'bulkImport',
    // … rest unchanged …
  ),
  editor: s(
    'read', 'readAllStati', 'createArticle', 'updateContent',
    'transitionToReview', 'transitionToReadyToPublish', 'publish', 'archive',
    'bulkImport',
    // … rest unchanged …
  ),
```

- [ ] **Step 4: Write failing test for new audit event type**

Add to `tests/unit/audit-log.test.ts`:

```typescript
describe('article.bulk_import event type', () => {
  it('is included in AUDIT_EVENT_TYPES', () => {
    expect(AUDIT_EVENT_TYPES).toContain('article.bulk_import');
  });
});
```

- [ ] **Step 5: Run audit-log test to verify it fails**

Run: `pnpm test tests/unit/audit-log.test.ts`
Expected: FAIL with assertion mismatch.

- [ ] **Step 6: Extend AUDIT_EVENT_TYPES**

In `src/lib/audit-log.ts`, add `'article.bulk_import'` at the end of the `AUDIT_EVENT_TYPES` array (before the closing `] as const`):

```typescript
export const AUDIT_EVENT_TYPES = [
  // … existing entries …
  'audit.cleanup.run',
  'article.bulk_import',
] as const;
```

- [ ] **Step 7: Run both test files**

Run: `pnpm test tests/unit/auth-permissions.test.ts tests/unit/audit-log.test.ts`
Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth-permissions.ts src/lib/audit-log.ts tests/unit/auth-permissions.test.ts tests/unit/audit-log.test.ts
git commit -m "feat(articles): add bulkImport permission and article.bulk_import audit event"
```

---

## Task 2: Types module (`src/lib/article-import/types.ts`)

**Files:**
- Create: `src/lib/article-import/types.ts`

- [ ] **Step 1: Create the types file**

Pure type definitions — no logic, no test needed (TS enforces shape).

`src/lib/article-import/types.ts`:

```typescript
export type IssueCode =
  | 'frontmatter-parse-error'
  | 'title-missing'
  | 'intent-missing'
  | 'intent-invalid'
  | 'summary-missing'
  | 'summary-too-long'
  | 'section-missing'
  | 'section-empty'
  | 'file-too-large'
  | 'markdown-conversion-failed'
  | 'author-unknown'
  | 'frontmatter-unknown-field'
  | 'last-reviewed-at-invalid-format';

export type IssueSeverity = 'hard' | 'soft';

export interface ValidationIssue {
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  field?: string;
}

export type Intent = 'bedside' | 'background' | 'learning';

export interface ParsedArticleSections {
  definition: string; // raw markdown
  praxis: string;
  risiken: string;
  quellen: string;
}

export interface ParsedArticleFrontmatter {
  title: string;
  intent: Intent;
  summary: string;
  slug?: string;
  standardsBound?: boolean;
  authors?: string[];
  lastReviewedAt?: string;
}

export interface ParsedArticle {
  frontmatter: ParsedArticleFrontmatter;
  sections: ParsedArticleSections;
  warnings: ValidationIssue[];
}

export type ParseResult =
  | { ok: true; article: ParsedArticle }
  | { ok: false; issues: ValidationIssue[] };

export type ImportRowStatus = 'ready' | 'skip-duplicate' | 'invalid';

export interface ImportRow {
  filename: string;
  sourceHash: string; // SHA-256 hex
  status: ImportRowStatus;
  title: string; // best-effort, even for invalid rows
  resolvedSlug: string; // best-effort, may be ""
  parseResult: ParseResult;
}

export interface ImportResultRow {
  filename: string;
  ok: boolean;
  articleId?: number;
  adminUrl?: string;
  error?: string;
  status: ImportRowStatus | 'created';
  warnings?: ValidationIssue[];
}
```

- [ ] **Step 2: Verify TS compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/article-import/types.ts
git commit -m "feat(article-import): add shared type definitions"
```

---

## Task 3: `parse-frontmatter.ts`

**Files:**
- Create: `src/lib/article-import/parse-frontmatter.ts`
- Test: `tests/unit/article-import/parse-frontmatter.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/unit/article-import/parse-frontmatter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '@/lib/article-import/parse-frontmatter';

describe('parseFrontmatter', () => {
  it('extracts a valid frontmatter block and body', () => {
    const input = `---
title: Hello
intent: bedside
summary: A short summary.
---

## Definition

Body text.`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe('Hello');
    expect(result.data.intent).toBe('bedside');
    expect(result.data.summary).toBe('A short summary.');
    expect(result.body.trim().startsWith('## Definition')).toBe(true);
  });

  it('fails when no frontmatter block is present', () => {
    const result = parseFrontmatter('## Definition\n\nx');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].code).toBe('frontmatter-parse-error');
  });

  it('fails when title is missing', () => {
    const input = `---
intent: bedside
summary: x
---
## Definition
y`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'title-missing')).toBe(true);
  });

  it('fails when intent is invalid', () => {
    const input = `---
title: A
intent: foo
summary: x
---
## Definition
y`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'intent-invalid')).toBe(true);
  });

  it('fails when summary exceeds 280 chars', () => {
    const long = 'x'.repeat(281);
    const input = `---
title: A
intent: bedside
summary: ${long}
---
## Definition
y`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'summary-too-long')).toBe(true);
  });

  it('accepts optional fields and emits warnings for unknown keys', () => {
    const input = `---
title: A
intent: bedside
summary: ok
slug: custom-slug
standardsBound: true
authors:
  - Christoph Mueller
  - Oliver Wosnitza
lastReviewedAt: 2026-06-21
payloadId: 42
status: published
---
## Definition
y`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.slug).toBe('custom-slug');
    expect(result.data.standardsBound).toBe(true);
    expect(result.data.authors).toEqual(['Christoph Mueller', 'Oliver Wosnitza']);
    expect(result.data.lastReviewedAt).toBe('2026-06-21');
    expect(result.warnings.some((w) => w.field === 'payloadId')).toBe(true);
    expect(result.warnings.some((w) => w.field === 'status')).toBe(true);
  });

  it('emits soft warning for invalid lastReviewedAt format', () => {
    const input = `---
title: A
intent: bedside
summary: ok
lastReviewedAt: not-a-date
---
## Definition
y`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.lastReviewedAt).toBeUndefined();
    expect(
      result.warnings.some((w) => w.code === 'last-reviewed-at-invalid-format'),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/article-import/parse-frontmatter.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement parser**

`src/lib/article-import/parse-frontmatter.ts`:

```typescript
import yaml from 'js-yaml';
import type {
  Intent,
  ParsedArticleFrontmatter,
  ValidationIssue,
} from './types';

const VALID_INTENTS: Intent[] = ['bedside', 'background', 'learning'];
const KNOWN_KEYS = new Set([
  'title',
  'intent',
  'summary',
  'slug',
  'standardsBound',
  'authors',
  'lastReviewedAt',
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FrontmatterResult =
  | { ok: true; data: ParsedArticleFrontmatter; body: string; warnings: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[] };

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function hardIssue(code: ValidationIssue['code'], message: string, field?: string): ValidationIssue {
  return { code, severity: 'hard', message, field };
}

function softIssue(code: ValidationIssue['code'], message: string, field?: string): ValidationIssue {
  return { code, severity: 'soft', message, field };
}

export function parseFrontmatter(input: string): FrontmatterResult {
  const match = input.replace(/^﻿/, '').match(FRONT_MATTER_RE);
  if (!match) {
    return {
      ok: false,
      issues: [
        hardIssue('frontmatter-parse-error', 'Kein gültiger YAML-Frontmatter-Block am Dateianfang gefunden.'),
      ],
    };
  }

  const [, yamlBlock, body] = match;
  let parsed: unknown;
  try {
    parsed = yaml.load(yamlBlock, { schema: yaml.JSON_SCHEMA });
  } catch (err) {
    return {
      ok: false,
      issues: [
        hardIssue(
          'frontmatter-parse-error',
          `Frontmatter ist kein gültiges YAML: ${err instanceof Error ? err.message : String(err)}`,
        ),
      ],
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      issues: [hardIssue('frontmatter-parse-error', 'Frontmatter muss ein YAML-Objekt sein.')],
    };
  }

  const obj = parsed as Record<string, unknown>;
  const issues: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Required: title
  const title = typeof obj.title === 'string' ? obj.title.trim() : '';
  if (!title) issues.push(hardIssue('title-missing', 'Pflichtfeld `title` fehlt.', 'title'));

  // Required: intent
  const intentRaw = typeof obj.intent === 'string' ? obj.intent.trim() : '';
  if (!intentRaw) {
    issues.push(hardIssue('intent-missing', 'Pflichtfeld `intent` fehlt.', 'intent'));
  } else if (!VALID_INTENTS.includes(intentRaw as Intent)) {
    issues.push(
      hardIssue(
        'intent-invalid',
        `\`intent\` muss eine von ${VALID_INTENTS.join(', ')} sein (war: ${intentRaw}).`,
        'intent',
      ),
    );
  }

  // Required: summary
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  if (!summary) {
    issues.push(hardIssue('summary-missing', 'Pflichtfeld `summary` fehlt.', 'summary'));
  } else if (summary.length > 280) {
    issues.push(
      hardIssue(
        'summary-too-long',
        `\`summary\` darf max. 280 Zeichen haben (war: ${summary.length}).`,
        'summary',
      ),
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  // Optional fields
  const data: ParsedArticleFrontmatter = {
    title,
    intent: intentRaw as Intent,
    summary,
  };

  if (typeof obj.slug === 'string' && obj.slug.trim()) {
    data.slug = obj.slug.trim();
  }
  if (typeof obj.standardsBound === 'boolean') {
    data.standardsBound = obj.standardsBound;
  } else if (obj.standardsBound !== undefined) {
    warnings.push(
      softIssue(
        'frontmatter-unknown-field',
        `\`standardsBound\` ignoriert (kein Boolean): ${JSON.stringify(obj.standardsBound)}`,
        'standardsBound',
      ),
    );
  }
  if (Array.isArray(obj.authors)) {
    const authors = obj.authors.filter((a): a is string => typeof a === 'string');
    if (authors.length > 0) data.authors = authors;
  }
  if (typeof obj.lastReviewedAt === 'string') {
    if (ISO_DATE.test(obj.lastReviewedAt)) {
      data.lastReviewedAt = obj.lastReviewedAt;
    } else {
      warnings.push(
        softIssue(
          'last-reviewed-at-invalid-format',
          `\`lastReviewedAt\` ignoriert (kein YYYY-MM-DD-Datum): ${obj.lastReviewedAt}`,
          'lastReviewedAt',
        ),
      );
    }
  }

  // Soft-warn on unknown keys
  for (const key of Object.keys(obj)) {
    if (!KNOWN_KEYS.has(key)) {
      warnings.push(
        softIssue('frontmatter-unknown-field', `Unbekanntes Frontmatter-Feld \`${key}\` ignoriert.`, key),
      );
    }
  }

  return { ok: true, data, body, warnings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/article-import/parse-frontmatter.test.ts`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/article-import/parse-frontmatter.ts tests/unit/article-import/parse-frontmatter.test.ts
git commit -m "feat(article-import): add frontmatter parser with validation"
```

---

## Task 4: `split-sections.ts`

**Files:**
- Create: `src/lib/article-import/split-sections.ts`
- Test: `tests/unit/article-import/split-sections.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/unit/article-import/split-sections.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { splitSections } from '@/lib/article-import/split-sections';

describe('splitSections', () => {
  const valid = `
## Definition

Def body.

## Praxis

Prax body.

## Risiken & Fallstricke

Risk body.

## Quellen & Weiterführendes

Q body.
`;

  it('extracts all four sections in canonical case', () => {
    const result = splitSections(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sections.definition.trim()).toBe('Def body.');
    expect(result.sections.praxis.trim()).toBe('Prax body.');
    expect(result.sections.risiken.trim()).toBe('Risk body.');
    expect(result.sections.quellen.trim()).toBe('Q body.');
  });

  it('matches headings case-insensitively and trims', () => {
    const input = valid
      .replace('## Definition', '##   definition   ')
      .replace('## Praxis', '## PRAXIS');
    const result = splitSections(input);
    expect(result.ok).toBe(true);
  });

  it('reports missing section', () => {
    const input = valid.replace(/## Praxis[\s\S]*?(?=## Risiken)/, '');
    const result = splitSections(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.some((i) => i.code === 'section-missing' && i.field === 'praxis'),
    ).toBe(true);
  });

  it('reports empty section', () => {
    const input = valid.replace('Def body.', '   \n  \n');
    const result = splitSections(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.some((i) => i.code === 'section-empty' && i.field === 'definition'),
    ).toBe(true);
  });

  it('accepts sections in any order', () => {
    const reordered = `
## Quellen & Weiterführendes
q
## Risiken & Fallstricke
r
## Praxis
p
## Definition
d
`;
    const result = splitSections(reordered);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sections.definition.trim()).toBe('d');
    expect(result.sections.quellen.trim()).toBe('q');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/unit/article-import/split-sections.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement splitter**

`src/lib/article-import/split-sections.ts`:

```typescript
import type { ParsedArticleSections, ValidationIssue } from './types';

const SECTION_KEYS = ['definition', 'praxis', 'risiken', 'quellen'] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const HEADING_MAP: Record<string, SectionKey> = {
  definition: 'definition',
  praxis: 'praxis',
  'risiken & fallstricke': 'risiken',
  'quellen & weiterführendes': 'quellen',
};

const SECTION_LABEL: Record<SectionKey, string> = {
  definition: 'Definition',
  praxis: 'Praxis',
  risiken: 'Risiken & Fallstricke',
  quellen: 'Quellen & Weiterführendes',
};

export type SplitResult =
  | { ok: true; sections: ParsedArticleSections }
  | { ok: false; issues: ValidationIssue[] };

function normalizeHeading(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function splitSections(body: string): SplitResult {
  const lines = body.split(/\r?\n/);
  const headingIndices: Array<{ key: SectionKey; lineIndex: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+(.+?)\s*$/);
    if (!m) continue;
    const normalized = normalizeHeading(m[1]);
    const key = HEADING_MAP[normalized];
    if (key) headingIndices.push({ key, lineIndex: i });
  }

  const partial: Partial<Record<SectionKey, string>> = {};
  for (let h = 0; h < headingIndices.length; h++) {
    const { key, lineIndex } = headingIndices[h];
    const nextIndex =
      h + 1 < headingIndices.length ? headingIndices[h + 1].lineIndex : lines.length;
    partial[key] = lines.slice(lineIndex + 1, nextIndex).join('\n');
  }

  const issues: ValidationIssue[] = [];
  for (const key of SECTION_KEYS) {
    if (partial[key] === undefined) {
      issues.push({
        code: 'section-missing',
        severity: 'hard',
        message: `Sektion "## ${SECTION_LABEL[key]}" fehlt.`,
        field: key,
      });
    } else if (partial[key]!.trim() === '') {
      issues.push({
        code: 'section-empty',
        severity: 'hard',
        message: `Sektion "## ${SECTION_LABEL[key]}" ist leer.`,
        field: key,
      });
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    sections: {
      definition: partial.definition!,
      praxis: partial.praxis!,
      risiken: partial.risiken!,
      quellen: partial.quellen!,
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test tests/unit/article-import/split-sections.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/article-import/split-sections.ts tests/unit/article-import/split-sections.test.ts
git commit -m "feat(article-import): add section splitter with canonical-heading match"
```

---

## Task 5: `markdown-to-lexical.ts`

**Files:**
- Create: `src/lib/article-import/markdown-to-lexical.ts`
- Test: `tests/unit/article-import/markdown-to-lexical.test.ts`

**Scope:** Handgeschriebener Mini-Konverter für die Knoten, die das Article-Schema akzeptiert: paragraph, text (mit bold/italic), link, list (ul/ol), heading (h3/h4), quote. Tabellen, Images, HTML werden bewusst nicht unterstützt — der Test "drops unsupported" stellt sicher, dass sie kein Crash sind.

- [ ] **Step 1: Write failing tests**

`tests/unit/article-import/markdown-to-lexical.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { markdownToLexical } from '@/lib/article-import/markdown-to-lexical';

function root(children: unknown[]) {
  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      children,
    },
  };
}

describe('markdownToLexical', () => {
  it('returns empty root for empty input', () => {
    const result = markdownToLexical('');
    expect(result).toEqual(root([]));
  });

  it('converts a simple paragraph', () => {
    const result = markdownToLexical('Hello world.');
    const para = (result as { root: { children: Array<{ type: string; children: unknown[] }> } })
      .root.children[0];
    expect(para.type).toBe('paragraph');
    const text = para.children[0] as { text: string; type: string; format: number };
    expect(text.type).toBe('text');
    expect(text.text).toBe('Hello world.');
    expect(text.format).toBe(0);
  });

  it('handles bold and italic with bitmask format', () => {
    const result = markdownToLexical('**bold** and *italic* and ***both***');
    const para = (result as { root: { children: Array<{ children: Array<{ text: string; format: number }> }> } })
      .root.children[0];
    const segments = para.children;
    const findText = (txt: string) => segments.find((s) => s.text === txt);
    expect(findText('bold')!.format).toBe(1); // bold
    expect(findText('italic')!.format).toBe(2); // italic
    expect(findText('both')!.format).toBe(3); // bold | italic
  });

  it('converts links', () => {
    const result = markdownToLexical('See [docs](https://example.com) here.');
    const para = (result as { root: { children: Array<{ children: Array<{ type: string; url?: string; children?: Array<{ text: string }> }> }> } })
      .root.children[0];
    const link = para.children.find((c) => c.type === 'link');
    expect(link).toBeDefined();
    expect(link!.url).toBe('https://example.com');
    expect(link!.children![0].text).toBe('docs');
  });

  it('converts unordered lists', () => {
    const md = `- one\n- two\n- three`;
    const result = markdownToLexical(md);
    const list = (result as { root: { children: Array<{ type: string; listType?: string; children: unknown[] }> } })
      .root.children[0];
    expect(list.type).toBe('list');
    expect(list.listType).toBe('bullet');
    expect(list.children).toHaveLength(3);
  });

  it('converts ordered lists', () => {
    const md = `1. one\n2. two`;
    const result = markdownToLexical(md);
    const list = (result as { root: { children: Array<{ listType?: string; children: unknown[] }> } })
      .root.children[0];
    expect(list.listType).toBe('number');
    expect(list.children).toHaveLength(2);
  });

  it('converts headings level 3 and 4', () => {
    const md = `### Sub\n\n#### SubSub`;
    const result = markdownToLexical(md);
    const children = (result as { root: { children: Array<{ type: string; tag?: string }> } })
      .root.children;
    expect(children[0].type).toBe('heading');
    expect(children[0].tag).toBe('h3');
    expect(children[1].tag).toBe('h4');
  });

  it('drops unsupported elements (HTML, images) without crashing', () => {
    const md = `Para 1.\n\n<div>raw html</div>\n\n![alt](img.png)\n\nPara 2.`;
    const result = markdownToLexical(md);
    const children = (result as { root: { children: Array<{ type: string }> } }).root.children;
    // Two real paragraphs survive; HTML + image are dropped (or become empty paragraphs that get filtered)
    const paragraphs = children.filter((c) => c.type === 'paragraph');
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/unit/article-import/markdown-to-lexical.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement converter**

`src/lib/article-import/markdown-to-lexical.ts`:

```typescript
// Minimal markdown → Lexical converter, scope-limited to the node types
// the Article RichText schema accepts: paragraph, text(bold/italic), link,
// list(ul/ol), heading(h3/h4), quote. Anything else is dropped silently.
//
// Design choice: hand-rolled rather than @lexical/markdown to avoid the
// DOM/editor-instance dependency of the official converter in a Node-only
// server-action context.

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;

type LexicalNode = Record<string, unknown>;

interface BlockBuilder {
  build(lines: string[], start: number): { node: LexicalNode | null; consumed: number };
}

function makeText(text: string, format: number): LexicalNode {
  return {
    type: 'text',
    version: 1,
    text,
    format,
    detail: 0,
    mode: 'normal',
    style: '',
  };
}

function makeLink(url: string, children: LexicalNode[]): LexicalNode {
  return {
    type: 'link',
    version: 1,
    url,
    target: null,
    rel: null,
    fields: { url, newTab: false, linkType: 'custom' },
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
  };
}

function makeParagraph(children: LexicalNode[]): LexicalNode {
  return {
    type: 'paragraph',
    version: 1,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
  };
}

function makeHeading(tag: 'h3' | 'h4', children: LexicalNode[]): LexicalNode {
  return {
    type: 'heading',
    version: 1,
    tag,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
  };
}

function makeListItem(children: LexicalNode[], value: number): LexicalNode {
  return {
    type: 'listitem',
    version: 1,
    value,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
  };
}

function makeList(listType: 'bullet' | 'number', items: LexicalNode[]): LexicalNode {
  return {
    type: 'list',
    version: 1,
    listType,
    start: 1,
    tag: listType === 'bullet' ? 'ul' : 'ol',
    children: items,
    direction: 'ltr',
    format: '',
    indent: 0,
  };
}

function makeQuote(children: LexicalNode[]): LexicalNode {
  return {
    type: 'quote',
    version: 1,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
  };
}

// --- Inline parser --------------------------------------------------------

interface InlineState {
  format: number;
}

function parseInline(text: string): LexicalNode[] {
  return parseInlineWithState(text, { format: 0 });
}

function parseInlineWithState(text: string, state: InlineState): LexicalNode[] {
  const out: LexicalNode[] = [];
  let i = 0;
  let buf = '';

  const flushText = () => {
    if (buf.length > 0) {
      out.push(makeText(buf, state.format));
      buf = '';
    }
  };

  while (i < text.length) {
    // Bold+italic ***...***
    if (text.startsWith('***', i)) {
      const end = text.indexOf('***', i + 3);
      if (end > -1) {
        flushText();
        const inner = parseInlineWithState(text.slice(i + 3, end), {
          format: state.format | FORMAT_BOLD | FORMAT_ITALIC,
        });
        out.push(...inner);
        i = end + 3;
        continue;
      }
    }
    // Bold **...**
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end > -1) {
        flushText();
        const inner = parseInlineWithState(text.slice(i + 2, end), {
          format: state.format | FORMAT_BOLD,
        });
        out.push(...inner);
        i = end + 2;
        continue;
      }
    }
    // Italic *...*  (single asterisk, but not preceded by another `*`)
    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1);
      if (end > -1 && text[end - 1] !== '*' && text[end + 1] !== '*') {
        flushText();
        const inner = parseInlineWithState(text.slice(i + 1, end), {
          format: state.format | FORMAT_ITALIC,
        });
        out.push(...inner);
        i = end + 1;
        continue;
      }
    }
    // Link [label](url)
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket > -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen > -1) {
          flushText();
          const label = text.slice(i + 1, closeBracket);
          const url = text.slice(closeBracket + 2, closeParen);
          const labelNodes = parseInlineWithState(label, { format: state.format });
          out.push(makeLink(url, labelNodes));
          i = closeParen + 1;
          continue;
        }
      }
    }
    buf += text[i];
    i++;
  }
  flushText();
  return out;
}

// --- Block parser ---------------------------------------------------------

const HEADING_RE = /^(#{3,4})\s+(.+)$/;
const UL_RE = /^[-*]\s+(.+)$/;
const OL_RE = /^\d+\.\s+(.+)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const HTML_RE = /^<.*>$/;
const IMAGE_RE = /^!\[.*\]\(.*\)\s*$/;

function isUnsupported(line: string): boolean {
  const t = line.trim();
  return HTML_RE.test(t) || IMAGE_RE.test(t);
}

function consumeListLines(
  lines: string[],
  start: number,
  re: RegExp,
): { items: string[]; consumed: number } {
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(re);
    if (!m) break;
    items.push(m[1]);
    i++;
  }
  return { items, consumed: i - start };
}

function consumeQuoteLines(
  lines: string[],
  start: number,
): { text: string; consumed: number } {
  const parts: string[] = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(QUOTE_RE);
    if (!m) break;
    parts.push(m[1]);
    i++;
  }
  return { text: parts.join('\n'), consumed: i - start };
}

function consumeParagraphLines(
  lines: string[],
  start: number,
): { text: string; consumed: number } {
  const parts: string[] = [];
  let i = start;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === '') break;
    if (HEADING_RE.test(l) || UL_RE.test(l) || OL_RE.test(l) || QUOTE_RE.test(l)) break;
    if (isUnsupported(l)) break;
    parts.push(l);
    i++;
  }
  return { text: parts.join('\n'), consumed: i - start };
}

export function markdownToLexical(input: string): { root: LexicalNode } {
  const blocks: LexicalNode[] = [];
  const lines = input.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }
    if (isUnsupported(line)) {
      i++;
      continue;
    }
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const tag = level === 3 ? 'h3' : 'h4';
      blocks.push(makeHeading(tag, parseInline(headingMatch[2])));
      i++;
      continue;
    }
    if (UL_RE.test(line)) {
      const { items, consumed } = consumeListLines(lines, i, UL_RE);
      const lexItems = items.map((it, idx) => makeListItem(parseInline(it), idx + 1));
      blocks.push(makeList('bullet', lexItems));
      i += consumed;
      continue;
    }
    if (OL_RE.test(line)) {
      const { items, consumed } = consumeListLines(lines, i, OL_RE);
      const lexItems = items.map((it, idx) => makeListItem(parseInline(it), idx + 1));
      blocks.push(makeList('number', lexItems));
      i += consumed;
      continue;
    }
    if (QUOTE_RE.test(line)) {
      const { text, consumed } = consumeQuoteLines(lines, i);
      blocks.push(makeQuote([makeParagraph(parseInline(text))]));
      i += consumed;
      continue;
    }
    const { text, consumed } = consumeParagraphLines(lines, i);
    if (text.trim() !== '') {
      blocks.push(makeParagraph(parseInline(text)));
    }
    i += Math.max(consumed, 1);
  }

  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: blocks,
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test tests/unit/article-import/markdown-to-lexical.test.ts`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/article-import/markdown-to-lexical.ts tests/unit/article-import/markdown-to-lexical.test.ts
git commit -m "feat(article-import): add scoped markdown-to-lexical converter"
```

---

## Task 6: `parse-markdown-article.ts` (orchestrator)

**Files:**
- Create: `src/lib/article-import/parse-markdown-article.ts`
- Test: `tests/unit/article-import/parse-markdown-article.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/unit/article-import/parse-markdown-article.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseMarkdownArticle } from '@/lib/article-import/parse-markdown-article';

const happyPath = `---
title: Dekubitusprophylaxe
intent: bedside
summary: Wie man Druckgeschwüre erkennt und verhindert.
---

## Definition

Was Dekubitus ist.

## Praxis

**Wichtig:** Regelmäßig umlagern.

## Risiken & Fallstricke

- Reibung
- Scherkräfte

## Quellen & Weiterführendes

[Expertenstandard](https://example.com)
`;

describe('parseMarkdownArticle', () => {
  it('returns ok=true for a valid article', () => {
    const result = parseMarkdownArticle(happyPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.article.frontmatter.title).toBe('Dekubitusprophylaxe');
    expect(result.article.frontmatter.intent).toBe('bedside');
    expect(result.article.sections.definition).toContain('Was Dekubitus');
  });

  it('returns ok=false when frontmatter is invalid', () => {
    const result = parseMarkdownArticle('no frontmatter here');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'frontmatter-parse-error')).toBe(true);
  });

  it('returns ok=false when a section is missing', () => {
    const broken = happyPath.replace(/## Praxis[\s\S]*?(?=## Risiken)/, '');
    const result = parseMarkdownArticle(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'section-missing')).toBe(true);
  });

  it('carries frontmatter warnings into the result', () => {
    const withWarnings = happyPath.replace('---\n\n', '---\n').replace(
      'title: Dekubitusprophylaxe\n',
      'title: Dekubitusprophylaxe\npayloadId: 42\n',
    );
    const result = parseMarkdownArticle(withWarnings);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.article.warnings.some((w) => w.field === 'payloadId')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/unit/article-import/parse-markdown-article.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement orchestrator**

`src/lib/article-import/parse-markdown-article.ts`:

```typescript
import { parseFrontmatter } from './parse-frontmatter';
import { splitSections } from './split-sections';
import type { ParseResult } from './types';

export function parseMarkdownArticle(input: string): ParseResult {
  const fm = parseFrontmatter(input);
  if (!fm.ok) return { ok: false, issues: fm.issues };

  const sections = splitSections(fm.body);
  if (!sections.ok) return { ok: false, issues: sections.issues };

  return {
    ok: true,
    article: {
      frontmatter: fm.data,
      sections: sections.sections,
      warnings: fm.warnings,
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test tests/unit/article-import/parse-markdown-article.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/article-import/parse-markdown-article.ts tests/unit/article-import/parse-markdown-article.test.ts
git commit -m "feat(article-import): add parser orchestrator"
```

---

## Task 7: `match-author.ts`

**Files:**
- Create: `src/lib/article-import/match-author.ts`
- Test: `tests/unit/article-import/match-author.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/unit/article-import/match-author.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { matchAuthors } from '@/lib/article-import/match-author';

const users = [
  { id: 1, displayName: 'Christoph Mueller', email: 'c@x.de' },
  { id: 2, displayName: 'Oliver Wosnitza', email: 'o@x.de' },
  { id: 3, displayName: 'Oliver Wosnitza', email: 'o2@x.de' }, // duplicate displayName
];

describe('matchAuthors', () => {
  it('returns empty matches and no warnings for empty input', () => {
    const result = matchAuthors([], users);
    expect(result.matched).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('matches a unique displayName', () => {
    const result = matchAuthors(['Christoph Mueller'], users);
    expect(result.matched).toEqual([1]);
    expect(result.warnings).toEqual([]);
  });

  it('returns warning for unknown name', () => {
    const result = matchAuthors(['Unknown Person'], users);
    expect(result.matched).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe('author-unknown');
  });

  it('on duplicate match, picks first user-id and emits warning', () => {
    const result = matchAuthors(['Oliver Wosnitza'], users);
    expect(result.matched).toEqual([2]);
    expect(result.warnings.some((w) => w.code === 'author-unknown')).toBe(true);
  });

  it('mixes matched and unmatched', () => {
    const result = matchAuthors(['Christoph Mueller', 'Unknown'], users);
    expect(result.matched).toEqual([1]);
    expect(result.warnings).toHaveLength(1);
  });

  it('compares case-insensitively after trim', () => {
    const result = matchAuthors(['  christoph mueller  '], users);
    expect(result.matched).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/unit/article-import/match-author.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement matcher**

`src/lib/article-import/match-author.ts`:

```typescript
import type { ValidationIssue } from './types';

export interface KnownUser {
  id: number;
  displayName: string | null;
  email: string;
}

export interface AuthorMatchResult {
  matched: number[];
  warnings: ValidationIssue[];
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export function matchAuthors(names: string[], users: KnownUser[]): AuthorMatchResult {
  const matched: number[] = [];
  const warnings: ValidationIssue[] = [];

  for (const name of names) {
    const needle = normalize(name);
    if (!needle) continue;

    const hits = users.filter(
      (u) => u.displayName && normalize(u.displayName) === needle,
    );

    if (hits.length === 0) {
      warnings.push({
        code: 'author-unknown',
        severity: 'soft',
        message: `Autor:in "${name}" konnte keinem User zugeordnet werden — Feld bleibt leer.`,
        field: 'authors',
      });
      continue;
    }
    if (hits.length > 1) {
      warnings.push({
        code: 'author-unknown',
        severity: 'soft',
        message: `Autor:in-Name "${name}" ist mehrdeutig (${hits.length} User mit gleichem Display-Namen) — ersten genommen.`,
        field: 'authors',
      });
    }
    matched.push(hits[0].id);
  }

  return { matched, warnings };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test tests/unit/article-import/match-author.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/article-import/match-author.ts tests/unit/article-import/match-author.test.ts
git commit -m "feat(article-import): add display-name to user-id matcher"
```

---

## Task 8: `unzip-bundle.ts`

**Files:**
- Modify: `package.json` (add `yauzl` dependency)
- Create: `src/lib/article-import/unzip-bundle.ts`
- Test: `tests/unit/article-import/unzip-bundle.test.ts`

- [ ] **Step 1: Install yauzl**

Run from repo root:
```bash
pnpm add yauzl
pnpm add -D @types/yauzl
```
Expected: lockfile updated, no install errors.

- [ ] **Step 2: Write failing tests**

`tests/unit/article-import/unzip-bundle.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { unzipBundle, UnzipLimits } from '@/lib/article-import/unzip-bundle';
import yauzl from 'yauzl';

const limits: UnzipLimits = {
  maxEntries: 50,
  maxFileBytes: 256 * 1024,
  maxTotalBytes: 5 * 1024 * 1024,
};

// Helper: build an in-memory zip via streams. We use a tiny purpose-built
// builder rather than pulling in archiver — yauzl's "buffer" companion
// `yazl` is the canonical writer, install on demand.
async function makeZip(entries: Array<{ name: string; content: string }>): Promise<Buffer> {
  const yazl = (await import('yazl')).default ?? (await import('yazl'));
  const zip = new (yazl as { ZipFile: new () => unknown }).ZipFile() as {
    addBuffer: (buf: Buffer, name: string) => void;
    end: () => void;
    outputStream: NodeJS.ReadableStream;
  };
  for (const e of entries) {
    zip.addBuffer(Buffer.from(e.content, 'utf8'), e.name);
  }
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

describe('unzipBundle', () => {
  it('extracts .md files and returns content', async () => {
    const buf = await makeZip([
      { name: 'a.md', content: '# A' },
      { name: 'b.md', content: '# B' },
    ]);
    const result = await unzipBundle(buf, limits);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files).toHaveLength(2);
    expect(result.files.map((f) => f.filename).sort()).toEqual(['a.md', 'b.md']);
  });

  it('rejects non-.md files (silent skip)', async () => {
    const buf = await makeZip([
      { name: 'a.md', content: '# A' },
      { name: 'b.txt', content: 'ignored' },
    ]);
    const result = await unzipBundle(buf, limits);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files).toHaveLength(1);
  });

  it('rejects path traversal entries', async () => {
    const buf = await makeZip([{ name: '../etc/passwd.md', content: 'x' }]);
    const result = await unzipBundle(buf, limits);
    expect(result.ok).toBe(false);
  });

  it('rejects when entry count exceeds maxEntries', async () => {
    const entries = Array.from({ length: 51 }, (_, i) => ({
      name: `f${i}.md`,
      content: 'x',
    }));
    const buf = await makeZip(entries);
    const result = await unzipBundle(buf, limits);
    expect(result.ok).toBe(false);
  });

  it('rejects when a single file exceeds maxFileBytes', async () => {
    const tooBig = 'x'.repeat(limits.maxFileBytes + 1);
    const buf = await makeZip([{ name: 'big.md', content: tooBig }]);
    const result = await unzipBundle(buf, limits);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Install yazl as dev-dependency (test-only)**

```bash
pnpm add -D yazl @types/yazl
```

- [ ] **Step 4: Run to verify failure**

Run: `pnpm test tests/unit/article-import/unzip-bundle.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 5: Implement unzipBundle**

`src/lib/article-import/unzip-bundle.ts`:

```typescript
import yauzl from 'yauzl';

export interface UnzipLimits {
  maxEntries: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export interface ExtractedFile {
  filename: string; // basename only (no directory components)
  content: string; // utf-8 decoded
}

export type UnzipResult =
  | { ok: true; files: ExtractedFile[] }
  | { ok: false; error: string };

function isSafePath(name: string): boolean {
  // Reject path traversal, absolute paths, and any directory component.
  // We only accept basenames like "a.md" — files in subdirectories are
  // silently skipped (no recursion into the zip tree).
  if (name.includes('..')) return false;
  if (name.startsWith('/') || name.match(/^[a-zA-Z]:[\\/]/)) return false;
  return true;
}

function isMarkdown(name: string): boolean {
  return /\.md$/i.test(name);
}

export async function unzipBundle(buffer: Buffer, limits: UnzipLimits): Promise<UnzipResult> {
  return new Promise((resolve) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) {
        resolve({ ok: false, error: `ZIP konnte nicht gelesen werden: ${err?.message ?? 'unbekannt'}` });
        return;
      }
      const files: ExtractedFile[] = [];
      let entryCount = 0;
      let totalBytes = 0;
      let aborted = false;

      const abort = (msg: string) => {
        if (aborted) return;
        aborted = true;
        zip.close();
        resolve({ ok: false, error: msg });
      };

      zip.on('entry', (entry) => {
        if (aborted) return;
        entryCount++;
        if (entryCount > limits.maxEntries) {
          abort(`ZIP enthält mehr als ${limits.maxEntries} Einträge.`);
          return;
        }
        if (!isSafePath(entry.fileName)) {
          abort(`Pfad-Traversal im ZIP entdeckt: "${entry.fileName}"`);
          return;
        }
        // Directory entry or non-md file → skip silently
        if (entry.fileName.endsWith('/') || !isMarkdown(entry.fileName)) {
          zip.readEntry();
          return;
        }
        if (entry.uncompressedSize > limits.maxFileBytes) {
          abort(`Datei "${entry.fileName}" überschreitet das Limit von ${limits.maxFileBytes} Bytes.`);
          return;
        }
        totalBytes += entry.uncompressedSize;
        if (totalBytes > limits.maxTotalBytes) {
          abort(`ZIP-Gesamtgröße überschreitet ${limits.maxTotalBytes} Bytes.`);
          return;
        }
        zip.openReadStream(entry, (rsErr, stream) => {
          if (rsErr || !stream) {
            abort(`Konnte Eintrag "${entry.fileName}" nicht lesen.`);
            return;
          }
          const chunks: Buffer[] = [];
          stream.on('data', (c: Buffer) => chunks.push(c));
          stream.on('end', () => {
            const basename = entry.fileName.split('/').pop()!;
            files.push({ filename: basename, content: Buffer.concat(chunks).toString('utf8') });
            zip.readEntry();
          });
          stream.on('error', (e: Error) => abort(`Lesefehler in "${entry.fileName}": ${e.message}`));
        });
      });
      zip.on('end', () => {
        if (!aborted) resolve({ ok: true, files });
      });
      zip.on('error', (e) => abort(`ZIP-Lesefehler: ${e.message}`));
      zip.readEntry();
    });
  });
}
```

- [ ] **Step 6: Run to verify pass**

Run: `pnpm test tests/unit/article-import/unzip-bundle.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/article-import/unzip-bundle.ts tests/unit/article-import/unzip-bundle.test.ts package.json pnpm-lock.yaml
git commit -m "feat(article-import): add zip extractor with traversal protection and size limits"
```

---

## Task 9: Server Actions (`bulk-import-actions.ts`)

**Files:**
- Create: `src/components/admin/bulk-import-actions.ts`
- Test: `tests/integration/articles-bulk-import-action.test.ts`

**Note on placement:** Server actions co-located with the admin component, matching the existing pattern from `src/app/(payload)/admin/submission-actions.ts`. Living next to the UI component that uses them keeps the import-graph local.

- [ ] **Step 1: Write failing integration tests**

`tests/integration/articles-bulk-import-action.test.ts`:

```typescript
import 'dotenv/config';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { parseFilesPure, runImportPure } from '@/components/admin/bulk-import-actions';
import { createHash } from 'crypto';

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
        definition: { root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 } },
        praxis: { root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 } },
        risiken: { root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 } },
        quellen: { root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 } },
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
    const audit = audits.docs[0] as { metadata: { filename: string; articleId: number } };
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
        definition: { root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 } },
        praxis: { root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 } },
        risiken: { root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 } },
        quellen: { root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 } },
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
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/integration/articles-bulk-import-action.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement actions module**

`src/components/admin/bulk-import-actions.ts`:

```typescript
'use server';

import 'server-only';
import { createHash } from 'crypto';
import type { Payload } from 'payload';
import { getPayloadClient } from '@/lib/payload';
import { getSession } from '@/lib/auth';
import { hasRolePermission } from '@/lib/auth-permissions';
import { writeAuditLog } from '@/lib/audit-log';
import { slugify } from '@/lib/slugify';
import { parseMarkdownArticle } from '@/lib/article-import/parse-markdown-article';
import { markdownToLexical } from '@/lib/article-import/markdown-to-lexical';
import { matchAuthors, type KnownUser } from '@/lib/article-import/match-author';
import { unzipBundle } from '@/lib/article-import/unzip-bundle';
import type {
  ImportRow,
  ImportResultRow,
  ParseResult,
  ValidationIssue,
} from '@/lib/article-import/types';

const MAX_FILES = 50;
const MAX_FILE_BYTES = 256 * 1024;
const UNZIP_LIMITS = {
  maxEntries: 50,
  maxFileBytes: MAX_FILE_BYTES,
  maxTotalBytes: 5 * 1024 * 1024,
};

async function assertPermission(): Promise<{ userId: number }> {
  const session = await getSession();
  if (!session) throw new Error('Nicht angemeldet.');
  if (session.disabled) throw new Error('Account ist deaktiviert.');
  if (!hasRolePermission(session.role, 'bulkImport', 'articles')) {
    throw new Error('Keine Berechtigung für Bulk-Import.');
  }
  return { userId: session.id };
}

interface RawFile {
  filename: string;
  content: string;
}

async function readUploads(formData: FormData): Promise<RawFile[]> {
  const files: RawFile[] = [];
  const entries = formData.getAll('files');
  for (const entry of entries) {
    if (!(entry instanceof File)) continue;
    if (files.length >= MAX_FILES) {
      throw new Error(`Mehr als ${MAX_FILES} Dateien sind nicht erlaubt.`);
    }
    const buf = Buffer.from(await entry.arrayBuffer());
    if (entry.name.toLowerCase().endsWith('.zip')) {
      const result = await unzipBundle(buf, UNZIP_LIMITS);
      if (!result.ok) throw new Error(`ZIP "${entry.name}": ${result.error}`);
      for (const f of result.files) {
        if (files.length >= MAX_FILES) {
          throw new Error(`Mehr als ${MAX_FILES} Dateien (nach ZIP-Entpacken) sind nicht erlaubt.`);
        }
        files.push(f);
      }
      continue;
    }
    if (buf.byteLength > MAX_FILE_BYTES) {
      // Inject a synthetic invalid-row so the user sees it instead of an exception.
      files.push({ filename: entry.name, content: '__TOO_LARGE__' });
      continue;
    }
    files.push({ filename: entry.name, content: buf.toString('utf8') });
  }
  return files;
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
    if (file.content === '__TOO_LARGE__') {
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
    const usersRes = await payload.find({
      collection: 'users',
      where: { disabled: { equals: false } },
      limit: 500,
      depth: 0,
    });
    userPool = (usersRes.docs as Array<{ id: number; displayName?: string | null; email: string }>).map(
      (u) => ({ id: u.id, displayName: u.displayName ?? null, email: u.email }),
    );
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

// --- Server actions (FormData entry points) -------------------------------

export async function parseFilesAction(formData: FormData): Promise<ImportRow[]> {
  await assertPermission();
  const payload = await getPayloadClient();
  const files = await readUploads(formData);
  return parseFilesPure(payload, files);
}

export async function runImportAction(rows: ImportRow[]): Promise<ImportResultRow[]> {
  const { userId } = await assertPermission();
  const payload = await getPayloadClient();
  return runImportPure(payload, userId, rows);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test tests/integration/articles-bulk-import-action.test.ts`
Expected: All tests PASS (requires running Postgres — see project README for setup).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/bulk-import-actions.ts tests/integration/articles-bulk-import-action.test.ts
git commit -m "feat(articles): add bulk-import server actions with audit-log integration"
```

---

## Task 10: Client UI Component

**Files:**
- Create: `src/components/admin/BulkArticleImport.tsx` (Client)
- Test: `tests/component/BulkArticleImport.test.tsx`

- [ ] **Step 1: Write failing component tests**

`tests/component/BulkArticleImport.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkArticleImport } from '@/components/admin/BulkArticleImport';
import type { ImportRow, ImportResultRow } from '@/lib/article-import/types';

const sampleRow: ImportRow = {
  filename: 'a.md',
  sourceHash: 'abc',
  status: 'ready',
  title: 'Test',
  resolvedSlug: 'test',
  parseResult: {
    ok: true,
    article: {
      frontmatter: { title: 'Test', intent: 'bedside', summary: 'x' },
      sections: { definition: 'd', praxis: 'p', risiken: 'r', quellen: 'q' },
      warnings: [],
    },
  },
};

const sampleResult: ImportResultRow = {
  filename: 'a.md',
  ok: true,
  status: 'created',
  articleId: 42,
  adminUrl: '/admin/collections/articles/42',
};

describe('BulkArticleImport', () => {
  let parseFilesAction: ReturnType<typeof vi.fn>;
  let runImportAction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    parseFilesAction = vi.fn().mockResolvedValue([sampleRow]);
    runImportAction = vi.fn().mockResolvedValue([sampleResult]);
  });

  it('renders the idle state with drag-drop zone', () => {
    render(
      <BulkArticleImport parseFilesAction={parseFilesAction} runImportAction={runImportAction} />,
    );
    expect(screen.getByText(/dateien hier ablegen/i)).toBeInTheDocument();
  });

  it('transitions to preview after file selection', async () => {
    render(
      <BulkArticleImport parseFilesAction={parseFilesAction} runImportAction={runImportAction} />,
    );
    const file = new File(['---\ntitle: x\n---'], 'a.md', { type: 'text/markdown' });
    const input = screen.getByTestId('bulk-import-file-input');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('Test')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /import bestätigen/i })).not.toBeDisabled();
  });

  it('shows results table after confirming import', async () => {
    render(
      <BulkArticleImport parseFilesAction={parseFilesAction} runImportAction={runImportAction} />,
    );
    const file = new File(['---\ntitle: x\n---'], 'a.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByTestId('bulk-import-file-input'), {
      target: { files: [file] },
    });
    await waitFor(() => screen.getByRole('button', { name: /import bestätigen/i }));
    fireEvent.click(screen.getByRole('button', { name: /import bestätigen/i }));
    await waitFor(() => expect(screen.getByText(/angelegt/i)).toBeInTheDocument());
    expect(runImportAction).toHaveBeenCalledTimes(1);
  });

  it('disables confirm button when no ready rows present', async () => {
    parseFilesAction.mockResolvedValueOnce([
      { ...sampleRow, status: 'invalid', parseResult: { ok: false, issues: [] } },
    ]);
    render(
      <BulkArticleImport parseFilesAction={parseFilesAction} runImportAction={runImportAction} />,
    );
    const file = new File(['x'], 'a.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByTestId('bulk-import-file-input'), {
      target: { files: [file] },
    });
    await waitFor(() => screen.getByRole('button', { name: /import bestätigen/i }));
    expect(screen.getByRole('button', { name: /import bestätigen/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test tests/component/BulkArticleImport.test.tsx`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement client component**

`src/components/admin/BulkArticleImport.tsx`:

```typescript
'use client';

import { useState, useRef, useTransition } from 'react';
import type { ImportRow, ImportResultRow } from '@/lib/article-import/types';

type Phase = 'idle' | 'parsing' | 'preview' | 'importing' | 'result';

interface Props {
  parseFilesAction: (formData: FormData) => Promise<ImportRow[]>;
  runImportAction: (rows: ImportRow[]) => Promise<ImportResultRow[]>;
}

const STATUS_LABEL: Record<string, string> = {
  ready: '✅ neu',
  'skip-duplicate': '⚠️ Slug existiert',
  invalid: '❌ Validierungsfehler',
  created: '✅ angelegt',
};

export function BulkArticleImport({ parseFilesAction, runImportAction }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ImportResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append('files', f);
    setPhase('parsing');
    setError(null);
    startTransition(async () => {
      try {
        const parsedRows = await parseFilesAction(fd);
        setRows(parsedRows);
        setPhase('preview');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Parsen');
        setPhase('idle');
      }
    });
  };

  const onConfirmImport = () => {
    setPhase('importing');
    startTransition(async () => {
      try {
        const res = await runImportAction(rows);
        setResults(res);
        setPhase('result');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Import');
        setPhase('preview');
      }
    });
  };

  const onReset = () => {
    setRows([]);
    setResults([]);
    setError(null);
    setOpenDetails(new Set());
    setPhase('idle');
    if (inputRef.current) inputRef.current.value = '';
  };

  const toggleDetails = (filename: string) => {
    setOpenDetails((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const readyCount = rows.filter((r) => r.status === 'ready').length;

  if (phase === 'idle' || phase === 'parsing') {
    return (
      <div className="bulk-import" data-phase={phase}>
        <h1>Artikel-Bulk-Import</h1>
        <p>
          Lade mehrere <code>.md</code>-Dateien (oder ein <code>.zip</code>) hoch.
          Max 50 Dateien, je ≤ 256 KB. Importierte Artikel landen als
          <strong> Entwurf</strong> und durchlaufen den normalen Editorial-Workflow.
        </p>
        <label
          htmlFor="bulk-import-file"
          style={{
            display: 'block',
            border: '2px dashed var(--theme-elevation-300, #ccc)',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            borderRadius: '8px',
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFilesSelected(e.dataTransfer.files);
          }}
        >
          {phase === 'parsing' ? 'Lese Dateien…' : 'Dateien hier ablegen oder klicken zum Auswählen'}
        </label>
        <input
          ref={inputRef}
          id="bulk-import-file"
          data-testid="bulk-import-file-input"
          type="file"
          multiple
          accept=".md,.zip"
          hidden
          onChange={(e) => onFilesSelected(e.target.files)}
        />
        {error && <p style={{ color: 'var(--theme-error-500, #c00)' }}>{error}</p>}
      </div>
    );
  }

  if (phase === 'preview' || phase === 'importing') {
    return (
      <div className="bulk-import" data-phase={phase}>
        <h1>Vorschau ({rows.length} Datei{rows.length === 1 ? '' : 'en'})</h1>
        <p>{readyCount} Artikel werden importiert.</p>
        {error && <p style={{ color: 'var(--theme-error-500, #c00)' }}>{error}</p>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Datei</th>
              <th align="left">Titel</th>
              <th align="left">Slug</th>
              <th align="left">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PreviewRow
                key={row.filename}
                row={row}
                open={openDetails.has(row.filename)}
                onToggle={() => toggleDetails(row.filename)}
              />
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={onConfirmImport} disabled={readyCount === 0 || phase === 'importing'}>
            {phase === 'importing' ? 'Importiere…' : `Import bestätigen (${readyCount})`}
          </button>
          <button type="button" onClick={onReset}>Abbrechen</button>
        </div>
      </div>
    );
  }

  // result
  return (
    <div className="bulk-import" data-phase="result">
      <h1>Ergebnis</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Datei</th>
            <th align="left">Status</th>
            <th align="left">Details</th>
          </tr>
        </thead>
        <tbody>
          {results.map((res) => (
            <tr key={res.filename}>
              <td>{res.filename}</td>
              <td>{STATUS_LABEL[res.status] ?? res.status}</td>
              <td>
                {res.adminUrl ? (
                  <a href={res.adminUrl}>Artikel öffnen</a>
                ) : res.error ? (
                  <span>{res.error}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={onReset} style={{ marginTop: '1rem' }}>
        Neuen Import starten
      </button>
    </div>
  );
}

function PreviewRow({ row, open, onToggle }: {
  row: ImportRow;
  open: boolean;
  onToggle: () => void;
}) {
  const issues = row.parseResult.ok ? row.parseResult.article.warnings : row.parseResult.issues;
  return (
    <>
      <tr>
        <td><code>{row.filename}</code></td>
        <td>{row.title || '—'}</td>
        <td><code>{row.resolvedSlug || '—'}</code></td>
        <td>{STATUS_LABEL[row.status] ?? row.status}</td>
        <td>
          <button type="button" onClick={onToggle} aria-expanded={open}>
            {open ? 'Schließen' : 'Details'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5}>
            {issues.length === 0 ? (
              <em>Keine Auffälligkeiten.</em>
            ) : (
              <ul>
                {issues.map((i, idx) => (
                  <li key={idx}>
                    <strong>{i.severity === 'hard' ? 'Fehler' : 'Warnung'}:</strong>{' '}
                    {i.message}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test tests/component/BulkArticleImport.test.tsx`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/BulkArticleImport.tsx tests/component/BulkArticleImport.test.tsx
git commit -m "feat(articles): add bulk-import client UI with preview and result phases"
```

---

## Task 11: Server Wrapper Component + Nav Link

**Files:**
- Create: `src/components/admin/BulkArticleImport.server.tsx`
- Create: `src/components/admin/BulkArticleImportNavLink.server.tsx`

No tests for these — they are thin wrappers: server-component performs the role gate and passes server actions as props; nav-link renders nothing for unauthorised users.

- [ ] **Step 1: Implement server wrapper**

`src/components/admin/BulkArticleImport.server.tsx`:

```typescript
import 'server-only';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { hasRolePermission } from '@/lib/auth-permissions';
import { BulkArticleImport } from './BulkArticleImport';
import { parseFilesAction, runImportAction } from './bulk-import-actions';

export async function BulkArticleImportServer() {
  const session = await getSession();
  if (!session || session.disabled) {
    redirect('/admin/login');
  }
  if (!hasRolePermission(session.role, 'bulkImport', 'articles')) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Kein Zugriff</h1>
        <p>Bulk-Import ist nur für Editor:innen und Admins zugänglich.</p>
      </div>
    );
  }
  return (
    <BulkArticleImport
      parseFilesAction={parseFilesAction}
      runImportAction={runImportAction}
    />
  );
}
```

- [ ] **Step 2: Implement nav-link server component**

`src/components/admin/BulkArticleImportNavLink.server.tsx`:

```typescript
import 'server-only';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { hasRolePermission } from '@/lib/auth-permissions';

export async function BulkArticleImportNavLink() {
  const session = await getSession();
  if (!session || session.disabled) return null;
  if (!hasRolePermission(session.role, 'bulkImport', 'articles')) return null;
  return (
    <Link
      href="/admin/articles-import"
      style={{
        display: 'block',
        padding: '0.5rem 1rem',
        fontSize: '0.9rem',
      }}
    >
      📥 Artikel-Bulk-Import
    </Link>
  );
}
```

- [ ] **Step 3: Verify TS compiles**

Run: `pnpm tsc --noEmit -p tsconfig.json`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/BulkArticleImport.server.tsx src/components/admin/BulkArticleImportNavLink.server.tsx
git commit -m "feat(articles): add server wrapper and nav-link for bulk-import view"
```

---

## Task 12: Register Custom View and Nav-Link in payload.config.ts

**Files:**
- Modify: `src/payload.config.ts`
- Modify (auto): `src/app/(payload)/admin/importMap.js`

- [ ] **Step 1: Register the custom view and nav-link**

In `src/payload.config.ts`, inside `admin.components`, extend the existing block:

```typescript
    components: {
      views: {
        dashboard: {
          Component:
            'src/components/admin/EditorialDashboard.server.tsx#EditorialDashboardServer',
        },
        articlesImport: {
          Component:
            'src/components/admin/BulkArticleImport.server.tsx#BulkArticleImportServer',
          path: '/articles-import',
        },
      },
      afterNavLinks: [
        'src/components/admin/BulkArticleImportNavLink.server.tsx#BulkArticleImportNavLink',
      ],
    },
```

- [ ] **Step 2: Regenerate Payload import map**

Run: `pnpm generate:importmap`
Expected: `src/app/(payload)/admin/importMap.js` updates to include the new component imports.

- [ ] **Step 3: Sanity check — boot the dev server**

Run: `pnpm dev` (in a separate terminal)
Visit `http://localhost:3000/admin` while logged in as an editor.
Expected:
- "📥 Artikel-Bulk-Import" appears in the admin sidebar
- Navigating to `/admin/articles-import` renders the drag&drop UI
- Logging in as a contributor: the link is gone, direct URL shows the "Kein Zugriff" screen

Stop the dev server after the smoke check.

- [ ] **Step 4: Commit**

```bash
git add src/payload.config.ts src/app/(payload)/admin/importMap.js
git commit -m "feat(articles): register bulk-import custom view and nav-link in payload config"
```

---

## Task 13: Example File for Documentation

**Files:**
- Create: `docs/examples/bulk-import-sample.md`

- [ ] **Step 1: Write sample file**

`docs/examples/bulk-import-sample.md`:

```markdown
---
title: Dekubitusprophylaxe
intent: bedside
summary: Wie Druckgeschwüre erkannt und verhindert werden — die wichtigsten Schritte am Bett.
standardsBound: true
authors:
  - Christoph Mueller
lastReviewedAt: 2026-06-21
---

## Definition

**Dekubitus** ist eine lokal begrenzte Schädigung der Haut und/oder des
darunterliegenden Gewebes, üblicherweise über knöchernen Vorsprüngen, als
Folge von Druck oder Druck in Kombination mit Scherkräften.

## Praxis

1. Regelmäßige Positionswechsel (Richtwert: alle 2 Stunden, individuell anpassen).
2. Druck-reduzierende Hilfsmittel (Wechseldrucksysteme, Weichlagerung).
3. Hautinspektion bei jeder Pflegehandlung.
4. Ernährung und Hydratation sicherstellen.

## Risiken & Fallstricke

- *Reibung* an Bettlaken bei unsachgemäßem Transfer
- Scherkräfte beim Hochziehen ohne Lifter
- Übersehen früher Stadien (nicht-wegdrückbare Rötung)

## Quellen & Weiterführendes

Siehe den [Expertenstandard zur Dekubitusprophylaxe](https://example.com/standard).
```

- [ ] **Step 2: Commit**

```bash
git add docs/examples/bulk-import-sample.md
git commit -m "docs: add sample markdown file for bulk-import format"
```

---

## Task 14: Manual End-to-End Smoke Test

This task is not automated — it verifies the spec's acceptance criteria
against a running dev server. Document findings in a comment on the PR
description rather than as code.

- [ ] **Step 1: Start a clean dev server**

Run: `pnpm dev`

- [ ] **Step 2: Run through every acceptance criterion**

Spec Sektion 11 (Akzeptanzkriterien 1–11) — for each, perform the action
and tick the box. Record any failures inline as bugs.

1. [ ] Login als editor → `/admin/articles-import` rendert UI
2. [ ] Login als contributor → 403-Screen; Sidebar-Link nicht sichtbar
3. [ ] Drei valide `.md`-Dateien → Vorschau zeigt `✅ neu` ×3
4. [ ] „Import bestätigen" → 3 Article-Docs mit status=draft + 3 Audit-Logs
5. [ ] Datei mit `intent: foo` → `❌` + Detail-Toggle nennt `intent-invalid`
6. [ ] Datei mit existierendem Slug → `⚠️ Slug existiert` + beim Import übersprungen
7. [ ] Datei ohne `## Praxis` → `❌` mit `section-missing` (field: praxis)
8. [ ] Datei mit unbekanntem Author → importiert, Soft-Warning sichtbar, `authors` leer
9. [ ] ZIP mit 5 `.md` → wie 5 separate Uploads
10. [ ] ZIP mit `../etc/passwd.md` → harter Fehler, keine Entpackung
11. [ ] 300-KB-Datei → `file-too-large`

- [ ] **Step 3: Stop dev server, document findings**

If all 11 pass: note "smoke OK 11/11" in PR description.
If any fail: open follow-up tickets, do NOT silently fix in this PR.

---

## Self-Review (run after writing the plan)

**1. Spec coverage:**

| Spec section | Covered by task(s) |
|---|---|
| 1 Ziel | n/a (intro) |
| 2 Format-Entscheidung | Task 3+4 (parser scope) |
| 3 Dateiformat | Task 3 (frontmatter), Task 4 (sections), Task 13 (example) |
| 4 UI / Einstiegspunkt | Task 10 (UI), Task 11+12 (server wrapper + registration), Task 1 (permission) |
| 5 Architektur | Tasks 2–11 (one file each) |
| 6 Datenfluss | Task 9 (server actions) |
| 7 Validierung | Tasks 3+4 (hard fails), Task 7 (author warnings), Task 9 (file-too-large) |
| 8 Sicherheit & Limits | Task 8 (zip), Task 9 (limits + permission re-check), Task 11 (role gate) |
| 9 Audit-Trail | Task 1 (event-type), Task 9 (writeAuditLog call) |
| 10 YAGNI ausgeschlossen | n/a (decisions baked into above tasks) |
| 11 Akzeptanzkriterien | Task 14 (manual smoke) |
| 12 Offene Punkte | Resolved: markdownToLexical = hand-rolled (Task 5); ZIP = yauzl (Task 8); permission `bulkImport` added (Task 1) |

**2. Placeholder scan:** None — every step has runnable commands and complete code.

**3. Type consistency:**
- `ParsedArticleFrontmatter`, `ParsedArticleSections`, `ParseResult`, `ImportRow`, `ImportResultRow`, `ValidationIssue` defined in Task 2, consistently consumed in Tasks 3–11.
- `parseFilesPure`/`runImportPure` signatures match between Task 9 implementation and Task 9 tests.
- Audit-event-type `'article.bulk_import'` added in Task 1, consumed in Task 9.
- Permission action `'bulkImport'` added in Task 1, consumed in Tasks 9 + 11.
- `markdownToLexical` returns `{ root: LexicalNode }` — Task 5 builds it, Task 9 passes it directly into `payload.create({ data })`.

No mismatches found.
