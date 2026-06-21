'use server';

import 'server-only';
import { inviteUserAction } from '@/lib/auth';
import type { Role } from '@/lib/auth-permissions';
import { revalidatePath } from 'next/cache';

export async function inviteUserFromAdminAction(
  email: string,
  role: Role,
  displayName: string,
): Promise<{ ok: boolean; userId?: number; error?: string }> {
  const result = await inviteUserAction(email, role, displayName);
  if (result.ok) revalidatePath('/admin/collections/users');
  return result;
}
