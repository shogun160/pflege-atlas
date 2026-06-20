import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PiiNotice } from '@/components/PiiNotice';

describe('PiiNotice', () => {
  it('renders the privacy hint text', () => {
    render(<PiiNotice />);
    expect(screen.getByText(/Datenschutz/i)).toBeInTheDocument();
    expect(screen.getByText(/keine Namen/i)).toBeInTheDocument();
    expect(screen.getByText(/öffentlich auf GitHub/i)).toBeInTheDocument();
  });

  it('uses semantic role=note', () => {
    render(<PiiNotice />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});
