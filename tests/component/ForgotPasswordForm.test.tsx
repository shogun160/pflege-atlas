import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';

const { mockAction } = vi.hoisted(() => ({
  mockAction: vi.fn(async (_prev: unknown, _fd: FormData) => ({ submitted: true })),
}));

vi.mock('@/app/(frontend)/passwort-vergessen/actions', () => ({
  forgotPasswordFormAction: (...args: [unknown, FormData]) => mockAction(...args),
}));

describe('ForgotPasswordForm', () => {
  it('renders email field + submit button', () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /absenden|wird gesendet/i })).toBeInTheDocument();
  });

  it('shows generic success message when submitted', () => {
    render(<ForgotPasswordForm initialState={{ submitted: true }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/wenn ein account.*existiert/i);
    expect(screen.queryByLabelText(/e-mail/i)).not.toBeInTheDocument();
  });
});
