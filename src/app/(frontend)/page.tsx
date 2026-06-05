import { IntentCards } from '@/components/IntentCards'

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 -mt-12 pb-24">
      <h1 className="mb-10 text-center text-lg text-ink-muted">
        Wissen für die professionelle Pflege. Frei. Geprüft. Praxisnah.
      </h1>

      {/* Chrome's eingebauter Password-Manager / Autofill annotiert <form>-Elemente
          mit form_signature-Attributen vor der React-Hydration. Das ist kein
          Mismatch in unserem Markup, daher unterdrücken wir hier die Warnung. */}
      <form action="/suche" method="get" className="mb-12" suppressHydrationWarning>
        <label htmlFor="q" className="sr-only">
          Suche
        </label>
        <input
          type="search"
          id="q"
          name="q"
          placeholder={'🔍 Suche nach „Dekubitus“, „SIS“, „MD-Prüfung“…'}
          className="w-full rounded-lg border border-brand bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30"
          suppressHydrationWarning
        />
      </form>

      <IntentCards />

      <section aria-label="Lesen & Mitmachen" className="mt-12 grid gap-3 sm:grid-cols-2">
        <a
          href="/index"
          className="block rounded-lg border border-rule bg-surface p-4 transition-colors hover:bg-rule/30"
        >
          <div className="text-base font-medium text-ink">Stöbern</div>
          <div className="mt-1 text-sm text-ink-muted">Alle Artikel von A bis Z durchsuchen</div>
        </a>
        <a
          href="/einreichen"
          className="block rounded-lg border border-rule bg-surface p-4 transition-colors hover:bg-rule/30"
        >
          <div className="text-base font-medium text-ink">Mitmachen</div>
          <div className="mt-1 text-sm text-ink-muted">Neuen Artikel oder Korrektur einreichen</div>
        </a>
      </section>
    </div>
  )
}
