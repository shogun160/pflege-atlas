import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/Footer';

describe('Footer', () => {
  it('zeigt CC-BY-SA-Lizenzhinweis', () => {
    render(<Footer />);
    expect(screen.getByText(/CC BY-SA 4\.0/i)).toBeInTheDocument();
  });

  it('zeigt einen Disclaimer-Hinweis', () => {
    render(<Footer />);
    const paragraph = screen.getByText(/Hinweis:/).closest('p');
    expect(paragraph?.textContent).toMatch(/ersetzen keine ärztliche oder pflegerische Beurteilung/i);
  });

  it('hat Links zu Impressum, Datenschutz, GitHub-Mirror', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: /Impressum/i })).toHaveAttribute('href', '/impressum');
    expect(screen.getByRole('link', { name: /Datenschutz/i })).toHaveAttribute('href', '/datenschutz');
    expect(screen.getByRole('link', { name: /Open Source/i })).toBeInTheDocument();
  });
});
