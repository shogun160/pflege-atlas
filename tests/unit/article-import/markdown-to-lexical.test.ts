import { describe, it, expect } from 'vitest';
import { markdownToLexical } from '@/lib/article-import/markdown-to-lexical';

function root(children: unknown[]) {
  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      children,
    },
  };
}

describe('markdownToLexical', () => {
  it('returns empty root for empty input', () => {
    const result = markdownToLexical('');
    expect(result).toEqual(root([]));
  });

  it('converts a simple paragraph', () => {
    const result = markdownToLexical('Hello world.');
    const para = (result as { root: { children: Array<{ type: string; children: unknown[] }> } })
      .root.children[0];
    expect(para.type).toBe('paragraph');
    const text = para.children[0] as { text: string; type: string; format: number };
    expect(text.type).toBe('text');
    expect(text.text).toBe('Hello world.');
    expect(text.format).toBe(0);
  });

  it('handles bold and italic with bitmask format', () => {
    const result = markdownToLexical('**bold** and *italic* and ***both***');
    const para = (result as { root: { children: Array<{ children: Array<{ text: string; format: number }> }> } })
      .root.children[0];
    const segments = para.children;
    const findText = (txt: string) => segments.find((s) => s.text === txt);
    expect(findText('bold')!.format).toBe(1); // bold
    expect(findText('italic')!.format).toBe(2); // italic
    expect(findText('both')!.format).toBe(3); // bold | italic
  });

  it('converts links', () => {
    const result = markdownToLexical('See [docs](https://example.com) here.');
    const para = (result as { root: { children: Array<{ children: Array<{ type: string; url?: string; children?: Array<{ text: string }> }> }> } })
      .root.children[0];
    const link = para.children.find((c) => c.type === 'link');
    expect(link).toBeDefined();
    expect(link!.url).toBe('https://example.com');
    expect(link!.children![0].text).toBe('docs');
  });

  it('converts unordered lists', () => {
    const md = `- one\n- two\n- three`;
    const result = markdownToLexical(md);
    const list = (result as { root: { children: Array<{ type: string; listType?: string; children: unknown[] }> } })
      .root.children[0];
    expect(list.type).toBe('list');
    expect(list.listType).toBe('bullet');
    expect(list.children).toHaveLength(3);
  });

  it('converts ordered lists', () => {
    const md = `1. one\n2. two`;
    const result = markdownToLexical(md);
    const list = (result as { root: { children: Array<{ listType?: string; children: unknown[] }> } })
      .root.children[0];
    expect(list.listType).toBe('number');
    expect(list.children).toHaveLength(2);
  });

  it('converts headings level 3 and 4', () => {
    const md = `### Sub\n\n#### SubSub`;
    const result = markdownToLexical(md);
    const children = (result as { root: { children: Array<{ type: string; tag?: string }> } })
      .root.children;
    expect(children[0].type).toBe('heading');
    expect(children[0].tag).toBe('h3');
    expect(children[1].tag).toBe('h4');
  });

  it('drops unsupported elements (HTML, images) without crashing', () => {
    const md = `Para 1.\n\n<div>raw html</div>\n\n![alt](img.png)\n\nPara 2.`;
    const result = markdownToLexical(md);
    const children = (result as { root: { children: Array<{ type: string }> } }).root.children;
    // Two real paragraphs survive; HTML + image are dropped (or become empty paragraphs that get filtered)
    const paragraphs = children.filter((c) => c.type === 'paragraph');
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
  });
});
