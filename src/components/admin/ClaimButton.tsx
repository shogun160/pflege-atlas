'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  claimArticleAction,
  claimSubmissionAction,
} from '@/app/(payload)/admin/claim-actions';

export function ClaimButton({
  id,
  type,
  currentReviewerId,
  currentReviewerName,
  sessionUserId,
}: {
  id: number;
  type: 'article' | 'submission';
  currentReviewerId: number | null;
  currentReviewerName: string | null;
  sessionUserId: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (currentReviewerId === sessionUserId) {
    return (
      <div style={{ padding: 8, fontSize: 13 }}>Du bearbeitest das gerade.</div>
    );
  }

  if (currentReviewerId !== null) {
    return (
      <div style={{ padding: 8, fontSize: 13 }}>
        Aktuell bei <strong>{currentReviewerName ?? 'unbekannt'}</strong>.
      </div>
    );
  }

  function claim() {
    setMessage(null);
    startTransition(async () => {
      const fn = type === 'article' ? claimArticleAction : claimSubmissionAction;
      const result = await fn(id);
      if (result.ok) {
        setMessage(null);
        router.refresh();
      } else {
        setMessage(`Fehler: ${result.error ?? 'unbekannt'}`);
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={claim}
        disabled={pending}
        style={{
          padding: '6px 12px',
          background: '#1f5e6d',
          color: '#fff',
          borderRadius: 4,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {pending ? 'Übernehme…' : 'Übernehmen'}
      </button>
      {message && <p style={{ margin: 0, fontSize: 12 }}>{message}</p>}
    </div>
  );
}
