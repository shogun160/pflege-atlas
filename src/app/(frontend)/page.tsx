import { IntentCards } from '@/components/IntentCards'

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-3 text-center font-serif text-4xl font-semibold text-ink">
        PflegeAtlas
      </h1>
      <p className="mb-10 text-center text-lg text-ink-muted">
        Wissen für die professionelle Pflege. Frei. Geprüft. Praxisnah.
      </p>

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

      <p className="mt-12 text-center text-sm text-ink-muted">
        Oder stöbere in{' '}
        <a href="/index" className="font-medium text-brand underline underline-offset-2 hover:no-underline">
          allen Artikeln von A bis Z
        </a>
        .
      </p>
    </div>
  )
}
