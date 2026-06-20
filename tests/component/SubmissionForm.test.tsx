import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/app/(frontend)/einreichen/actions', () => ({
  submitAction: vi.fn(async () => ({})),
}));

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (t: string) => void }) => (
    <button type="button" onClick={() => onSuccess('mock-token')}>
      Turnstile mock
    </button>
  ),
}));

vi.mock('@/components/NewArticleFields', () => ({
  NewArticleFields: () => <div data-testid="new-article-fields" />,
}));

vi.mock('@/components/CorrectionFields', () => ({
  CorrectionFields: () => <div data-testid="correction-fields" />,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { SubmissionForm } from '@/components/SubmissionForm';

const baseProps = {
  articles: [{ slug: 'a', title: 'A' }],
  articleSections: { definition: '', praxis: '', risiken: '', quellen: '' },
  turnstileSiteKey: 'site-key',
  initialType: 'new_article' as const,
  initialArticleSlug: '',
  initialSection: '' as '' | 'definition' | 'praxis' | 'risiken' | 'quellen',
};

describe('SubmissionForm', () => {
  it('renders NewArticleFields when type=new_article', () => {
    render(<SubmissionForm {...baseProps} initialType="new_article" />);
    expect(screen.getByTestId('new-article-fields')).toBeInTheDocument();
    expect(screen.queryByTestId('correction-fields')).not.toBeInTheDocument();
  });

  it('renders CorrectionFields when type=correction', () => {
    render(<SubmissionForm {...baseProps} initialType="correction" />);
    expect(screen.getByTestId('correction-fields')).toBeInTheDocument();
    expect(screen.queryByTestId('new-article-fields')).not.toBeInTheDocument();
  });

  it('switches between NewArticleFields and CorrectionFields via the type select', () => {
    render(<SubmissionForm {...baseProps} initialType="new_article" />);
    fireEvent.change(screen.getByLabelText(/Art/i), { target: { value: 'correction' } });
    expect(screen.getByTestId('correction-fields')).toBeInTheDocument();
  });

  it('renders submitter fields and submit button', () => {
    render(<SubmissionForm {...baseProps} />);
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/E-Mail/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /absenden/i })).toBeInTheDocument();
  });

  it('renders the Turnstile widget', () => {
    render(<SubmissionForm {...baseProps} />);
    expect(screen.getByRole('button', { name: /Turnstile mock/i })).toBeInTheDocument();
  });

  it('renders PII notice above form fields', () => {
    render(<SubmissionForm {...baseProps} />);
    expect(screen.getByText(/keine Namen, Initialen/i)).toBeInTheDocument();
  });
});
