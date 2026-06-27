import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoginForm } from '@/components/LoginForm';

const { mockAction } = vi.hoisted(() => ({
  mockAction: vi.fn(async (_prev: unknown, _fd: FormData) => ({})),
}));

vi.mock('@/app/(frontend)/login/actions', () => ({
  loginFormAction: (...args: [unknown, FormData]) => mockAction(...args),
}));

describe('LoginForm', () => {
  it('renders email + password fields + submit + forgot-link', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/passwort/i, { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anmelden/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /passwort vergessen/i })).toHaveAttribute(
      'href',
      '/passwort-vergessen',
    );
  });

  it('shows error message when state.error is set', () => {
    render(<LoginForm initialState={{ error: 'Anmeldung fehlgeschlagen' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/anmeldung fehlgeschlagen/i);
  });

  it('preserves email from previous attempt in defaultValue', () => {
    render(<LoginForm initialState={{ email: 'a@b.c', error: 'x' }} />);
    expect(screen.getByLabelText(/e-mail/i)).toHaveValue('a@b.c');
  });

  it('passes next via hidden input', () => {
    const { container } = render(<LoginForm next="/admin" />);
    const hidden = container.querySelector('input[type="hidden"][name="next"]');
    expect(hidden).toHaveAttribute('value', '/admin');
  });
});
