import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionCheckbox } from '@/components/SectionCheckbox';

// Hoisted mock: shared between next/dynamic and the LexicalEditor module
const { MockEditor } = vi.hoisted(() => ({
  MockEditor: ({
    value,
    onChange,
    ariaLabel,
  }: {
    value: string;
    onChange: (s: string) => void;
    ariaLabel?: string;
  }) => (
    <textarea
      role="textbox"
      aria-label={ariaLabel ?? 'mock-editor'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// next/dynamic in jsdom would otherwise hold the editor in "loading" forever.
// Returning the mock directly bypasses dynamic's lazy state.
vi.mock('next/dynamic', () => ({
  default: () => MockEditor,
}));

vi.mock('@/components/LexicalEditor', () => ({
  LexicalEditor: MockEditor,
  emptyLexicalJson: () => JSON.stringify({ type: 'root', version: 1, children: [] }),
}));

const originalLexical = JSON.stringify({
  type: 'root',
  version: 1,
  children: [
    {
      type: 'paragraph',
      version: 1,
      children: [{ type: 'text', version: 1, text: 'Original', format: 0 }],
    },
  ],
});

const editedLexical = JSON.stringify({
  type: 'root',
  version: 1,
  children: [
    {
      type: 'paragraph',
      version: 1,
      children: [{ type: 'text', version: 1, text: 'GEÄNDERT', format: 0 }],
    },
  ],
});

describe('SectionCheckbox', () => {
  it('renders unchecked + hidden editor by default', () => {
    render(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue=""
        onChange={() => {}}
        onCheckedChange={() => {}}
        checked={false}
      />,
    );
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows editor when checked', () => {
    render(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue={originalLexical}
        onChange={() => {}}
        onCheckedChange={() => {}}
        checked
      />,
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('allows unchecking when current equals original (clean)', () => {
    const onCheckedChange = vi.fn();
    render(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue={originalLexical}
        onChange={() => {}}
        onCheckedChange={onCheckedChange}
        checked
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it('blocks unchecking when current differs from original (dirty) and shows warning', () => {
    const onCheckedChange = vi.fn();
    render(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue={editedLexical}
        onChange={() => {}}
        onCheckedChange={onCheckedChange}
        checked
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/enthält Änderungen/i);
  });

  it('shows the Verwerfen button only when dirty', () => {
    const { rerender } = render(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue={originalLexical}
        onChange={() => {}}
        onCheckedChange={() => {}}
        checked
      />,
    );
    expect(screen.queryByRole('button', { name: /verwerfen/i })).not.toBeInTheDocument();
    rerender(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue={editedLexical}
        onChange={() => {}}
        onCheckedChange={() => {}}
        checked
      />,
    );
    expect(screen.getByRole('button', { name: /verwerfen/i })).toBeInTheDocument();
  });

  it('Verwerfen click resets editor and unchecks', () => {
    const onCheckedChange = vi.fn();
    const onChange = vi.fn();
    render(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue={editedLexical}
        onChange={onChange}
        onCheckedChange={onCheckedChange}
        checked
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /verwerfen/i }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });
});
