import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArticleDisclaimer } from '@/components/ArticleDisclaimer';

describe('ArticleDisclaimer', () => {
  it('zeigt Sicherheits-Disclaimer', () => {
    render(<ArticleDisclaimer />);
    expect(
      screen.getByText(/keine ärztliche oder pflegerische Beurteilung/i),
    ).toBeInTheDocument();
  });

  it('hat role=note für Screenreader', () => {
    render(<ArticleDisclaimer />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });

  it('renders as a note with brand-color left border', () => {
    render(<ArticleDisclaimer />);
    const note = screen.getByRole('note');
    expect(note).toHaveClass('border-brand');
    expect(note).toHaveClass('border-l-[3px]');
  });
});
