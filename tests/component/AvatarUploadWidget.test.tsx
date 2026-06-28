import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const modalProps = vi.hoisted(() => ({
  value: null as null | {
    file: File;
    onConfirm: (b: Blob) => void;
    onCancel: () => void;
  },
}));
vi.mock('@/components/AvatarCropModal', () => ({
  AvatarCropModal: (props: {
    file: File;
    onConfirm: (b: Blob) => void;
    onCancel: () => void;
  }) => {
    modalProps.value = props;
    return <div data-testid="avatar-crop-modal" />;
  },
}));

import { AvatarUploadWidget } from '@/components/AvatarUploadWidget';

describe('AvatarUploadWidget', () => {
  beforeEach(() => {
    modalProps.value = null;
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
    // Crop-Confirm dispatchen (post-refactor flow)
    modalProps.value!.onConfirm(new Blob(['cropped'], { type: 'image/jpeg' }));
    await new Promise((r) => setTimeout(r, 10));
    expect(container.querySelector('input[name="avatar"]')).toHaveAttribute('value', '99');

    // Reset
    const resetBtn = screen.getByRole('button', { name: /auswahl zurücksetzen/i });
    await user.click(resetBtn);
    expect(container.querySelector('input[name="avatar"]')).toHaveAttribute('value', '42');
  });

  it('sends alt + purpose inside the _payload JSON field (Payload v3 multipart convention)', async () => {
    const user = userEvent.setup();
    const fakeJson = { doc: { id: 7, url: 'https://r2.example/a.jpg' } };
    const fakeRes = {
      ok: true,
      json: async () => fakeJson,
      text: async () => JSON.stringify(fakeJson),
    } as unknown as Response;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeRes);

    render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna Musterfrau"
        email="anna@test.local"
      />,
    );

    const file = new File(['x'], 'new.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/profilbild auswählen/i), file);
    modalProps.value!.onConfirm(new Blob(['cropped'], { type: 'image/jpeg' }));
    await new Promise((r) => setTimeout(r, 10));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const fd = init?.body as FormData;
    expect(fd).toBeInstanceOf(FormData);
    // alt / purpose must NOT be top-level FormData entries — Payload v3 ignores them
    expect(fd.get('alt')).toBeNull();
    expect(fd.get('purpose')).toBeNull();
    // they must arrive inside the _payload JSON string
    const payloadJson = fd.get('_payload');
    expect(typeof payloadJson).toBe('string');
    const parsed = JSON.parse(payloadJson as string) as { alt: string; purpose: string };
    expect(parsed.purpose).toBe('avatar');
    expect(parsed.alt).toMatch(/Anna Musterfrau/);
  });

  it('file pick opens the crop modal and does NOT start upload', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna"
        email="anna@test.local"
      />,
    );

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/profilbild auswählen/i), file);

    expect(screen.getByTestId('avatar-crop-modal')).toBeInTheDocument();
    expect(modalProps.value?.file).toBe(file);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('crop confirm uploads the cropped Blob via _payload multipart', async () => {
    const user = userEvent.setup();
    const fakeJson = { doc: { id: 11, url: 'https://r2.example/cropped.jpg' } };
    const fakeRes = {
      ok: true,
      json: async () => fakeJson,
      text: async () => JSON.stringify(fakeJson),
    } as unknown as Response;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(fakeRes);

    const { container } = render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna"
        email="anna@test.local"
      />,
    );

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText(/profilbild auswählen/i), file);

    const blob = new Blob(['cropped'], { type: 'image/jpeg' });
    modalProps.value!.onConfirm(blob);
    await new Promise((r) => setTimeout(r, 10));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    const fd = init?.body as FormData;
    const uploaded = fd.get('file') as Blob;
    expect(uploaded).toBeInstanceOf(Blob);
    expect(uploaded.type).toBe('image/jpeg');
    // _payload-JSON struktur muss bestehen bleiben (PR #42 Regression-Guard)
    const payloadJson = fd.get('_payload');
    expect(typeof payloadJson).toBe('string');
    const parsed = JSON.parse(payloadJson as string) as { purpose: string };
    expect(parsed.purpose).toBe('avatar');
    expect(container.querySelector('input[name="avatar"]')).toHaveAttribute('value', '11');
    // Modal ist nach Confirm wieder weg
    expect(screen.queryByTestId('avatar-crop-modal')).not.toBeInTheDocument();
  });

  it('crop cancel removes modal, does NOT upload, resets file input', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna"
        email="anna@test.local"
      />,
    );

    const fileInput = screen.getByLabelText(/profilbild auswählen/i) as HTMLInputElement;
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    modalProps.value!.onCancel();
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByTestId('avatar-crop-modal')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fileInput.value).toBe('');
  });

  it('clicking the avatar preview triggers the file picker', async () => {
    const user = userEvent.setup();
    render(
      <AvatarUploadWidget
        currentAvatarUrl={null}
        currentAvatarId={null}
        displayName="Anna"
        email="anna@test.local"
      />,
    );
    const fileInput = screen.getByLabelText(/profilbild auswählen/i) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');
    const avatarBtn = screen.getByRole('button', { name: /profilbild ändern/i });
    await user.click(avatarBtn);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
