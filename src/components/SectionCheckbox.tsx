'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { isLexicalDirty } from '@/lib/lexical-normalize';

const LexicalEditor = dynamic(
  () => import('@/components/LexicalEditor').then((m) => m.LexicalEditor),
  {
    ssr: false,
    loading: () => <div className="text-ink-muted">Editor lädt…</div>,
  },
);

interface Props {
  sectionKey: 'definition' | 'praxis' | 'risiken' | 'quellen';
  label: string;
  originalValue: string;
  currentValue: string;
  onChange: (json: string) => void;
  onCheckedChange: (checked: boolean) => void;
  checked: boolean;
}

function isDirty(current: string, original: string): boolean {
  if (!current) return false;
  try {
    const c = JSON.parse(current);
    const o = JSON.parse(original);
    return isLexicalDirty(c, o);
  } catch {
    return current !== original;
  }
}

export function SectionCheckbox({
  sectionKey,
  label,
  originalValue,
  currentValue,
  onChange,
  onCheckedChange,
  checked,
}: Props) {
  const [warning, setWarning] = useState<string | null>(null);
  const dirty = checked && isDirty(currentValue, originalValue);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    if (!next && dirty) {
      e.preventDefault();
      setWarning(
        'Diese Sektion enthält Änderungen. Klicke „Verwerfen", um die Sektion zu entfernen.',
      );
      return;
    }
    setWarning(null);
    if (next && !checked) {
      // Vorladen mit Original beim Anhaken
      onChange(originalValue);
    }
    onCheckedChange(next);
  };

  const handleDiscard = () => {
    onChange('');
    onCheckedChange(false);
    setWarning(null);
  };

  const capitalKey = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 font-semibold">
        <input
          type="checkbox"
          name="selectedSections"
          value={sectionKey}
          checked={checked}
          onChange={handleCheckboxChange}
          className="h-4 w-4"
        />
        {label}
      </label>
      {warning && (
        <p role="alert" className="text-sm text-accent">
          {warning}
        </p>
      )}
      {checked && (
        <>
          <LexicalEditor
            value={currentValue || originalValue}
            onChange={onChange}
            ariaLabel={`Editor für ${label}`}
          />
          {dirty && (
            <button
              type="button"
              onClick={handleDiscard}
              className="text-sm text-accent underline"
            >
              Verwerfen
            </button>
          )}
        </>
      )}
      <input
        type="hidden"
        name={`edited${capitalKey}`}
        value={checked && dirty ? currentValue : ''}
        readOnly
      />
    </div>
  );
}
