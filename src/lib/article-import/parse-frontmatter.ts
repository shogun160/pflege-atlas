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
        'frontmatter-field-type-error',
        `\`standardsBound\` ignoriert (kein Boolean): ${JSON.stringify(obj.standardsBound)}`,
        'standardsBound',
      ),
    );
  }
  if (obj.authors !== undefined) {
    if (!Array.isArray(obj.authors)) {
      warnings.push(
        softIssue(
          'frontmatter-field-type-error',
          `\`authors\` ignoriert (kein Array): ${JSON.stringify(obj.authors)}`,
          'authors',
        ),
      );
    } else {
      const authors = obj.authors.filter((a): a is string => typeof a === 'string');
      const dropped = obj.authors.length - authors.length;
      if (dropped > 0) {
        warnings.push(
          softIssue(
            'frontmatter-field-type-error',
            `\`authors\`: ${dropped} Einträge ignoriert (kein String).`,
            'authors',
          ),
        );
      }
      if (authors.length > 0) data.authors = authors;
    }
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
