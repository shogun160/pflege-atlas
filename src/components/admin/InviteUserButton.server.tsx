import { getSession } from '@/lib/auth';
import { InviteUserButton } from './InviteUserButton';

/**
 * Server-side glue for Payload's Users-list `beforeList` slot.
 *
 * Reads the session (server-only) and hands the role down to the client
 * component, which renders nothing for reviewer/contributor (they cannot
 * invite anyone).
 */
export async function InviteUserButtonServer() {
  const session = await getSession();
  if (!session) return null;
  return <InviteUserButton sessionRole={session.role} />;
}
