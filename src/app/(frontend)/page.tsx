import { IntentCards } from '@/components/IntentCards'

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">
        PflegeCommons
      </h1>
      <p className="mb-10 text-center text-gray-600">
        Wissen für die professionelle Pflege. Frei. Geprüft. Praxisnah.
      </p>

      {/* Chrome's eingebauter Password-Manager / Autofill annotiert <form>-Elemente
          mit form_signature-Attributen vor der React-Hydration. Das ist kein
          Mismatch in unserem Markup, daher unterdrücken wir hier die Warnung. */}
      <form action="/suche" method="get" className="mb-10" suppressHydrationWarning>
        <label htmlFor="q" className="sr-only">
          Suche
        </label>
        <input
          type="search"
          id="q"
          name="q"
          placeholder={'🔍 Suche nach „Dekubitus“, „SIS“, „MD-Prüfung“…'}
          className="w-full rounded-lg border-2 border-blue-600 px-4 py-3 text-base"
          suppressHydrationWarning
        />
      </form>

      <IntentCards />

      <p className="mt-10 text-center text-sm text-gray-600">
        Oder stöbere in{' '}
        <a href="/index" className="font-medium text-blue-700 underline hover:text-blue-900">
          allen Artikeln von A bis Z
        </a>
        .
      </p>
    </div>
  )
}
