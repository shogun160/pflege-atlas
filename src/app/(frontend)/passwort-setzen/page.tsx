import { getPayload } from 'payload';
import config from '@/payload.config';
import { SetPasswordForm } from '@/components/SetPasswordForm';
import { isTokenValid } from '@/lib/auth-tokens';

type LookupResult = { valid: boolean; mode: 'invitation' | 'reset' } | null;

async function lookupToken(token: string): Promise<LookupResult> {
  if (!token) return null;
  const payload = await getPayload({ config });
  // Try our V1.6 invitation token first
  const found = await payload.find({
    collection: 'users',
    where: { setPasswordToken: { equals: token } },
    depth: 0,
    limit: 1,
  });
  if (found.docs.length > 0) {
    const expiresAt = (found.docs[0] as { setPasswordTokenExpiresAt?: string | null })
      .setPasswordTokenExpiresAt;
    return { valid: isTokenValid(expiresAt), mode: 'invitation' };
  }
  // Try Payload-native reset token. If present, hand off to the SetPasswordForm
  // which posts to setPasswordFromTokenAction → Payload validates expiry/usage.
  const reset = await payload.find({
    collection: 'users',
    where: { resetPasswordToken: { equals: token } },
    depth: 0,
    limit: 1,
  });
  if (reset.docs.length > 0) {
    return { valid: true, mode: 'reset' };
  }
  // Neither token matches → already used or never existed.
  return null;
}

export default async function PasswortSetzenPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? '';
  const lookup = await lookupToken(token);

  if (!token || !lookup) {
    // Clean, friendly error-state (e.g. when a magic link was already used).
    // Wraps the same outer container the success path uses.
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="mb-4 font-serif text-3xl">Link nicht mehr gültig</h1>
        <p>
          Dieser Link ist nicht mehr gültig. Falls du dein Passwort vergessen
          hast, fordere{' '}
          <a href="/passwort-vergessen" className="text-brand underline">
            hier einen neuen Reset
          </a>{' '}
          an. Falls du eine Einladung verwenden wolltest, wende dich an die
          Person, die dich eingeladen hat.
        </p>
      </main>
    );
  }
  if (!lookup.valid) {
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="mb-4 font-serif text-3xl">Link abgelaufen</h1>
        <p>Dieser Einladungs-Link ist abgelaufen.</p>
        <p className="mt-4">
          <a href="/mitmachen" className="text-brand underline">
            Neuen Link anfordern
          </a>
        </p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-4 font-serif text-3xl">
        {lookup.mode === 'invitation'
          ? 'Willkommen! Setze dein Passwort.'
          : 'Neues Passwort wählen'}
      </h1>
      <SetPasswordForm token={token} mode={lookup.mode} />
    </main>
  );
}
