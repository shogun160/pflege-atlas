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
