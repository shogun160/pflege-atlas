'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@payloadcms/ui';
import {
  inReviewAction,
  acceptAction,
  rejectAction,
} from '@/app/(payload)/admin/submission-actions';

type Props = { submissionId: number; reviewStatus: string };

export function SubmissionWorkflowButtons({ submissionId, reviewStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(fn: (id: number) => Promise<{ ok: boolean; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn(submissionId);
      if (res.ok) {
        setMessage(null);
        router.refresh();
      } else {
        setMessage(`Fehler: ${res.error ?? 'unbekannt'}`);
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
      {reviewStatus === 'pending' && (
        <Button
          buttonStyle="primary"
          disabled={pending}
          onClick={() => run(inReviewAction)}
        >
          In Review nehmen
        </Button>
      )}
      {reviewStatus === 'in_review' && (
        <>
          <Button
            buttonStyle="primary"
            disabled={pending}
            onClick={() => run(acceptAction)}
          >
            Annehmen
          </Button>
          <Button
            buttonStyle="secondary"
            disabled={pending}
            onClick={() => run(rejectAction)}
          >
            Ablehnen
          </Button>
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
