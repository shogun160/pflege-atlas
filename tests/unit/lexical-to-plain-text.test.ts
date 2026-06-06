import { describe, expect, it } from 'vitest';
import { lexicalToPlainText } from '@/lib/lexical-to-plain-text';

const text = (t: string, format = 0) => ({ type: 'text', text: t, format });
const para = (...children: any[]) => ({ type: 'paragraph', children });

describe('lexicalToPlainText', () => {
  it('renders a single paragraph as plain text', () => {
    const root = { type: 'root', children: [para(text('Hallo Welt'))] };
    expect(lexicalToPlainText(root)).toBe('Hallo Welt');
  });

  it('separates multiple paragraphs with a blank line', () => {
    const root = {
      type: 'root',
      children: [para(text('A')), para(text('B'))],
    };
    expect(lexicalToPlainText(root)).toBe('A\n\nB');
  });

  it('renders a bullet list as "- item"', () => {
    const root = {
      type: 'root',
      children: [
        {
          type: 'list',
          listType: 'bullet',
          children: [
            { type: 'listitem', children: [text('a')] },
            { type: 'listitem', children: [text('b')] },
          ],
        },
      ],
    };
    expect(lexicalToPlainText(root)).toBe('- a\n- b');
  });

  it('renders a numbered list as "N. item"', () => {
    const root = {
      type: 'root',
      children: [
        {
          type: 'list',
          listType: 'number',
          children: [
            { type: 'listitem', children: [text('a')] },
            { type: 'listitem', children: [text('b')] },
          ],
        },
      ],
    };
    expect(lexicalToPlainText(root)).toBe('1. a\n2. b');
  });

  it('renders a link as "text (url)"', () => {
    const root = {
      type: 'root',
      children: [
        para({
          type: 'link',
          url: 'https://example.org',
          children: [text('Quelle')],
        }),
      ],
    };
    expect(lexicalToPlainText(root)).toBe('Quelle (https://example.org)');
  });

  it('renders linebreak as newline', () => {
    const root = {
      type: 'root',
      children: [para(text('Zeile 1'), { type: 'linebreak' }, text('Zeile 2'))],
    };
    expect(lexicalToPlainText(root)).toBe('Zeile 1\nZeile 2');
  });

  it('returns empty string for empty root', () => {
    expect(lexicalToPlainText({ type: 'root', children: [] })).toBe('');
  });

  it('returns empty string for null', () => {
    expect(lexicalToPlainText(null)).toBe('');
  });

  it('handles list and paragraph mixed', () => {
    const root = {
      type: 'root',
      children: [
        para(text('Intro')),
        {
          type: 'list',
          listType: 'bullet',
          children: [{ type: 'listitem', children: [text('punkt')] }],
        },
      ],
    };
    expect(lexicalToPlainText(root)).toBe('Intro\n\n- punkt');
  });
});
