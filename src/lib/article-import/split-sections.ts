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
