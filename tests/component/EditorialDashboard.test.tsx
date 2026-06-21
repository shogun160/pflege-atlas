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
  it('renders all four stats cards with values', () => {
    render(<EditorialDashboard {...(props as never)} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
  it('renders recent items with links', () => {
    render(<EditorialDashboard {...(props as never)} />);
    expect(screen.getByText('Sub A')).toBeInTheDocument();
    expect(screen.getByText('Art X')).toBeInTheDocument();
  });
});
