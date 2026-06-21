import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileEditForm } from '@/components/ProfileEditForm';

const { mockAction } = vi.hoisted(() => ({
  mockAction: vi.fn(async (_prev: unknown, _fd: FormData) => ({})),
}));

vi.mock('@/app/(frontend)/mein-bereich/actions', () => ({
  saveProfileFormAction: (...args: unknown[]) => mockAction(...args),
}));

const user = {
  id: 1,
  email: 'x@y.de',
  displayName: 'Anna',
  bio: 'pflegerin',
  pflegerischeRolle: 'pflegefachkraft',
  bundesland: 'bayern',
  avatar: null,
};

describe('ProfileEditForm', () => {
  it('renders all whitelisted fields with current values', () => {
    render(<ProfileEditForm user={user as never} />);
    expect(screen.getByLabelText(/anzeigename/i)).toHaveValue('Anna');
    expect(screen.getByLabelText(/kurzprofil/i)).toHaveValue('pflegerin');
    expect(screen.getByLabelText(/pflegerische rolle/i)).toHaveValue(
      'pflegefachkraft',
    );
    expect(screen.getByLabelText(/bundesland/i)).toHaveValue('bayern');
  });

  it('does NOT render email or role fields', () => {
    render(<ProfileEditForm user={user as never} />);
    expect(screen.queryByLabelText(/^e-mail/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: /^rolle$/i }),
    ).not.toBeInTheDocument();
  });

  it('renders submit button with default label', () => {
    render(<ProfileEditForm user={user as never} />);
    expect(
      screen.getByRole('button', { name: /^speichern$/i }),
    ).toBeInTheDocument();
  });
});
