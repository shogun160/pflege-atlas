'use client';

import { useFormFields, useDocumentInfo } from '@payloadcms/ui';
import { SubmissionWorkflowButtons } from './SubmissionWorkflowButtons';

/**
 * Payload 3.x custom UI-field wrapper.
 *
 * Reads `reviewStatus` from the Payload form context (so it always reflects
 * the current saved value) and the document `id` from the DocumentInfo
 * context, then delegates rendering to the inner SubmissionWorkflowButtons
 * component.
 */
export function SubmissionWorkflowField() {
  const { id } = useDocumentInfo();

  const reviewStatus = useFormFields(([fields]) => {
    const field = fields['reviewStatus'];
    return field?.value as string | undefined;
  });

  if (!id || !reviewStatus) {
    return null;
  }

  return (
    <SubmissionWorkflowButtons
      submissionId={id as number}
      reviewStatus={reviewStatus}
    />
  );
}
