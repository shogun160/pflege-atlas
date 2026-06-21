'use server';

import 'server-only';
import { requireUser } from '@/lib/auth';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { revalidatePath } from 'next/cache';

export async function claimSubmissionAction(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireUser();
    const payload = await getPayload({ config });
    // Note: no overrideAccess+user here — submissions have no per-status
    // permission gate; requireUser() above already gates access. Article-side
    // claim sets these to invoke the beforeChange transitionToReview check.
    await payload.update({
      collection: 'submissions',
      id,
      data: {
        currentReviewer: session.id,
        reviewStatus: 'in_review',
      } as never,
    });
    revalidatePath(`/admin/collections/submissions/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Claim failed.' };
  }
}

export async function claimArticleAction(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireUser();
    const payload = await getPayload({ config });
    await payload.update({
      collection: 'articles',
      id,
      data: {
        currentReviewer: session.id,
        status: 'in_review',
      } as never,
      overrideAccess: false,
      user: { id: session.id, role: session.role } as never,
    });
    revalidatePath(`/admin/collections/articles/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Claim failed.' };
  }
}
