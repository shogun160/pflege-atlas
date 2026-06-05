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

      <form action="/suche" method="get" className="mb-10">
        <label htmlFor="q" className="sr-only">
          Suche
        </label>
        <input
          type="search"
          id="q"
          name="q"
          placeholder={'🔍 Suche nach „Dekubitus“, „SIS“, „MD-Prüfung“…'}
          className="w-full rounded-lg border-2 border-blue-600 px-4 py-3 text-base"
        />
      </form>

      <IntentCards />
    </div>
  )
}
