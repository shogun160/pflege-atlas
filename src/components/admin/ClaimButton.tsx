'use client';

import { useState } from 'react';
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
  const [busy, setBusy] = useState(false);

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

  async function claim() {
    setBusy(true);
    const fn = type === 'article' ? claimArticleAction : claimSubmissionAction;
    const result = await fn(id);
    setBusy(false);
    if (result.ok) {
      window.location.reload();
    } else {
      alert(result.error ?? 'Übernahme fehlgeschlagen.');
    }
  }

  return (
    <button
      onClick={claim}
      disabled={busy}
      style={{
        padding: '6px 12px',
        background: '#1f5e6d',
        color: '#fff',
        borderRadius: 4,
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {busy ? 'Übernehme…' : 'Übernehmen'}
    </button>
  );
}
