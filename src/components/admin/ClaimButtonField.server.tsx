import { getPayload } from 'payload';
import config from '@/payload.config';
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
    status?: string;
    reviewStatus?: string;
  };
  collectionSlug?: string;
}) {
  const session = await getSession();
  if (!session || !data?.id) return null;

  // Status-gate: only show the claim button when the document is in an
  // editorial-pipeline status. Otherwise clicking would silently transition
  // e.g. `draft` -> `in_review` (Articles) without explicit intent.
  // Articles use `status`; Submissions use `reviewStatus`.
  const status = collectionSlug === 'articles' ? data.status : data.reviewStatus;
  const claimable =
    status === 'pending' ||
    status === 'in_review' ||
    status === 'ready_to_publish';
  if (!claimable) return null;

  const reviewerRaw = data.currentReviewer ?? null;
  const reviewerId =
    typeof reviewerRaw === 'object' && reviewerRaw
      ? reviewerRaw.id
      : (reviewerRaw as number | null);
  // Payload may pass the relationship as either a populated object OR a raw ID
  // depending on `depth` in the surrounding admin-view request. When we get
  // just an ID, lookup the user so the ClaimButton can display the real name
  // instead of falling back to "unbekannt".
  let reviewerName: string | null = null;
  if (typeof reviewerRaw === 'object' && reviewerRaw) {
    reviewerName = reviewerRaw.displayName ?? null;
  } else if (typeof reviewerRaw === 'number') {
    try {
      const payload = await getPayload({ config });
      const user = await payload.findByID({
        collection: 'users',
        id: reviewerRaw,
        depth: 0,
      });
      reviewerName = (user as { displayName?: string }).displayName ?? null;
    } catch {
      reviewerName = null;
    }
  }
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
