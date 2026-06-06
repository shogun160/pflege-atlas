import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { MockEditor } = vi.hoisted(() => ({
  MockEditor: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string;
    onChange: (s: string) => void;
    ariaLabel?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => MockEditor,
}));

vi.mock('@/components/LexicalEditor', () => ({
  LexicalEditor: MockEditor,
  emptyLexicalJson: () => JSON.stringify({ type: 'root', children: [] }),
}));

import { NewArticleFields } from '@/components/NewArticleFields';

const defaultProps = {
  values: {
    proposedTitle: '',
    proposedIntent: '',
    proposedSummary: '',
    proposedDefinition: '',
    proposedPraxis: '',
    proposedRisiken: '',
    proposedQuellen: '',
  },
  setters: {
    setProposedTitle: vi.fn(),
    setProposedIntent: vi.fn(),
    setProposedSummary: vi.fn(),
    setProposedDefinition: vi.fn(),
    setProposedPraxis: vi.fn(),
    setProposedRisiken: vi.fn(),
    setProposedQuellen: vi.fn(),
  },
  fieldErrors: undefined,
};

describe('NewArticleFields', () => {
  it('renders title input', () => {
    render(<NewArticleFields {...defaultProps} />);
    expect(screen.getByLabelText(/Titel/i)).toBeInTheDocument();
  });

  it('renders intent select with default and 3 options', () => {
    render(<NewArticleFields {...defaultProps} />);
    const select = screen.getByLabelText(/Intent/i) as HTMLSelectElement;
    expect(select.options).toHaveLength(4);
    expect(select.options[0].textContent).toMatch(/offen/i);
  });

  it('renders summary textarea with 0/280 counter', () => {
    render(<NewArticleFields {...defaultProps} />);
    expect(screen.getByLabelText(/Kurzbeschreibung/i)).toBeInTheDocument();
    expect(screen.getByText(/0\s*\/\s*280/)).toBeInTheDocument();
  });

  it('renders 4 Lexical editors with section labels', () => {
    render(<NewArticleFields {...defaultProps} />);
    expect(screen.getByText(/1\. Definition/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Praxis/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Risiken/i)).toBeInTheDocument();
    expect(screen.getByText(/4\. Quellen/i)).toBeInTheDocument();
  });
});
