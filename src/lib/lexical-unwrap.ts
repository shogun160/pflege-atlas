/**
 * Lexical's `editorState.toJSON()` produces a wrapped shape:
 *   { root: { type: 'root', children: [...] } }
 *
 * Some inputs (existing tests, internal traversals) use the bare shape:
 *   { type: 'root', children: [...] }
 *
 * `unwrapLexicalRoot` returns the inner root node, or null if neither shape
 * applies. Boundary helpers (schema validation, sanitize, plain-text render,
 * dirty-check) call this first so the rest of the code only deals with the
 * unwrapped root shape.
 */
export interface UnwrappedRoot {
  type: 'root';
  children?: unknown[];
  [k: string]: unknown;
}

export function unwrapLexicalRoot(parsed: unknown): UnwrappedRoot | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  const wrapped = obj.root;
  if (wrapped && typeof wrapped === 'object') {
    const w = wrapped as Record<string, unknown>;
    if (w.type === 'root') {
      return w as UnwrappedRoot;
    }
  }

  if (obj.type === 'root') {
    return obj as UnwrappedRoot;
  }

  return null;
}
