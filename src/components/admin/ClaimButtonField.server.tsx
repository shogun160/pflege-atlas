import { getSession } from '@/lib/auth';
import { ClaimButton } from './ClaimButton';

/**
 * Server-side glue between Payload's admin UI-field props and the
 * client-side ClaimButton.
 *
 * Reads the session (server-only) and adapts the `currentReviewer` shape
 * (number | { id, displayName } | null) into the flat props the client
 * component expects.
 *
 * Payload passes `data` (the document) and `collectionSlug` (e.g. "articles"
 * or "submissions") to all server UI fields.
 */
export async function ClaimButtonField({
  data,
  collectionSlug,
}: {
  data?: {
    id?: number;
    currentReviewer?: number | { id: number; displayName?: string } | null;
  };
  collectionSlug?: string;
}) {
  const session = await getSession();
  if (!session || !data?.id) return null;

  const reviewerRaw = data.currentReviewer ?? null;
  const reviewerId =
    typeof reviewerRaw === 'object' && reviewerRaw ? reviewerRaw.id : reviewerRaw;
  const reviewerName =
    typeof reviewerRaw === 'object' && reviewerRaw
      ? reviewerRaw.displayName ?? null
      : null;
  const type: 'article' | 'submission' =
    collectionSlug === 'articles' ? 'article' : 'submission';

  return (
    <ClaimButton
      id={data.id}
      type={type}
      currentReviewerId={reviewerId}
      currentReviewerName={reviewerName}
      sessionUserId={session.id}
    />
  );
}
