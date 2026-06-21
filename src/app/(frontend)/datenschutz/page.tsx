import type { Metadata } from 'next';
import { DatenschutzSections } from '@/components/DatenschutzSections';

export const metadata: Metadata = {
  title: 'Datenschutz — PflegeAtlas',
  description: 'Datenschutzerklärung gemäß DSGVO.',
};

export default function Datenschutz() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 prose prose-pflege">
      <h1>Datenschutzerklärung</h1>

      <p>
        Diese Datenschutzerklärung erläutert, welche personenbezogenen Daten
        wir verarbeiten, wenn Sie PflegeAtlas nutzen, und welche Rechte Sie
        in Bezug auf diese Daten haben. Stand: {new Date().toLocaleDateString('de-DE')}.
      </p>

      {/* IMPLEMENTER: Hier den Generator-Output aus /tmp/datenschutz-generator-output.html
          als JSX-konformes Markup einsetzen. Generator-Standard-Sections:
          - Einleitung und Verantwortlichkeit
          - Rechtsgrundlagen
          - Sicherheitsmaßnahmen
          - Übermittlung von personenbezogenen Daten
          - Internationale Datentransfers
          - Cookies / Browserspeicher (falls aktiv — hier: nur technisch notwendig)
          - Bereitstellung des Online-Angebots und Webhosting (Vercel)
          - Kontaktanfragen (Resend)
          - Generator setzt die Boilerplate, Custom-Sections unten ergänzen die Eigenheiten.
      */}

      <DatenschutzSections />
    </article>
  );
}
