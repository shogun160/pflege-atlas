import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'PflegeAtlas — im Aufbau',
  description:
    'PflegeAtlas wird eine offene Wissensplattform für die professionelle Pflege. Frei, geprüft, praxisnah. Der Aufbau läuft — mach mit.',
}

export default function ConstructionPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <Image
        src="/construction.webp"
        alt="Symbolische Baustellen-Illustration mit Kränen, Mitmachen-Schildern und München-Skyline: PflegeAtlas im Aufbau"
        width={1376}
        height={768}
        priority
        unoptimized
        className="mb-10 w-full rounded-lg"
      />

      <h1 className="mb-6 text-3xl font-semibold text-ink">Willkommen auf PflegeAtlas</h1>

      <div className="prose prose-pflege">
        <p>
          PflegeAtlas wird eine offene Wissensplattform für die professionelle Pflege —{' '}
          <strong>frei, geprüft, praxisnah</strong>. Alle Inhalte unter CC BY-SA 4.0, der Quellcode
          ist Open Source.
        </p>

        <p>
          Wir starten gerade. Erste Artikel entstehen, die Plattform wächst Stück für Stück
          gemeinsam mit Pflegefachkräften, Trägern und Ausbildungseinrichtungen.
        </p>

        <p>
          <strong>Du kannst mithelfen</strong> — einen Beitrag einreichen, einen
          Wissens-Lücken-Hinweis senden oder eine Korrektur vorschlagen. Auch ohne Account.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/einreichen"
          className="inline-block rounded-lg bg-brand px-6 py-3 text-base font-medium text-white transition-colors hover:bg-brand/90"
        >
          Beitrag einreichen →
        </Link>
      </div>

      <p className="mt-8 text-sm text-ink-muted">
        Bei Fragen:{' '}
        <a href="mailto:redaktion@pflegeatlas.org" className="text-brand hover:underline">
          redaktion@pflegeatlas.org
        </a>
      </p>
    </article>
  )
}
