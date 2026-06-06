type LexicalLike = {
  type?: string;
  children?: LexicalLike[];
  [k: string]: unknown;
};

const STRIPPED_KEYS = ['version', 'key', '__key', '__type'] as const;

export function normalizeLexical(node: LexicalLike | null | undefined): LexicalLike | null {
  if (!node || typeof node !== 'object') return null;
  const out: LexicalLike = {};
  for (const [k, v] of Object.entries(node)) {
    if ((STRIPPED_KEYS as readonly string[]).includes(k)) continue;
    if (k === 'children' && Array.isArray(v)) {
      out.children = v
        .map((c) => normalizeLexical(c as LexicalLike))
        .filter((c): c is LexicalLike => c !== null);
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function isLexicalDirty(
  edited: LexicalLike | null | undefined,
  original: LexicalLike | null | undefined,
): boolean {
  return JSON.stringify(normalizeLexical(edited)) !== JSON.stringify(normalizeLexical(original));
}
