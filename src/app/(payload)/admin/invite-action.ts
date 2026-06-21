'use server';

import 'server-only';
import { inviteUserAction } from '@/lib/auth';
import type { Role } from '@/lib/auth-permissions';
import { revalidatePath } from 'next/cache';

/**
 * Map known internal errors to friendly UI strings. Payload's ValidationError
 * surfaces developer-strings (often English) that we do NOT want to leak to
 * end-users in the admin UI. Errors that already start with a German prefix
 * from `inviteUserAction` (Keine Berechtigung, Ungültige Rolle, …) pass
 * through unchanged.
 */
function friendlyInviteError(raw: string | undefined): string {
  if (!raw) return 'Einladung fehlgeschlagen.';
  if (/email/i.test(raw) && /(invalid|duplicate|unique|exists|bereits)/i.test(raw)) {
    return 'Diese E-Mail ist bereits vergeben.';
  }
  if (/^(Keine Berechtigung|Ungültige|Einladung)/.test(raw)) return raw;
  return 'Einladung fehlgeschlagen.';
}

export async function inviteUserFromAdminAction(
  email: string,
  role: Role,
  displayName: string,
): Promise<{ ok: boolean; userId?: number; error?: string }> {
  const result = await inviteUserAction(email, role, displayName);
  if (result.ok) {
    revalidatePath('/admin/collections/users');
    return result;
  }
  return { ...result, error: friendlyInviteError(result.error) };
}
