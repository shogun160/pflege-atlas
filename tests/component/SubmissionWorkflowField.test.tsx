import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubmissionWorkflowField } from '@/components/admin/SubmissionWorkflowField';

// Mock @payloadcms/ui hooks
const mockUseDocumentInfo = vi.fn();
const mockUseFormFields = vi.fn();

vi.mock('@payloadcms/ui', () => ({
  useDocumentInfo: () => mockUseDocumentInfo(),
  useFormFields: (selector: (ctx: any) => any) => mockUseFormFields(selector),
}));

// Mock the inner component so tests are isolated
vi.mock('@/components/admin/SubmissionWorkflowButtons', () => ({
  SubmissionWorkflowButtons: ({
    submissionId,
    reviewStatus,
  }: {
    submissionId: number;
    reviewStatus: string;
  }) => (
    <div data-testid="workflow-buttons">
      <span data-testid="id">{submissionId}</span>
      <span data-testid="status">{reviewStatus}</span>
    </div>
  ),
}));

describe('SubmissionWorkflowField', () => {
  it('happy path: passes id and reviewStatus to SubmissionWorkflowButtons', () => {
    mockUseDocumentInfo.mockReturnValue({ id: 42 });
    // useFormFields receives a selector; invoke it with a fake FormState
    mockUseFormFields.mockImplementation((selector: any) =>
      selector([{ reviewStatus: { value: 'pending' } }, () => {}]),
    );

    render(<SubmissionWorkflowField />);

    expect(screen.getByTestId('id').textContent).toBe('42');
    expect(screen.getByTestId('status').textContent).toBe('pending');
  });

  it('renders nothing when id is missing (new document not yet saved)', () => {
    mockUseDocumentInfo.mockReturnValue({ id: undefined });
    mockUseFormFields.mockImplementation((selector: any) =>
      selector([{ reviewStatus: { value: 'pending' } }, () => {}]),
    );

    const { container } = render(<SubmissionWorkflowField />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when reviewStatus is missing from form state', () => {
    mockUseDocumentInfo.mockReturnValue({ id: 7 });
    mockUseFormFields.mockImplementation((selector: any) =>
      selector([{}, () => {}]),
    );

    const { container } = render(<SubmissionWorkflowField />);
    expect(container.firstChild).toBeNull();
  });
});
