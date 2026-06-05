import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntentCards } from '@/components/IntentCards';

describe('IntentCards', () => {
  it('rendert vier Karten', () => {
    render(<IntentCards />);
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });

  it('enthält alle vier Intent-Texte', () => {
    render(<IntentCards />);
    expect(screen.getByText(/schnelle Hilfe am Bett/i)).toBeInTheDocument();
    expect(screen.getByText(/Hintergrundwissen/i)).toBeInTheDocument();
    expect(screen.getByText(/etwas zum Lernen/i)).toBeInTheDocument();
    expect(screen.getByText(/QM- & Pflegedienst-Tools/i)).toBeInTheDocument();
  });

  it('markiert QM-Tools sichtbar als bezahlt', () => {
    render(<IntentCards />);
    const qm = screen.getByText(/QM- & Pflegedienst-Tools/i).closest('a');
    expect(qm).not.toBeNull();
    expect(qm).toHaveTextContent(/🔒|bezahlt|kostenpflichtig/i);
  });
});
