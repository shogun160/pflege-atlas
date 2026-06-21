import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Impressum from '@/app/(frontend)/impressum/page';

describe('Impressum', () => {
  it('shows § 5 DDG-Pflichtangaben for joint controllers', () => {
    render(<Impressum />);
    expect(screen.getByRole('heading', { name: /Impressum/i, level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText(/Oliver Wosnitza/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Christoph/i)).toBeInTheDocument();
  });

  it('shows DSGVO contact email', () => {
    render(<Impressum />);
    const link = screen.getByRole('link', { name: /datenschutz@pflegeatlas\.org/i });
    expect(link).toHaveAttribute('href', 'mailto:datenschutz@pflegeatlas.org');
  });

  it('shows MStV § 18(2) verantwortlich-für-Inhalte', () => {
    render(<Impressum />);
    expect(screen.getByText(/Verantwortlich für den Inhalt nach.*MStV/i)).toBeInTheDocument();
  });

  it('shows EU-OS-Streitschlichtung-Hinweis', () => {
    render(<Impressum />);
    expect(
      screen.getAllByText(/Online-Streitbeilegung|OS-Plattform|ec\.europa\.eu/i).length,
    ).toBeGreaterThan(0);
  });

  it('shows Verbraucherstreitbeilegung opt-out', () => {
    render(<Impressum />);
    expect(screen.getByText(/Verbraucherstreitbeilegung|nicht teilnahmebereit|nicht verpflichtet/i)).toBeInTheDocument();
  });
});
