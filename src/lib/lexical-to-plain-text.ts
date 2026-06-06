type Node = { type?: string; children?: Node[]; text?: string; url?: string; listType?: string };

function renderInline(nodes: Node[] | undefined): string {
  if (!Array.isArray(nodes)) return '';
  return nodes.map((n) => renderNode(n)).join('');
}

function renderNode(node: Node): string {
  switch (node.type) {
    case 'text':
      return typeof node.text === 'string' ? node.text : '';
    case 'linebreak':
      return '\n';
    case 'link': {
      const inner = renderInline(node.children);
      return node.url ? `${inner} (${node.url})` : inner;
    }
    case 'paragraph':
      return renderInline(node.children);
    case 'listitem':
      return renderInline(node.children);
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

export function lexicalToPlainText(root: Node | null | undefined): string {
  if (!root || !Array.isArray(root.children) || root.children.length === 0) return '';
  const blocks = root.children.map((child) => renderBlock(child));
  return blocks.filter((b) => b.length > 0).join('\n\n');
}
