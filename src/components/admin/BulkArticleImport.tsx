'use client';

import { useState, useRef, useTransition } from 'react';
import type { ImportRow, ImportResultRow } from '@/lib/article-import/types';

type Phase = 'idle' | 'parsing' | 'preview' | 'importing' | 'result';

interface Props {
  parseFilesAction: (formData: FormData) => Promise<ImportRow[]>;
  runImportAction: (rows: ImportRow[]) => Promise<ImportResultRow[]>;
}

const STATUS_LABEL: Record<string, string> = {
  ready: '✅ neu',
  'skip-duplicate': '⚠️ Slug existiert',
  invalid: '❌ Validierungsfehler',
  created: '✅ angelegt',
};

export function BulkArticleImport({ parseFilesAction, runImportAction }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ImportResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append('files', f);
    setPhase('parsing');
    setError(null);
    startTransition(async () => {
      try {
        const parsedRows = await parseFilesAction(fd);
        setRows(parsedRows);
        setPhase('preview');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Parsen');
        setPhase('idle');
      }
    });
  };

  const onConfirmImport = () => {
    setPhase('importing');
    startTransition(async () => {
      try {
        const res = await runImportAction(rows);
        setResults(res);
        setPhase('result');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Import');
        setPhase('preview');
      }
    });
  };

  const onReset = () => {
    setRows([]);
    setResults([]);
    setError(null);
    setOpenDetails(new Set());
    setPhase('idle');
    if (inputRef.current) inputRef.current.value = '';
  };

  const toggleDetails = (filename: string) => {
    setOpenDetails((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const readyCount = rows.filter((r) => r.status === 'ready').length;

  if (phase === 'idle' || phase === 'parsing') {
    return (
      <div className="bulk-import" data-phase={phase}>
        <h1>Artikel-Bulk-Import</h1>
        <p>
          Lade mehrere <code>.md</code>-Dateien (oder ein <code>.zip</code>) hoch.
          Max 50 Dateien, je ≤ 256 KB. Importierte Artikel landen als
          <strong> Entwurf</strong> und durchlaufen den normalen Editorial-Workflow.
        </p>
        <label
          htmlFor="bulk-import-file"
          style={{
            display: 'block',
            border: '2px dashed var(--theme-elevation-300, #ccc)',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            borderRadius: '8px',
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFilesSelected(e.dataTransfer.files);
          }}
        >
          {phase === 'parsing' ? 'Lese Dateien…' : 'Dateien hier ablegen oder klicken zum Auswählen'}
        </label>
        <input
          ref={inputRef}
          id="bulk-import-file"
          data-testid="bulk-import-file-input"
          type="file"
          multiple
          accept=".md,.zip"
          hidden
          onChange={(e) => onFilesSelected(e.target.files)}
        />
        {error && <p role="alert" style={{ color: 'var(--theme-error-500, #c00)' }}>{error}</p>}
      </div>
    );
  }

  if (phase === 'preview' || phase === 'importing') {
    return (
      <div className="bulk-import" data-phase={phase}>
        <h1>Vorschau ({rows.length} Datei{rows.length === 1 ? '' : 'en'})</h1>
        <p aria-live="polite">{readyCount} Artikel werden importiert.</p>
        {error && <p role="alert" style={{ color: 'var(--theme-error-500, #c00)' }}>{error}</p>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">Datei</th>
              <th align="left">Titel</th>
              <th align="left">Slug</th>
              <th align="left">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PreviewRow
                key={row.filename}
                row={row}
                open={openDetails.has(row.filename)}
                onToggle={() => toggleDetails(row.filename)}
              />
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={onConfirmImport} disabled={readyCount === 0 || phase === 'importing'}>
            {phase === 'importing' ? 'Importiere…' : `Import bestätigen (${readyCount})`}
          </button>
          <button type="button" onClick={onReset} disabled={phase === 'importing'}>
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  // result
  return (
    <div className="bulk-import" data-phase="result">
      <h1>Ergebnis</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th align="left">Datei</th>
            <th align="left">Status</th>
            <th align="left">Details</th>
          </tr>
        </thead>
        <tbody>
          {results.map((res) => (
            <tr key={res.filename}>
              <td>{res.filename}</td>
              <td>{STATUS_LABEL[res.status] ?? res.status}</td>
              <td>
                {res.adminUrl ? (
                  <a href={res.adminUrl}>Artikel öffnen</a>
                ) : res.error ? (
                  <span>{res.error}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={onReset} style={{ marginTop: '1rem' }}>
        Neuen Import starten
      </button>
    </div>
  );
}

function PreviewRow({ row, open, onToggle }: {
  row: ImportRow;
  open: boolean;
  onToggle: () => void;
}) {
  const issues = row.parseResult.ok ? row.parseResult.article.warnings : row.parseResult.issues;
  return (
    <>
      <tr>
        <td><code>{row.filename}</code></td>
        <td>{row.title || '—'}</td>
        <td><code>{row.resolvedSlug || '—'}</code></td>
        <td>{STATUS_LABEL[row.status] ?? row.status}</td>
        <td>
          <button type="button" onClick={onToggle} aria-expanded={open}>
            {open ? 'Schließen' : 'Details'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5}>
            {issues.length === 0 ? (
              <em>Keine Auffälligkeiten.</em>
            ) : (
              <ul>
                {issues.map((i, idx) => (
                  <li key={idx}>
                    <strong>{i.severity === 'hard' ? 'Fehler' : 'Warnung'}:</strong>{' '}
                    {i.message}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
