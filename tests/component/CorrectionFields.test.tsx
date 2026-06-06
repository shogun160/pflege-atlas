import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/SectionCheckbox', () => ({
  SectionCheckbox: ({
    sectionKey,
    label,
    checked,
  }: {
    sectionKey: string;
    label: string;
    checked: boolean;
  }) => (
    <div data-testid={`section-${sectionKey}`}>
      <label>
        <input
          type="checkbox"
          name="selectedSections"
          value={sectionKey}
          checked={checked}
          onChange={() => {}}
        />
        {label}
      </label>
    </div>
  ),
}));

import { CorrectionFields } from '@/components/CorrectionFields';

const defaultProps = {
  articles: [
    { slug: 'dekubitus', title: 'Dekubitus' },
    { slug: 'sturz', title: 'Sturzprophylaxe' },
  ],
  articleSections: {
    definition: '',
    praxis: '',
    risiken: '',
    quellen: '',
  },
  values: {
    relatedArticleSlug: '',
    correctionReason: '',
    selectedSections: [] as string[],
    editedDefinition: '',
    editedPraxis: '',
    editedRisiken: '',
    editedQuellen: '',
  },
  setters: {
    setRelatedArticleSlug: vi.fn(),
    setCorrectionReason: vi.fn(),
    setSelectedSections: vi.fn(),
    setEditedDefinition: vi.fn(),
    setEditedPraxis: vi.fn(),
    setEditedRisiken: vi.fn(),
    setEditedQuellen: vi.fn(),
  },
  fieldErrors: undefined,
};

describe('CorrectionFields', () => {
  it('renders article dropdown with options', () => {
    render(<CorrectionFields {...defaultProps} />);
    const select = screen.getByLabelText(/Bezogen auf/i) as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThanOrEqual(3); // placeholder + 2 articles
  });

  it('renders correctionReason textarea', () => {
    render(<CorrectionFields {...defaultProps} />);
    expect(screen.getByLabelText(/Begründung/i)).toBeInTheDocument();
  });

  it('renders 4 section checkboxes when an article is selected', () => {
    render(
      <CorrectionFields
        {...defaultProps}
        values={{ ...defaultProps.values, relatedArticleSlug: 'dekubitus' }}
      />,
    );
    expect(screen.getByTestId('section-definition')).toBeInTheDocument();
    expect(screen.getByTestId('section-praxis')).toBeInTheDocument();
    expect(screen.getByTestId('section-risiken')).toBeInTheDocument();
    expect(screen.getByTestId('section-quellen')).toBeInTheDocument();
  });

  it('does not render section checkboxes when no article is selected', () => {
    render(<CorrectionFields {...defaultProps} />);
    expect(screen.queryByTestId('section-praxis')).not.toBeInTheDocument();
  });

  it('calls router.push when article selection changes', () => {
    render(<CorrectionFields {...defaultProps} />);
    const select = screen.getByLabelText(/Bezogen auf/i);
    fireEvent.change(select, { target: { value: 'sturz' } });
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('article=sturz'));
  });
});
