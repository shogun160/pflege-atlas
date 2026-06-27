import type { Payload } from 'payload';

export interface HardDeleteAvatarResult {
  deleted: boolean;
  error?: string;
}

export type HardDeleteAvatarTrigger =
  | 'account-delete'
  | 'profile-update'
  | 'orphan-cleanup';

export interface HardDeleteAvatarContext {
  userId: number | null;
  trigger: HardDeleteAvatarTrigger;
}

function isNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name.toLowerCase();
  const msg = err.message.toLowerCase();
  return name.includes('notfound') || msg.includes('not found');
}

export async function hardDeleteAvatar(
  payload: Payload,
  oldMediaId: number | null | undefined,
  context: HardDeleteAvatarContext,
): Promise<HardDeleteAvatarResult> {
  if (oldMediaId === null || oldMediaId === undefined) {
    return { deleted: false };
  }
  try {
    await payload.delete({ collection: 'media', id: oldMediaId });
    return { deleted: true };
  } catch (err) {
    if (isNotFoundError(err)) {
      // Race / already gone — idempotent success, no warn.
      return { deleted: false };
    }
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[avatar-cleanup] failed to delete media=${oldMediaId} for userId=${context.userId} (trigger=${context.trigger}): ${message}`,
    );
    return { deleted: false, error: message };
  }
}
