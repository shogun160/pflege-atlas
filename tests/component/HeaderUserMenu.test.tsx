import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/auth', () => ({
  logoutAction: vi.fn(),
}));

import { HeaderUserMenu } from '@/components/HeaderUserMenu';

describe('HeaderUserMenu', () => {
  it('shows "Anmelden" link when no session', () => {
    render(<HeaderUserMenu session={null} />);
    const link = screen.getByRole('link', { name: /anmelden/i });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('shows displayName + mein-bereich link for contributor, no admin link', () => {
    render(
      <HeaderUserMenu
        session={{
          id: 1,
          email: 'anna@example.de',
          displayName: 'Anna',
          role: 'contributor',
          disabled: false,
        }}
      />,
    );
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /mein bereich/i }),
    ).toHaveAttribute('href', '/mein-bereich');
    expect(
      screen.queryByRole('link', { name: /^admin$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /logout/i }),
    ).toBeInTheDocument();
  });

  it('shows admin link for editor', () => {
    render(
      <HeaderUserMenu
        session={{
          id: 1,
          email: 'c@example.de',
          displayName: 'Christoph',
          role: 'editor',
          disabled: false,
        }}
      />,
    );
    expect(
      screen.getByRole('link', { name: /^admin$/i }),
    ).toHaveAttribute('href', '/admin');
  });

  it('shows admin link for reviewer', () => {
    render(
      <HeaderUserMenu
        session={{
          id: 1,
          email: 'r@example.de',
          displayName: 'Rita',
          role: 'reviewer',
          disabled: false,
        }}
      />,
    );
    expect(
      screen.getByRole('link', { name: /^admin$/i }),
    ).toHaveAttribute('href', '/admin');
  });

  it('falls back to email when displayName is empty', () => {
    render(
      <HeaderUserMenu
        session={{
          id: 1,
          email: 'noname@example.de',
          displayName: '',
          role: 'contributor',
          disabled: false,
        }}
      />,
    );
    expect(screen.getByText('noname@example.de')).toBeInTheDocument();
  });

  it('rendert <img> wenn session.avatarUrl gesetzt', () => {
    const session = {
      id: 1,
      email: 'anna@test.local',
      displayName: 'Anna',
      role: 'contributor' as const,
      disabled: false,
      avatar: 42,
      avatarUrl: 'https://r2.example/avatar.jpg',
    };
    render(<HeaderUserMenu session={session} />);
    const img = screen.getByRole('img', { name: /profilbild von anna/i });
    expect(img).toHaveAttribute('src', 'https://r2.example/avatar.jpg');
  });

  it('rendert Initial-Letter wenn session.avatarUrl null ist', () => {
    const session = {
      id: 1,
      email: 'anna@test.local',
      displayName: 'Anna',
      role: 'contributor' as const,
      disabled: false,
      avatar: null,
      avatarUrl: null,
    };
    render(<HeaderUserMenu session={session} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
