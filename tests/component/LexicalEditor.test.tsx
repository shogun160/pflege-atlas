import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LexicalEditor, emptyLexicalJson } from '@/components/LexicalEditor';

// jsdom doesn't fully implement Range methods that Lexical uses
beforeAll(() => {
  if (typeof window !== 'undefined') {
    if (!window.Range.prototype.getBoundingClientRect) {
      window.Range.prototype.getBoundingClientRect = () =>
        ({
          width: 0,
          height: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect;
    }
    if (!window.Range.prototype.getClientRects) {
      window.Range.prototype.getClientRects = () =>
        ({
          length: 0,
          item: () => null,
          [Symbol.iterator]: function* () {},
        }) as unknown as DOMRectList;
    }
  }
});

describe('LexicalEditor', () => {
  it('mounts without crashing', () => {
    render(<LexicalEditor value={emptyLexicalJson()} onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders 5 toolbar buttons', () => {
    render(<LexicalEditor value={emptyLexicalJson()} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /fett/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kursiv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aufzählung/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nummerierte/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /link einfügen/i })).toBeInTheDocument();
  });

  it('shows placeholder when provided', () => {
    render(
      <LexicalEditor
        value={emptyLexicalJson()}
        onChange={() => {}}
        placeholder="Hier deine Beschreibung…"
      />,
    );
    expect(screen.getByText('Hier deine Beschreibung…')).toBeInTheDocument();
  });
});
