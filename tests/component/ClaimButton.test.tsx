import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the server-actions module before importing ClaimButton, otherwise
// the `'use server'` directive + `next/cache` + Payload-config import chain
// blows up in jsdom.
vi.mock('@/app/(payload)/admin/claim-actions', () => ({
  claimArticleAction: vi.fn(async () => ({ ok: true })),
  claimSubmissionAction: vi.fn(async () => ({ ok: true })),
}));

import { ClaimButton } from '@/components/admin/ClaimButton';

describe('ClaimButton', () => {
  it('shows Übernehmen button when no currentReviewer', () => {
    render(
      <ClaimButton
        id={1}
        type="article"
        currentReviewerId={null}
        currentReviewerName={null}
        sessionUserId={5}
      />,
    );
    expect(
      screen.getByRole('button', { name: /übernehmen/i }),
    ).toBeInTheDocument();
  });

  it('shows "Aktuell bei X" when claimed by other reviewer', () => {
    render(
      <ClaimButton
        id={1}
        type="article"
        currentReviewerId={3}
        currentReviewerName="Anna"
        sessionUserId={5}
      />,
    );
    expect(screen.getByText(/aktuell bei/i)).toBeInTheDocument();
    expect(screen.getByText('Anna')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /übernehmen/i }),
    ).not.toBeInTheDocument();
  });

  it('shows "Du bearbeitest" when claimed by self', () => {
    render(
      <ClaimButton
        id={1}
        type="article"
        currentReviewerId={5}
        currentReviewerName="Me"
        sessionUserId={5}
      />,
    );
    expect(screen.getByText(/du bearbeitest/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /übernehmen/i }),
    ).not.toBeInTheDocument();
  });
});
