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
