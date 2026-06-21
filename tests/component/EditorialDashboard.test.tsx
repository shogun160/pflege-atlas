import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorialDashboard } from '@/components/admin/EditorialDashboard';

describe('EditorialDashboard', () => {
  const props = {
    stats: { pending: 3, inReview: 1, readyToPublish: 2, myStack: 0 },
    recentSubmissions: [
      { id: 1, displayTitle: 'Sub A', reviewStatus: 'pending', createdAt: '2026-06-22T10:00:00Z' },
    ],
    recentArticles: [
      { id: 10, title: 'Art X', status: 'in_review', updatedAt: '2026-06-22T11:00:00Z' },
    ],
  };
  it('renders all four stats cards with values and correct drill-down links', () => {
    render(<EditorialDashboard {...(props as never)} />);
    expect(screen.getByRole('link', { name: /Eingegangen/ })).toHaveAttribute(
      'href',
      expect.stringContaining('reviewStatus][equals]=pending'),
    );
    expect(screen.getByRole('link', { name: /In Review/ })).toHaveAttribute(
      'href',
      expect.stringContaining('reviewStatus][equals]=in_review'),
    );
    expect(screen.getByRole('link', { name: /Bereit zur Veröffentlichung/ })).toHaveAttribute(
      'href',
      expect.stringContaining('status][equals]=ready_to_publish'),
    );
    expect(screen.getByRole('link', { name: /Mein offener Stack/ })).toHaveAttribute(
      'href',
      expect.stringContaining('status][in]=in_review,ready_to_publish'),
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
  it('renders recent items with links pointing at the correct collection detail URLs', () => {
    render(<EditorialDashboard {...(props as never)} />);
    expect(screen.getByRole('link', { name: 'Sub A' })).toHaveAttribute(
      'href',
      '/admin/collections/submissions/1',
    );
    expect(screen.getByRole('link', { name: 'Art X' })).toHaveAttribute(
      'href',
      '/admin/collections/articles/10',
    );
  });
  it('shows "Ohne Titel" fallback when an article has no title', () => {
    const propsWithUntitledArticle = {
      ...props,
      recentArticles: [
        { id: 42, status: 'in_review', updatedAt: '2026-06-22T11:00:00Z' },
      ],
    };
    render(<EditorialDashboard {...(propsWithUntitledArticle as never)} />);
    expect(screen.getByRole('link', { name: 'Ohne Titel' })).toHaveAttribute(
      'href',
      '/admin/collections/articles/42',
    );
  });
});
