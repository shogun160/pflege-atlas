type Node = {
  type?: string;
  children?: Node[];
  text?: string;
  url?: string;
  listType?: string;
  format?: number;
};

const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;

function unwrap(input: unknown): Node | null {
  if (!input || typeof input !== 'object') return null;
  if ('root' in input && (input as { root?: unknown }).root) {
    return (input as { root: Node }).root;
  }
  return input as Node;
}

function applyTextFormat(text: string, format: number | undefined): string {
  if (!format || !text) return text;
  let result = text;
  if (format & FORMAT_BOLD && format & FORMAT_ITALIC) {
    result = `***${result}***`;
  } else if (format & FORMAT_BOLD) {
    result = `**${result}**`;
  } else if (format & FORMAT_ITALIC) {
    result = `*${result}*`;
  }
  return result;
}

function renderInline(nodes: Node[] | undefined): string {
  if (!Array.isArray(nodes)) return '';
  return nodes.map((n) => renderInlineNode(n)).join('');
}

function renderInlineNode(node: Node): string {
  switch (node.type) {
    case 'text':
      return applyTextFormat(typeof node.text === 'string' ? node.text : '', node.format);
    case 'linebreak':
      return '\n';
    case 'link': {
      const inner = renderInline(node.children);
      return node.url ? `[${inner}](${node.url})` : inner;
    }
    default:
      return renderInline(node.children);
  }
}

function renderBlock(node: Node): string {
  if (node.type === 'paragraph') {
    return renderInline(node.children);
  }
  if (node.type === 'list') {
    const items = (node.children ?? []).map((item, idx) => {
      const prefix = node.listType === 'number' ? `${idx + 1}. ` : '- ';
      return `${prefix}${renderInline(item.children)}`;
    });
    return items.join('\n');
  }
  return renderInline(node.children);
}

export function lexicalToMarkdown(input: unknown): string {
  const root = unwrap(input);
  if (!root || !Array.isArray(root.children) || root.children.length === 0) return '';
  const blocks = root.children.map((child) => renderBlock(child));
  return blocks.filter((b) => b.length > 0).join('\n\n');
}
