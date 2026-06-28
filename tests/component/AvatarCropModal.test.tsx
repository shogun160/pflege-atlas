import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock react-easy-crop because jsdom can't decode images.
// Capture props so tests can inspect aspect/cropShape/onCropComplete.
const cropperProps = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));
vi.mock('react-easy-crop', () => ({
  default: (props: Record<string, unknown>) => {
    cropperProps.value = props;
    return <div data-testid="cropper" />;
  },
}));

import { AvatarCropModal } from '@/components/AvatarCropModal';

function makeFile() {
  return new File(['x'], 'p.png', { type: 'image/png' });
}

describe('AvatarCropModal', () => {
  beforeEach(() => {
    cropperProps.value = null;
    vi.restoreAllMocks();
  });

  it('renders Cropper with aspect=1 and round preview', () => {
    render(<AvatarCropModal file={makeFile()} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByTestId('cropper')).toBeInTheDocument();
    expect(cropperProps.value?.aspect).toBe(1);
    expect(cropperProps.value?.cropShape).toBe('round');
  });

  it('Cancel-Button calls onCancel and not onConfirm', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<AvatarCropModal file={makeFile()} onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: /abbrechen/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Escape key calls onCancel', () => {
    const onCancel = vi.fn();
    render(<AvatarCropModal file={makeFile()} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Zoom-Slider has range 1-3 and updates Cropper zoom prop', async () => {
    const user = userEvent.setup();
    render(<AvatarCropModal file={makeFile()} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const slider = screen.getByLabelText('Zoom') as HTMLInputElement;
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('3');
    expect(cropperProps.value?.zoom).toBe(1);
    fireEvent.change(slider, { target: { value: '2.5' } });
    expect(cropperProps.value?.zoom).toBe(2.5);
    void user; // userEvent imported elsewhere; suppress unused
  });

  it('Übernehmen is disabled until onCropComplete fires', () => {
    render(<AvatarCropModal file={makeFile()} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /übernehmen/i });
    expect(btn).toBeDisabled();
  });

  it('Übernehmen calls onConfirm with a Blob after crop completes', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    // Spy toBlob to deliver a predictable JPEG blob synchronously.
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      cb,
    ) {
      cb(new Blob(['jpegbytes'], { type: 'image/jpeg' }));
    });
    // jsdom doesn't implement canvas 2D context — stub it so drawImage is a no-op.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    // Skip the actual <img>-loading: stub loadImage indirection via Image mock.
    Object.defineProperty(globalThis.Image.prototype, 'src', {
      set() {
        setTimeout(() => this.onload?.(new Event('load')), 0);
      },
    });

    render(<AvatarCropModal file={makeFile()} onConfirm={onConfirm} onCancel={vi.fn()} />);

    // Simulate the Cropper firing onCropComplete with pixel-area.
    (cropperProps.value?.onCropComplete as ((...args: unknown[]) => void) | undefined)?.(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 10, y: 10, width: 200, height: 200 },
    );

    await user.click(screen.getByRole('button', { name: /übernehmen/i }));

    // wait microtask for the canvas/blob async chain
    await new Promise((r) => setTimeout(r, 10));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const blob = onConfirm.mock.calls[0]![0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/jpeg');
  });
});
