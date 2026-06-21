'use client';

import { useActionState, useState } from 'react';
import {
  deleteAccountFormAction,
  downloadDataAction,
  type DeleteFormState,
} from '@/app/(frontend)/mein-bereich/actions';

export function AccountActions({ isAdmin }: { isAdmin: boolean }) {
  const [state, deleteAction] = useActionState(
    deleteAccountFormAction,
    {} as DeleteFormState,
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExportError(null);
    setExporting(true);
    try {
      const result = await downloadDataAction();
      if (result.error || !result.json) {
        setExportError(result.error ?? 'Export fehlgeschlagen.');
        return;
      }
      const blob = new Blob([result.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pflegeatlas-daten-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded border border-rule px-3 py-1 disabled:opacity-60"
        >
          {exporting ? 'Wird exportiert …' : 'Daten exportieren (JSON)'}
        </button>
        {exportError && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {exportError}
          </p>
        )}
      </div>
      {!isAdmin && (
        <div>
          {!showConfirm ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="text-red-700 underline"
            >
              Account löschen
            </button>
          ) : (
            <form
              action={deleteAction}
              className="space-y-2 rounded border border-red-300 bg-red-50 p-4"
            >
              <p className="text-sm">
                <strong>Achtung:</strong> Dein Account wird unwiderruflich
                anonymisiert. Tippe <code>LÖSCHEN</code> in das Feld und
                bestätige.
              </p>
              <input
                name="confirmation"
                type="text"
                required
                aria-label="Bestätigung"
                className="w-full rounded border border-rule px-2 py-1"
              />
              {state.error && (
                <p role="alert" className="text-sm text-red-700">
                  {state.error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="rounded border border-rule px-3 py-1"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded bg-red-700 px-3 py-1 text-white"
                >
                  Endgültig löschen
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
