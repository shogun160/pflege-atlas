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
  | 'frontmatter-field-type-error'
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
