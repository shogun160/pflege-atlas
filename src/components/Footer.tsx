import { Wordmark } from './Wordmark';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-rule bg-surface py-10">
      <div className="mx-auto max-w-6xl px-4">
        <Wordmark size="sm" />
        <p className="mt-4 text-sm text-ink">
          <strong className="text-ink">Hinweis:</strong>{' '}
          Inhalte ersetzen keine ärztliche oder pflegerische Beurteilung im Einzelfall. Im Zweifel
          immer Fachkraft, Arzt oder Notruf konsultieren.
        </p>
        <p className="mt-4 text-sm text-ink-muted">
          Inhalte unter{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
            className="text-brand underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-SA 4.0
          </a>
          . Quellcode der Plattform ist Open Source.
        </p>
        <nav className="mt-6 flex flex-wrap gap-4 text-sm text-ink-muted">
          <a href="/impressum" className="hover:text-brand">
            Impressum
          </a>
          <a href="/datenschutz" className="hover:text-brand">
            Datenschutz
          </a>
          <a href="/einreichen" className="hover:text-brand">
            Beitragen
          </a>
          <a
            href="https://github.com/shogun160/pflege-atlas"
            className="hover:text-brand"
            target="_blank"
            rel="noreferrer noopener"
          >
            Open Source auf GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
