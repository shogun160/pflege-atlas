import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the server-action module before importing InviteUserButton, otherwise
// the `'use server'` directive + `next/cache` + Payload-config import chain
// blows up in jsdom.
vi.mock('@/app/(payload)/admin/invite-action', () => ({
  inviteUserFromAdminAction: vi.fn(async () => ({ ok: true })),
}));

import { InviteUserButton } from '@/components/admin/InviteUserButton';

describe('InviteUserButton', () => {
  it('admin sees all 4 role options', () => {
    render(<InviteUserButton sessionRole="admin" />);
    fireEvent.click(screen.getByRole('button', { name: /einladen/i }));
    expect(screen.getByRole('option', { name: /admin/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /redakteur/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /reviewer/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /beitragende/i })).toBeInTheDocument();
  });

  it('editor sees only reviewer + contributor', () => {
    render(<InviteUserButton sessionRole="editor" />);
    fireEvent.click(screen.getByRole('button', { name: /einladen/i }));
    expect(screen.queryByRole('option', { name: /^admin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^redakteur/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /reviewer/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /beitragende/i })).toBeInTheDocument();
  });

  it('reviewer + contributor see no button', () => {
    const { container: c1 } = render(<InviteUserButton sessionRole="reviewer" />);
    expect(c1.querySelector('button')).toBeNull();
    const { container: c2 } = render(<InviteUserButton sessionRole="contributor" />);
    expect(c2.querySelector('button')).toBeNull();
  });
});
