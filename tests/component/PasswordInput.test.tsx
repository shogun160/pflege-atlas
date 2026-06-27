import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '@/components/PasswordInput';

describe('PasswordInput', () => {
  it('renders type="password" by default with show-label', () => {
    render(<PasswordInput aria-label="Passwort" />);
    const input = screen.getByLabelText(/passwort/i, { selector: 'input' });
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: /passwort anzeigen/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles to type="text" when toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Passwort" />);
    const toggle = screen.getByRole('button', { name: /passwort anzeigen/i });
    await user.click(toggle);
    const input = screen.getByLabelText(/passwort/i, { selector: 'input' });
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /passwort verbergen/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('toggles back to type="password" on second click', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Passwort" />);
    const toggle = screen.getByRole('button', { name: /passwort anzeigen/i });
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: /passwort verbergen/i }));
    const input = screen.getByLabelText(/passwort/i, { selector: 'input' });
    expect(input).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /passwort anzeigen/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('passes input props through (id, name, required, autoComplete, defaultValue)', () => {
    render(
      <PasswordInput
        id="password-test"
        name="password"
        required
        autoComplete="new-password"
        defaultValue="initial-value"
      />,
    );
    const input = document.getElementById('password-test') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('name', 'password');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('autoComplete', 'new-password');
    expect(input).toHaveValue('initial-value');
  });

  it('keeps independent state across multiple instances', async () => {
    const user = userEvent.setup();
    render(
      <>
        <PasswordInput id="pw-1" aria-label="Passwort 1" />
        <PasswordInput id="pw-2" aria-label="Passwort 2" />
      </>,
    );
    const toggles = screen.getAllByRole('button', { name: /passwort anzeigen/i });
    expect(toggles).toHaveLength(2);
    await user.click(toggles[0]);
    // Now toggle-1 says "verbergen", toggle-2 still says "anzeigen"
    expect(screen.getAllByRole('button', { name: /passwort anzeigen/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /passwort verbergen/i })).toHaveLength(1);
    const input1 = document.getElementById('pw-1') as HTMLInputElement;
    const input2 = document.getElementById('pw-2') as HTMLInputElement;
    expect(input1.type).toBe('text');
    expect(input2.type).toBe('password');
  });
});
