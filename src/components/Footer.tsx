export function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-gray-50 py-10">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-sm text-gray-700">
          <strong>Hinweis:</strong>{' '}
          Inhalte ersetzt keine ärztliche oder pflegerische Beurteilung im Einzelfall. Im Zweifel
          immer Fachkraft, Arzt oder Notruf konsultieren.
        </p>
        <p className="mt-4 text-sm text-gray-600">
          Inhalte unter{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
            className="underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-SA 4.0
          </a>
          . Quellcode der Plattform ist Open Source.
        </p>
        <nav className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600">
          <a href="/impressum" className="hover:text-gray-900">
            Impressum
          </a>
          <a href="/datenschutz" className="hover:text-gray-900">
            Datenschutz
          </a>
          <a
            href="https://github.com/"
            className="hover:text-gray-900"
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
