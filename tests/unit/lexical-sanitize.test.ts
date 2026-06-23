import { describe, expect, it } from 'vitest';
import { sanitizeLexicalRoot } from '@/lib/lexical-sanitize';

function paragraph(text: string, format = 0) {
  return {
    type: 'paragraph',
    version: 1,
    children: [{ type: 'text', version: 1, text, format }],
  };
}

const validRoot = {
  type: 'root',
  version: 1,
  children: [paragraph('Hallo')],
};

describe('sanitizeLexicalRoot', () => {
  it('passes a valid paragraph+text tree through', () => {
    const result = sanitizeLexicalRoot(JSON.parse(JSON.stringify(validRoot)));
    expect(result.type).toBe('root');
    expect(result.children[0].type).toBe('paragraph');
    expect(result.children[0]!.children![0].type).toBe('text');
    expect(result.children[0]!.children![0].text).toBe('Hallo');
  });

  it('strips an unknown node type', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        paragraph('keep'),
        { type: 'image', version: 1, src: 'x.png' },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children).toHaveLength(1);
    expect(result.children[0]!.children![0].text).toBe('keep');
  });

  it('reduces text format bitmask to bold+italic only', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [paragraph('fancy', 0b11111)],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0]!.children![0].format).toBe(0b11);
  });

  it('passes paragraph + bullet list + listitem through', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'list',
          listType: 'bullet',
          version: 1,
          children: [
            {
              type: 'listitem',
              version: 1,
              children: [{ type: 'text', version: 1, text: 'a', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0].type).toBe('list');
    expect(result.children[0]!.children![0].type).toBe('listitem');
  });

  it('keeps a https link', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              url: 'https://example.org',
              children: [{ type: 'text', version: 1, text: 'X', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0]!.children![0].type).toBe('link');
    expect(result.children[0]!.children![0].url).toBe('https://example.org');
  });

  it('strips a javascript: link', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              url: 'javascript:alert(1)',
              children: [{ type: 'text', version: 1, text: 'evil', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0]!.children!).toHaveLength(0);
  });

  it('strips a data: link', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              url: 'data:text/html,<script>',
              children: [{ type: 'text', version: 1, text: 'evil', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0]!.children!).toHaveLength(0);
  });

  it('keeps a fragment-only link', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              url: '#abschnitt-2',
              children: [{ type: 'text', version: 1, text: 'A', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0]!.children![0].type).toBe('link');
  });

  it('keeps a mailto link', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              url: 'mailto:redaktion@pflegeatlas.org',
              children: [{ type: 'text', version: 1, text: 'mail', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0]!.children![0].type).toBe('link');
  });

  it('strips an over-long URL', () => {
    const longUrl = 'https://example.org/' + 'a'.repeat(2001);
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              url: longUrl,
              children: [{ type: 'text', version: 1, text: 'long', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0]!.children!).toHaveLength(0);
  });

  it('returns a minimal empty root for null input', () => {
    const result = sanitizeLexicalRoot(null);
    expect(result.type).toBe('root');
    expect(result.children).toEqual([]);
  });
});
