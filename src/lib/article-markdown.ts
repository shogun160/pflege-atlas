// src/lib/article-markdown.ts
import { createHash } from 'crypto';
import yaml from 'js-yaml';
import { lexicalToMarkdown } from './lexical-to-markdown';

type ArticleInput = {
  id: number;
  title: string;
  slug: string;
  intent: string;
  summary: string;
  status: string;
  lastReviewedAt?: string | Date | null;
  standardsBound?: boolean;
  definition: unknown;
  praxis: unknown;
  risiken: unknown;
  quellen: unknown;
};

function isoDate(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  return undefined;
}

export function renderArticleMarkdown(article: ArticleInput, authorNames: string[]): string {
  const frontmatter: Record<string, unknown> = {
    payloadId: article.id,
    slug: article.slug,
    title: article.title,
    intent: article.intent,
    summary: article.summary,
    status: article.status,
    authors: authorNames,
  };

  const reviewed = isoDate(article.lastReviewedAt);
  if (reviewed) frontmatter.lastReviewedAt = reviewed;
  if (typeof article.standardsBound === 'boolean') {
    frontmatter.standardsBound = article.standardsBound;
  }

  const yamlBlock = yaml.dump(frontmatter, {
    schema: yaml.JSON_SCHEMA,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  const sections = [
    `## Definition\n\n${lexicalToMarkdown(article.definition)}`,
    `## Praxis\n\n${lexicalToMarkdown(article.praxis)}`,
    `## Risiken & Fallstricke\n\n${lexicalToMarkdown(article.risiken)}`,
    `## Quellen & Weiterführendes\n\n${lexicalToMarkdown(article.quellen)}`,
  ];

  return `---\n${yamlBlock}---\n\n${sections.join('\n\n')}\n`;
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
