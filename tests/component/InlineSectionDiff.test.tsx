import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InlineSectionDiff } from '@/components/admin/InlineSectionDiff';

describe('InlineSectionDiff', () => {
  it('renders "Keine Änderung" when content unchanged', () => {
    render(
      <InlineSectionDiff
        mode="correction"
        original="Hallo"
        edited="Hallo"
        sectionLabel="Praxis"
      />,
    );
    expect(screen.getByText(/Keine Änderung/)).toBeInTheDocument();
  });

  it('renders additions and removals for correction mode', () => {
    render(
      <InlineSectionDiff
        mode="correction"
        original="alt"
        edited="neu"
        sectionLabel="Praxis"
      />,
    );
    expect(screen.getByText(/^- alt/m, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/^\+ neu/m, { exact: false })).toBeInTheDocument();
  });

  it('renders read-only preview for new_article mode', () => {
    render(
      <InlineSectionDiff
        mode="new_article"
        edited="Vorschlag-Text"
        sectionLabel="Definition"
      />,
    );
    expect(screen.getByText(/Vorschlag-Text/)).toBeInTheDocument();
  });

  it('shows empty-state hint when edited is empty in correction mode', () => {
    render(
      <InlineSectionDiff
        mode="correction"
        original="alt"
        edited=""
        sectionLabel="Praxis"
      />,
    );
    expect(screen.getByText(/Nicht editiert/)).toBeInTheDocument();
  });
});
