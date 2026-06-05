import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubmissionForm } from '@/components/SubmissionForm';

// Mock the Turnstile widget — it requires browser-only setup
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: () => <div data-testid="turnstile-mock" />,
}));

// Mock server action — pulls in server-only/payload which can't run in jsdom
vi.mock('@/app/(frontend)/einreichen/actions', () => ({
  submitAction: vi.fn(async () => ({})),
}));

describe('SubmissionForm', () => {
  const articles = [
    { slug: 'dekubitus', title: 'Dekubitusprophylaxe' },
    { slug: 'lagerung', title: 'Lagerung' },
  ];

  it('renders all required fields', () => {
    render(
      <SubmissionForm
        articles={articles}
        turnstileSiteKey="test-key"
      />,
    );
    expect(screen.getByLabelText(/Art/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Betreff/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Inhalt/i)).toBeInTheDocument();
    expect(screen.getByTestId('turnstile-mock')).toBeInTheDocument();
  });

  it('pre-fills type from props', () => {
    render(
      <SubmissionForm
        articles={articles}
        turnstileSiteKey="test-key"
        initialType="correction"
      />,
    );
    const select = screen.getByLabelText(/Art/i) as HTMLSelectElement;
    expect(select.value).toBe('correction');
  });

  it('pre-fills relatedArticleSlug from props when correction', () => {
    render(
      <SubmissionForm
        articles={articles}
        turnstileSiteKey="test-key"
        initialType="correction"
        initialArticleSlug="dekubitus"
      />,
    );
    const select = screen.getByLabelText(/Bezogen auf/i) as HTMLSelectElement;
    expect(select.value).toBe('dekubitus');
  });

  it('renders noscript fallback with mailto link', () => {
    const { container } = render(
      <SubmissionForm articles={articles} turnstileSiteKey="test-key" />,
    );
    const noscript = container.querySelector('noscript');
    expect(noscript?.innerHTML).toMatch(/mitmachen@pflegeatlas\.org/);
  });
});
