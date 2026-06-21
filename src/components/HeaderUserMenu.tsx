import { logoutAction } from '@/lib/auth';
import type { Session } from '@/lib/auth';

export function HeaderUserMenu({ session }: { session: Session | null }) {
  if (!session) {
    return (
      <a href="/login" className="text-sm text-brand underline">
        Anmelden
      </a>
    );
  }
  const initial = (session.displayName || session.email || '?')
    .charAt(0)
    .toUpperCase();
  const showAdminLink =
    session.role === 'admin' ||
    session.role === 'editor' ||
    session.role === 'reviewer';
  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white"
      >
        {initial}
      </div>
      <span className="text-sm">{session.displayName || session.email}</span>
      <nav className="flex items-center gap-3 text-sm">
        <a href="/mein-bereich" className="underline">
          Mein Bereich
        </a>
        {showAdminLink && (
          <a href="/admin" className="underline">
            Admin
          </a>
        )}
        <form
          action={async () => {
            'use server';
            await logoutAction();
          }}
        >
          <button type="submit" className="underline">
            Logout
          </button>
        </form>
      </nav>
    </div>
  );
}
