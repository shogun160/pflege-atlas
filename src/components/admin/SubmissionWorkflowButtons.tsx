'use client';

import { useState, useTransition } from 'react';
import {
  inReviewAction,
  acceptAction,
  rejectAction,
} from '@/app/(payload)/admin/submission-actions';

type Props = { submissionId: number; reviewStatus: string };

export function SubmissionWorkflowButtons({ submissionId, reviewStatus }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(fn: (id: number) => Promise<{ ok: boolean; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn(submissionId);
      if (res.ok) setMessage('OK — bitte Seite neu laden, um neuen Status zu sehen.');
      else setMessage(`Fehler: ${res.error ?? 'unbekannt'}`);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
      {reviewStatus === 'pending' && (
        <button type="button" disabled={pending} onClick={() => run(inReviewAction)}>
          In Review nehmen
        </button>
      )}
      {reviewStatus === 'in_review' && (
        <>
          <button type="button" disabled={pending} onClick={() => run(acceptAction)}>
            Annehmen
          </button>
          <button type="button" disabled={pending} onClick={() => run(rejectAction)}>
            Ablehnen
          </button>
        </>
      )}
      {reviewStatus === 'accepted' && (
        <p style={{ margin: 0, fontStyle: 'italic' }}>Übernommen.</p>
      )}
      {reviewStatus === 'rejected' && (
        <p style={{ margin: 0, fontStyle: 'italic' }}>Abgelehnt.</p>
      )}
      {message && <p style={{ margin: 0, fontSize: 12 }}>{message}</p>}
    </div>
  );
}
