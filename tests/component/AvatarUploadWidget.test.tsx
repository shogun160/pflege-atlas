import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvatarUploadWidget } from '@/components/AvatarUploadWidget';

describe('AvatarUploadWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial-letter when no avatar set', () => {
    render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna Musterfrau"
        email="anna@test.local"
      />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders <img> when currentAvatarUrl is set', () => {
    render(
      <AvatarUploadWidget
        currentAvatarUrl="https://r2.example/avatar.jpg"
        currentAvatarId={42}
        displayName="Anna"
        email="anna@test.local"
      />,
    );
    const img = screen.getByRole('img', { name: /aktuelles profilbild/i });
    expect(img).toHaveAttribute('src', 'https://r2.example/avatar.jpg');
  });

  it('shows error when file > 5 MB', async () => {
    const user = userEvent.setup();
    render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna"
        email="anna@test.local"
      />,
    );
    const big = new File(
      [new Uint8Array(6 * 1024 * 1024)],
      'big.png',
      { type: 'image/png' },
    );
    const fileInput = screen.getByLabelText(/profilbild auswählen/i);
    await user.upload(fileInput, big);
    expect(screen.getByRole('alert')).toHaveTextContent(/zu groß/i);
  });

  it('shows error for disallowed MIME type', async () => {
    const user = userEvent.setup();
    render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna"
        email="anna@test.local"
      />,
    );
    const gif = new File(['x'], 'animated.gif', { type: 'image/gif' });
    const fileInput = screen.getByLabelText(/profilbild auswählen/i);
    await user.upload(fileInput, gif);
    expect(screen.getByRole('alert')).toHaveTextContent(/jpeg, png oder webp/i);
  });

  it('remove button hides preview and sets hidden input to empty', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AvatarUploadWidget
        currentAvatarUrl="https://r2.example/avatar.jpg"
        currentAvatarId={42}
        displayName="Anna"
        email="anna@test.local"
      />,
    );
    expect(screen.getByRole('img')).toBeInTheDocument();
    const removeBtn = screen.getByRole('button', { name: /bild entfernen/i });
    await user.click(removeBtn);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    const hidden = container.querySelector('input[name="avatar"]');
    expect(hidden).toHaveAttribute('value', '');
  });

  it('reset after upload returns to persisted state', async () => {
    const user = userEvent.setup();
    const fakeJson = { doc: { id: 99, url: 'https://r2.example/new.jpg' } };
    const fakeRes = {
      ok: true,
      json: async () => fakeJson,
      text: async () => JSON.stringify(fakeJson),
    } as unknown as Response;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeRes);

    const { container } = render(
      <AvatarUploadWidget
        currentAvatarUrl="https://r2.example/old.jpg"
        currentAvatarId={42}
        displayName="Anna"
        email="anna@test.local"
      />,
    );

    // Initial: persisted
    expect(container.querySelector('input[name="avatar"]')).toHaveAttribute('value', '42');

    // Upload new
    const file = new File(['x'], 'new.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/profilbild auswählen/i), file);
    expect(container.querySelector('input[name="avatar"]')).toHaveAttribute('value', '99');

    // Reset
    const resetBtn = screen.getByRole('button', { name: /auswahl zurücksetzen/i });
    await user.click(resetBtn);
    expect(container.querySelector('input[name="avatar"]')).toHaveAttribute('value', '42');
  });
});
