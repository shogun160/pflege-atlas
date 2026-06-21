import { getPayload } from 'payload';
import config from '@/payload.config';
import { requireUser, logoutAction } from '@/lib/auth';
import { ProfileEditForm } from '@/components/ProfileEditForm';
import { AccountActions } from '@/components/AccountActions';
import { MeineBeitraegeCard } from '@/components/MeineBeitraegeCard';

export const metadata = {
  title: 'Mein Bereich · PflegeAtlas',
  description: 'Profil, Beiträge und Konto verwalten.',
};

export default async function MeinBereichPage() {
  const session = await requireUser();
  const payload = await getPayload({ config });
  const submissionsFind =
    session.role === 'contributor'
      ? await payload.find({
          collection: 'submissions',
          where: { submittedBy: { equals: session.id } },
          sort: '-createdAt',
          limit: 50,
          depth: 1,
        })
      : null;
  const userDoc = await payload.findByID({
    collection: 'users',
    id: session.id,
    depth: 1,
  });

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-brand">Mein Bereich</h1>
          <p className="text-stone-600">
            {session.displayName} · {session.email}
          </p>
        </div>
        <form
          action={async () => {
            'use server';
            await logoutAction();
          }}
        >
          <button
            type="submit"
            className="rounded border border-rule px-3 py-1"
          >
            Logout
          </button>
        </form>
      </header>

      {session.role === 'contributor' && submissionsFind && (
        <MeineBeitraegeCard submissions={submissionsFind.docs as never} />
      )}

      <section className="rounded-lg border border-rule bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-serif text-xl">Profil</h2>
        <ProfileEditForm user={userDoc as never} />
      </section>

      {session.role === 'contributor' && (
        <section className="rounded-lg border border-rule bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-serif text-xl">Neuer Beitrag</h2>
          <p className="mb-3">
            Hast du Wissen, das fehlt? Oder eine Korrektur?
          </p>
          <a
            href="/einreichen"
            className="inline-block rounded bg-brand px-4 py-2 font-semibold text-white"
          >
            Zum Einreichen-Formular
          </a>
        </section>
      )}

      {(session.role === 'admin' ||
        session.role === 'editor' ||
        session.role === 'reviewer') && (
        <section className="rounded-lg border border-rule bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-serif text-xl">Zur Redaktion</h2>
          <a
            href="/admin"
            className="inline-block rounded bg-brand px-4 py-2 font-semibold text-white"
          >
            Admin-Dashboard öffnen
          </a>
        </section>
      )}

      <section className="rounded-lg border border-rule bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-serif text-xl">Konto</h2>
        <AccountActions isAdmin={session.role === 'admin'} />
      </section>
    </main>
  );
}
