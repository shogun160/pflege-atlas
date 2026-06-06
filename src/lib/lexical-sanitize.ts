const ALLOWED_TYPES = new Set([
  'root',
  'paragraph',
  'text',
  'list',
  'listitem',
  'link',
  'linebreak',
]);

const TEXT_FORMAT_MASK = 0b11; // bold = 1, italic = 2
const URL_REGEX = /^(https?:|mailto:|#)/i;
const URL_MAX = 2000;

export interface LexicalNode {
  type: string;
  version?: number;
  children?: LexicalNode[];
  format?: number;
  url?: string;
  [k: string]: unknown;
}

export interface LexicalRoot extends LexicalNode {
  type: 'root';
  children: LexicalNode[];
}

function sanitizeLexicalNode(node: LexicalNode | null | undefined): LexicalNode | null {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return null;
  if (!ALLOWED_TYPES.has(node.type)) return null;

  if (node.type === 'text') {
    const fmt = typeof node.format === 'number' ? node.format : 0;
    node.format = fmt & TEXT_FORMAT_MASK;
  }

  if (node.type === 'link') {
    const url = typeof node.url === 'string' ? node.url : '';
    if (!URL_REGEX.test(url) || url.length > URL_MAX) return null;
  }

  if (Array.isArray(node.children)) {
    node.children = node.children
      .map((c) => sanitizeLexicalNode(c as LexicalNode))
      .filter((c): c is LexicalNode => c !== null);
  }

  return node;
}

export function sanitizeLexicalRoot(root: LexicalNode | null | undefined): LexicalRoot {
  const sanitized = sanitizeLexicalNode(root);
  if (!sanitized || sanitized.type !== 'root') {
    return { type: 'root', version: 1, children: [] };
  }
  return sanitized as LexicalRoot;
}
