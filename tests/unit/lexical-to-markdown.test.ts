import { describe, expect, it } from 'vitest';
import { lexicalToMarkdown } from '@/lib/lexical-to-markdown';

describe('lexicalToMarkdown', () => {
  it('returns empty string for null root', () => {
    expect(lexicalToMarkdown(null)).toBe('');
  });

  it('returns empty string for empty children', () => {
    expect(lexicalToMarkdown({ type: 'root', children: [] })).toBe('');
  });

  it('renders a plain paragraph', () => {
    const root = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Hallo Welt' }] },
      ],
    };
    expect(lexicalToMarkdown(root)).toBe('Hallo Welt');
  });

  it('renders bold via format bitmask 1', () => {
    const root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'fett', format: 1 }],
        },
      ],
    };
    expect(lexicalToMarkdown(root)).toBe('**fett**');
  });

  it('renders italic via format bitmask 2', () => {
    const root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'kursiv', format: 2 }],
        },
      ],
    };
    expect(lexicalToMarkdown(root)).toBe('*kursiv*');
  });

  it('renders bold+italic via format bitmask 3', () => {
    const root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'beides', format: 3 }],
        },
      ],
    };
    expect(lexicalToMarkdown(root)).toBe('***beides***');
  });

  it('renders an unordered list', () => {
    const root = {
      type: 'root',
      children: [
        {
          type: 'list',
          listType: 'bullet',
          children: [
            { type: 'listitem', children: [{ type: 'text', text: 'a' }] },
            { type: 'listitem', children: [{ type: 'text', text: 'b' }] },
          ],
        },
      ],
    };
    expect(lexicalToMarkdown(root)).toBe('- a\n- b');
  });

  it('renders an ordered list with sequential numbers', () => {
    const root = {
      type: 'root',
      children: [
        {
          type: 'list',
          listType: 'number',
          children: [
            { type: 'listitem', children: [{ type: 'text', text: 'erste' }] },
            { type: 'listitem', children: [{ type: 'text', text: 'zweite' }] },
          ],
        },
      ],
    };
    expect(lexicalToMarkdown(root)).toBe('1. erste\n2. zweite');
  });

  it('renders a link', () => {
    const root = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: 'https://example.com',
              children: [{ type: 'text', text: 'Beispiel' }],
            },
          ],
        },
      ],
    };
    expect(lexicalToMarkdown(root)).toBe('[Beispiel](https://example.com)');
  });

  it('separates multiple blocks with double newline', () => {
    const root = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Absatz 1' }] },
        { type: 'paragraph', children: [{ type: 'text', text: 'Absatz 2' }] },
      ],
    };
    expect(lexicalToMarkdown(root)).toBe('Absatz 1\n\nAbsatz 2');
  });

  it('accepts wrapped {root:{...}} shape from Lexical editor output', () => {
    const wrapped = {
      root: {
        type: 'root',
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'wrapped' }] },
        ],
      },
    };
    expect(lexicalToMarkdown(wrapped)).toBe('wrapped');
  });
});
