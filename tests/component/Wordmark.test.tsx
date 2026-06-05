import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Wordmark } from '@/components/Wordmark';

describe('Wordmark', () => {
  it('renders Pflege, Atlas and a separator dot', () => {
    render(<Wordmark size="md" />);
    expect(screen.getByText('Pflege')).toBeInTheDocument();
    expect(screen.getByText('Atlas')).toBeInTheDocument();
    expect(screen.getByText('·')).toBeInTheDocument();
  });

  it('renders the mid-dot in accent color', () => {
    render(<Wordmark size="md" />);
    const dot = screen.getByText('·');
    expect(dot).toHaveClass('text-accent');
  });

  it('renders the Pflege and Atlas parts in brand color and serif', () => {
    render(<Wordmark size="md" />);
    const pflege = screen.getByText('Pflege');
    expect(pflege).toHaveClass('text-brand');
    expect(pflege).toHaveClass('font-serif');
  });

  it('supports three sizes via size prop', () => {
    const { container: sm } = render(<Wordmark size="sm" />);
    const { container: md } = render(<Wordmark size="md" />);
    const { container: lg } = render(<Wordmark size="lg" />);
    expect(sm.firstChild).toHaveClass('text-sm');
    expect(md.firstChild).toHaveClass('text-xl');
    expect(lg.firstChild).toHaveClass('text-4xl');
  });
});
