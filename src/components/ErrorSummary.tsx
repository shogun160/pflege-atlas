'use client';

import { useEffect, useRef } from 'react';

type Props = {
  errors: Record<string, string>;
  fieldLabels?: Record<string, string>;
};

export function ErrorSummary({ errors, fieldLabels = {} }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = Object.entries(errors);

  useEffect(() => {
    if (entries.length > 0 && ref.current) {
      ref.current.focus();
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby="error-summary-title"
      className="mb-6 rounded-lg border-l-4 border-accent bg-surface p-4 text-ink"
    >
      <h2 id="error-summary-title" className="mb-2 font-semibold text-accent">
        Bitte korrigiere folgende Eingaben:
      </h2>
      <ul className="list-disc pl-5 space-y-1 text-sm">
        {entries.map(([field, message]) => (
          <li key={field}>
            <a href={`#field-${field}`} className="text-brand underline-offset-2 hover:underline">
              {fieldLabels[field] ?? field}: {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
