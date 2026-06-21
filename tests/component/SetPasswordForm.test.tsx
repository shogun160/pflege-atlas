import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SetPasswordForm } from '@/components/SetPasswordForm';

const { mockAction } = vi.hoisted(() => ({
  mockAction: vi.fn(async (_prev: unknown, _fd: FormData) => ({})),
}));

vi.mock('@/app/(frontend)/passwort-setzen/actions', () => ({
  setPasswordFormAction: (...args: unknown[]) => mockAction(...args),
}));

describe('SetPasswordForm', () => {
  it('renders two password fields + DSGVO checkbox in invitation mode', () => {
    render(<SetPasswordForm token="abc" mode="invitation" />);
    expect(screen.getByLabelText(/neues passwort/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/passwort wiederholen/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/datenschutz/i)).toBeInTheDocument();
  });

  it('omits DSGVO checkbox in reset mode', () => {
    render(<SetPasswordForm token="abc" mode="reset" />);
    expect(screen.getByLabelText(/neues passwort/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/datenschutz/i)).not.toBeInTheDocument();
  });

  it('shows error state', () => {
    render(
      <SetPasswordForm
        token="abc"
        mode="invitation"
        initialState={{ error: 'Token abgelaufen' }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/abgelaufen/i);
  });

  it('passes token + mode via hidden inputs', () => {
    const { container } = render(<SetPasswordForm token="abc-123" mode="reset" />);
    expect(container.querySelector('input[name="token"]')).toHaveAttribute('value', 'abc-123');
    expect(container.querySelector('input[name="mode"]')).toHaveAttribute('value', 'reset');
  });
});
