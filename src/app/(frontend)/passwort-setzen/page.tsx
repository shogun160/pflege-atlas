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
  // Otherwise assume Payload-native reset token; Payload validates on POST.
  return { valid: true, mode: 'reset' };
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
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="mb-4 font-serif text-3xl">Ungültiger Link</h1>
        <p>Dieser Link ist ungültig oder bereits eingelöst.</p>
        <p className="mt-4">
          <a href="/mitmachen" className="text-brand underline">
            Neuen Link anfordern
          </a>
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
