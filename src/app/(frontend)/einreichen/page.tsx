import type { Metadata } from 'next';
import { SectionLabel } from '@/components/SectionLabel';

export const metadata: Metadata = {
  title: 'Mitmachen – PflegeAtlas',
  description: 'Reiche einen neuen Artikel oder eine Korrektur ein.',
};

export default function EinreichenPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <SectionLabel className="mb-3">Mitmachen</SectionLabel>
      <h1 className="mb-6 font-serif text-3xl font-semibold leading-tight text-ink">
        Teile dein Pflege-Wissen
      </h1>
      <p className="mb-10 text-lg text-ink-muted">
        PflegeAtlas lebt vom Wissen der Community. Du kannst auf zwei Wegen beitragen:
      </p>

      <section className="mb-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-rule bg-surface p-5">
          <SectionLabel>Neuer Artikel</SectionLabel>
          <h2 className="mt-2 font-serif text-xl font-semibold text-ink">
            Etwas Neues schreiben
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Du hast Wissen oder eine Praxis-Anleitung, die hier noch fehlt? Reiche einen kompletten Artikel-Vorschlag ein.
          </p>
        </div>
        <div className="rounded-lg border border-rule bg-surface p-5">
          <SectionLabel>Korrektur</SectionLabel>
          <h2 className="mt-2 font-serif text-xl font-semibold text-ink">
            Bestehendes verbessern
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Du hast einen Fehler entdeckt oder kannst einen Artikel ergänzen? Korrekturen sind besonders willkommen.
          </p>
        </div>
      </section>

      <aside
        role="note"
        className="mb-10 border-l-[3px] border-brand bg-surface px-4 py-3 text-sm text-ink-muted"
      >
        <strong className="text-ink">Vor dem offiziellen Start:</strong>{' '}
        Das Einreichungs-Formular kommt in Kürze. Bis dahin freuen wir uns über deine Mail an{' '}
        <a
          href="mailto:mitmachen@pflegeatlas.org"
          className="text-brand underline underline-offset-2 hover:no-underline"
        >
          mitmachen@pflegeatlas.org
        </a>
        .
      </aside>

      <p className="text-sm text-ink-muted">
        Alle Inhalte stehen unter{' '}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
          className="text-brand underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >
          CC BY-SA 4.0
        </a>
        . Mit dem Einreichen erklärst du dich mit dieser Lizenz einverstanden.
      </p>
    </div>
  );
}
