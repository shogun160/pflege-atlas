'use client';

import { useMemo } from 'react';
import { diffSection } from '@/lib/submission-section-diff';

type Props =
  | { mode: 'correction'; original: string; edited: string; sectionLabel: string }
  | { mode: 'new_article'; edited: string; sectionLabel: string; original?: undefined };

export function InlineSectionDiff(props: Props) {
  const { mode, edited, sectionLabel } = props;

  if (mode === 'new_article') {
    return (
      <div style={{ padding: 8, background: '#f8f8f8', borderRadius: 4 }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Vorschlag: {sectionLabel}</h4>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
          {edited || '(leer)'}
        </pre>
      </div>
    );
  }

  const { original } = props;
  if (!edited) {
    return (
      <div style={{ padding: 8, fontStyle: 'italic', color: '#666' }}>
        {sectionLabel}: Nicht editiert.
      </div>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result = useMemo(() => diffSection(original, edited), [original, edited]);

  if (!result.changed) {
    return (
      <div style={{ padding: 8, fontStyle: 'italic', color: '#666' }}>
        {sectionLabel}: Keine Änderung gegenüber dem Original.
      </div>
    );
  }

  return (
    <div style={{ padding: 8, background: '#f8f8f8', borderRadius: 4 }}>
      <h4 style={{ margin: '0 0 8px 0' }}>{sectionLabel} — Änderungen</h4>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
        {result.parts.map((p, i) => {
          const prefix = p.kind === 'add' ? '+ ' : p.kind === 'remove' ? '- ' : '  ';
          const color =
            p.kind === 'add' ? '#0a7d2c' : p.kind === 'remove' ? '#b8553d' : '#333';
          return (
            <span key={i} style={{ color, display: 'block' }}>
              {p.text
                .split('\n')
                .filter((l, idx, arr) => idx < arr.length - 1 || l.length > 0)
                .map((line) => `${prefix}${line}`)
                .join('\n')}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
