export const metadata = {
  title: 'Mitmachen bei PflegeAtlas',
  description:
    'Drei Wege, dich an PflegeAtlas zu beteiligen: Beitrag einreichen, regelmäßig schreiben, oder lesen.',
};

export default function MitmachenPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-12 p-8">
      <header>
        <h1 className="mb-2 font-serif text-4xl text-brand">
          Mitmachen bei PflegeAtlas
        </h1>
        <p className="text-lg text-ink-muted">
          Es gibt drei Wege, mitzumachen — wähle den, der zu dir passt.
        </p>
      </header>

      <section className="border-l-4 border-brand pl-6">
        <h2 className="mb-2 font-serif text-2xl">
          1. Beitrag oder Korrektur einreichen
        </h2>
        <p className="mb-4">
          Du hast Wissen, das fehlt? Oder du hast einen Fehler in einem Artikel
          entdeckt? Reiche es ohne Account ein — wir prüfen und übernehmen es.
        </p>
        <a
          href="/einreichen"
          className="inline-block rounded-md bg-brand px-4 py-2 font-semibold text-white"
        >
          Beitrag einreichen
        </a>
      </section>

      <section className="border-l-4 border-accent pl-6">
        <h2 className="mb-2 font-serif text-2xl">
          2. Regelmäßig beitragen oder namentlich genannt werden
        </h2>
        <p className="mb-4">
          Du willst öfter dabei sein, eigene Artikel schreiben oder als
          Autor:in/Reviewer:in genannt werden? Schreib uns kurz, was du
          beitragen möchtest — wir richten dir einen Account ein.
        </p>
        <a
          href="mailto:redaktion@pflegeatlas.org?subject=Ich%20m%C3%B6chte%20bei%20PflegeAtlas%20mitmachen"
          className="inline-block rounded-md border-2 border-accent px-4 py-2 font-semibold text-accent"
        >
          E-Mail an Redaktion
        </a>
      </section>

      <section className="border-l-4 border-rule pl-6">
        <h2 className="mb-2 font-serif text-2xl">
          3. Du arbeitest in der Pflege und willst lesen
        </h2>
        <p className="mb-4">
          Stöbere durch die Artikel — Lesen ist anonym und braucht keinen
          Account.
        </p>
        <a href="/artikel" className="text-brand underline">
          Zu den Artikeln
        </a>
      </section>
    </main>
  );
}
