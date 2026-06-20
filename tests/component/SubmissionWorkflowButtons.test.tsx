import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  inReviewAction: vi.fn().mockResolvedValue({ ok: true }),
  acceptAction: vi.fn().mockResolvedValue({ ok: true }),
  rejectAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/app/(payload)/admin/submission-actions', () => mocks);

// @payloadcms/ui pulls in CSS via react-image-crop which jsdom can't parse —
// stub the only export we use (Button) with a plain HTML button.
vi.mock('@payloadcms/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    buttonStyle?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { SubmissionWorkflowButtons } from '@/components/admin/SubmissionWorkflowButtons';

describe('SubmissionWorkflowButtons', () => {
  it('shows "In Review nehmen" when status=pending', () => {
    render(<SubmissionWorkflowButtons submissionId={7} reviewStatus="pending" />);
    expect(screen.getByText(/In Review nehmen/)).toBeInTheDocument();
    expect(screen.queryByText(/^Annehmen$/)).not.toBeInTheDocument();
  });

  it('shows "Annehmen" and "Ablehnen" when status=in_review', () => {
    render(<SubmissionWorkflowButtons submissionId={7} reviewStatus="in_review" />);
    expect(screen.getByText(/Annehmen/)).toBeInTheDocument();
    expect(screen.getByText(/Ablehnen/)).toBeInTheDocument();
  });

  it('shows nothing when status=accepted', () => {
    const { container } = render(
      <SubmissionWorkflowButtons submissionId={7} reviewStatus="accepted" />,
    );
    expect(container.textContent).toMatch(/Übernommen/);
  });

  it('calls inReviewAction when "In Review nehmen" clicked', async () => {
    render(<SubmissionWorkflowButtons submissionId={7} reviewStatus="pending" />);
    fireEvent.click(screen.getByText(/In Review nehmen/));
    expect(mocks.inReviewAction).toHaveBeenCalledWith(7);
  });
});
