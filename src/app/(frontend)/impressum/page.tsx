import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum — PflegeAtlas',
  description: 'Pflichtangaben nach § 5 DDG und § 18 MStV.',
};

export default function Impressum() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose prose-pflege">
      <h1>Impressum</h1>

      <h2>Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)</h2>
      <p>
        PflegeAtlas wird gemeinsam betrieben von:
      </p>
      <p>
        <strong>Oliver Wosnitza</strong>
        <br />
        Friesenstraße 15
        <br />
        81825 München
      </p>
      <p>
        <strong>Christoph Brück</strong>
        <br />
        Postweg 365
        <br />
        31613 Wietzen
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail (allgemein):{' '}
        <a href="mailto:redaktion@pflegeatlas.org">redaktion@pflegeatlas.org</a>
        <br />
        E-Mail (Datenschutz):{' '}
        <a href="mailto:datenschutz@pflegeatlas.org">datenschutz@pflegeatlas.org</a>
      </p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>
        Oliver Wosnitza
        <br />
        Friesenstraße 15
        <br />
        81825 München
      </p>

      <h2>EU-Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung
        (OS) bereit:{' '}
        <a
          href="https://ec.europa.eu/consumers/odr/"
          target="_blank"
          rel="noreferrer noopener"
        >
          https://ec.europa.eu/consumers/odr/
        </a>
        . Unsere E-Mail-Adresse finden Sie oben.
      </p>

      <h2>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
        vor einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <h2>Haftungsausschluss</h2>
      <p>
        Die Inhalte dieser Plattform ersetzen keine ärztliche oder pflegerische
        Beurteilung im Einzelfall. Im Zweifel ist immer eine Fachkraft, ein
        Arzt oder der Notruf zu konsultieren. Eine Haftung für Schäden, die
        aus der Anwendung der hier dargestellten Informationen entstehen, ist
        ausgeschlossen.
      </p>
    </article>
  );
}
