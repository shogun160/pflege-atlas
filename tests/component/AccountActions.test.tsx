import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountActions } from '@/components/AccountActions';

const { mockDelete, mockDownload } = vi.hoisted(() => ({
  mockDelete: vi.fn(async (_prev: unknown, _fd: FormData) => ({})),
  mockDownload: vi.fn(async () => ({ json: '{}' })),
}));

vi.mock('@/app/(frontend)/mein-bereich/actions', () => ({
  deleteAccountFormAction: (...args: unknown[]) => mockDelete(...args),
  downloadDataAction: (...args: unknown[]) => mockDownload(...args),
}));

describe('AccountActions', () => {
  it('renders delete + export buttons for non-admin', () => {
    render(<AccountActions isAdmin={false} />);
    expect(
      screen.getByRole('button', { name: /daten exportieren/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /account löschen/i }),
    ).toBeInTheDocument();
  });

  it('hides delete button for admin', () => {
    render(<AccountActions isAdmin={true} />);
    expect(
      screen.queryByRole('button', { name: /account löschen/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /daten exportieren/i }),
    ).toBeInTheDocument();
  });
});
