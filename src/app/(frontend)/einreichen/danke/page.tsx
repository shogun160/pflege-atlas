import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionLabel } from '@/components/SectionLabel';

export const metadata: Metadata = {
  title: 'Danke – PflegeAtlas',
  description: 'Deine Submission ist bei uns angekommen.',
};

export default function DankePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <SectionLabel className="mb-3">Mitmachen</SectionLabel>
      <h1 className="mb-6 font-serif text-4xl font-semibold leading-tight text-ink">
        Danke!
      </h1>
      <p className="mb-6 text-lg text-ink-muted">
        Deine Submission ist bei uns angekommen. Die Redaktion prüft sie in den
        nächsten Tagen und meldet sich bei Rückfragen — falls du eine
        Mail-Adresse hinterlassen hast.
      </p>

      <aside
        role="note"
        className="mb-10 border-l-[3px] border-brand bg-surface px-4 py-3 text-sm text-ink-muted"
      >
        <strong className="text-ink">Lizenz:</strong>{' '}
        Mit dem Einreichen hast du dein Material unter{' '}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
          className="text-brand underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >
          CC BY-SA 4.0
        </a>{' '}
        freigegeben. Danke fürs Mitmachen!
      </aside>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          href="/einreichen"
          className="rounded-md border border-rule px-4 py-2 hover:bg-surface"
        >
          Weiteres einreichen
        </Link>
        <Link
          href="/"
          className="rounded-md bg-brand px-4 py-2 font-semibold text-white"
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
