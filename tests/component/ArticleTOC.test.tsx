import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArticleTOC } from '@/components/ArticleTOC';

const sections = [
  { id: 'definition', label: 'Definition' },
  { id: 'praxis', label: 'Praxis' },
  { id: 'risiken', label: 'Risiken & Fallstricke' },
  { id: 'quellen', label: 'Quellen' },
];

describe('ArticleTOC', () => {
  it('rendert alle Sektions-Links', () => {
    render(<ArticleTOC sections={sections} />);
    sections.forEach((s) => {
      expect(screen.getByRole('link', { name: s.label })).toHaveAttribute(
        'href',
        `#${s.id}`,
      );
    });
  });

  it('hat den Toggle-Button standardmäßig zugeklappt (aria-expanded=false)', () => {
    render(<ArticleTOC sections={sections} />);
    const toggle = screen.getByRole('button', { name: /Inhalt/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('klappt auf Klick auf', async () => {
    render(<ArticleTOC sections={sections} />);
    const toggle = screen.getByRole('button', { name: /Inhalt/i });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
