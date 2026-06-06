import 'dotenv/config';

/**
 * Einmal-Versand: V1.4-Update an Christoph.
 *
 * Voraussetzungen:
 * - RESEND_API_KEY aus 1Password (`pflegeatlas-prod`) in der ENV
 * - RESEND_FROM_ADDRESS auf eine verifizierte Resend-Domain (z.B. redaktion@pflegeatlas.org)
 *
 * Run: pnpm tsx scripts/send-handoff-to-christoph.ts
 */

const RECIPIENT = 'christoph.brueck@gmail.com';

const SUBJECT = 'PflegeAtlas-Update: das Mitmach-Formular hat jetzt richtig Struktur';

const TEXT_BODY = `Hi Christoph,

kurzes Update zum Stand der Plattform — diese Woche ist V1.4 fertig geworden.

Was sich für Einreichungen geändert hat
----------------------------------------

Das /einreichen-Formular war bisher ein freies Textfeld. Jetzt ist es typ-abhängig:

- Neuer Artikel-Vorschlag: Titel + (optional) Intent + Kurzbeschreibung + die vier Sektionen (Definition / Praxis / Risiken / Quellen) — genau wie ein Article aufgebaut ist. Wer einreicht, schreibt jeden Abschnitt einzeln, mit einem einfachen Editor (Fett, Kursiv, Listen, Links).
- Korrekturvorschlag: Man wählt den betroffenen Article, dann per Häkchen die Sektion(en), die man korrigieren möchte. Der aktuelle Sektion-Inhalt wird vorgeladen, man editiert direkt darauf. Optional gibt's ein Begründungsfeld.

Was das für deine Redaktionsarbeit bedeutet
--------------------------------------------

Im Admin (/admin/collections/submissions) siehst du Submissions jetzt mit sprechendem Titel — bei einem neuen Vorschlag der vorgeschlagene Titel, bei einer Korrektur "Korrektur: <Article-Titel>". Inhalte sind nach Sektion strukturiert, du kannst direkt vergleichen.

Bei einer Korrektur kommt jetzt automatisch eine Begründung mit (falls eingereicht). Im Article selbst gibt es unter jeder der vier Sektionen einen Inline-Link "Diese Sektion ergänzen oder korrigieren →", der genau diese Sektion vor-auswählt — wenn dir beim Lesen eines Artikels was auffällt, ist das ein direkter Weg.

Wo der Atlas gerade steht
--------------------------

V1.4 ist auf der Hauptbranch, lokal lauffähig, automatisch getestet. Die nächsten geplanten Schritte sind:

- V1.5: Einreichungen zusätzlich als GitHub-PR exportieren, damit Reviews auch über die GitHub-Oberfläche laufen können — als Vorbereitung darauf, dass mehr Leute mitreviewen (optional, aber wäre mein Vorschlag)
- DSGVO-Track: Datenschutzerklärung, Impressum, AVV — Pflichtpflege vor dem öffentlichen Launch
- Suche: Header-Suchfeld mit Meilisearch aktivieren

Worauf wir uns als Nächstes konzentrieren, entscheiden wir gemeinsam.

Bei Rückfragen einfach auf diese Mail antworten (geht an redaktion@pflegeatlas.org, landet bei Oliver + dir).

Liebe Grüße
Oliver
`;

const HTML_BODY = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; line-height: 1.55; color: #2a2a2a; max-width: 640px; margin: 0 auto; padding: 24px; }
  h2 { font-size: 1.1rem; margin-top: 1.8em; color: #1f5e6d; border-bottom: 1px solid #e6e0d8; padding-bottom: 4px; }
  p { margin: 0.8em 0; }
  ul { padding-left: 1.4em; }
  li { margin: 0.4em 0; }
  code { font-family: ui-monospace, "SF Mono", monospace; background: #f5efe6; padding: 1px 5px; border-radius: 3px; font-size: 0.92em; }
  .footer { color: #777; font-size: 0.9rem; margin-top: 2em; border-top: 1px solid #e6e0d8; padding-top: 1em; }
</style>
</head>
<body>
  <p>Hi Christoph,</p>

  <p>kurzes Update zum Stand der Plattform — diese Woche ist V1.4 fertig geworden.</p>

  <h2>Was sich für Einreichungen geändert hat</h2>

  <p>Das <code>/einreichen</code>-Formular war bisher ein freies Textfeld. Jetzt ist es typ-abhängig:</p>

  <ul>
    <li><strong>Neuer Artikel-Vorschlag:</strong> Titel + (optional) Intent + Kurzbeschreibung + die vier Sektionen (Definition / Praxis / Risiken / Quellen) — genau wie ein Article aufgebaut ist. Wer einreicht, schreibt jeden Abschnitt einzeln, mit einem einfachen Editor (Fett, Kursiv, Listen, Links).</li>
    <li><strong>Korrekturvorschlag:</strong> Man wählt den betroffenen Article, dann per Häkchen die Sektion(en), die man korrigieren möchte. Der aktuelle Sektion-Inhalt wird vorgeladen, man editiert direkt darauf. Optional gibt's ein Begründungsfeld.</li>
  </ul>

  <h2>Was das für deine Redaktionsarbeit bedeutet</h2>

  <p>Im Admin (<code>/admin/collections/submissions</code>) siehst du Submissions jetzt mit sprechendem Titel — bei einem neuen Vorschlag der vorgeschlagene Titel, bei einer Korrektur „Korrektur: &lt;Article-Titel&gt;". Inhalte sind nach Sektion strukturiert, du kannst direkt vergleichen.</p>

  <p>Bei einer Korrektur kommt jetzt automatisch eine Begründung mit (falls eingereicht). Im Article selbst gibt es unter jeder der vier Sektionen einen Inline-Link „Diese Sektion ergänzen oder korrigieren →", der genau diese Sektion vor-auswählt — wenn dir beim Lesen eines Artikels was auffällt, ist das ein direkter Weg.</p>

  <h2>Wo der Atlas gerade steht</h2>

  <p>V1.4 ist auf der Hauptbranch, lokal lauffähig, automatisch getestet. Die nächsten geplanten Schritte sind:</p>

  <ul>
    <li><strong>V1.5:</strong> Einreichungen zusätzlich als GitHub-PR exportieren, damit Reviews auch über die GitHub-Oberfläche laufen können — als Vorbereitung darauf, dass mehr Leute mitreviewen <em>(optional, aber wäre mein Vorschlag)</em></li>
    <li><strong>DSGVO-Track:</strong> Datenschutzerklärung, Impressum, AVV — Pflichtpflege vor dem öffentlichen Launch</li>
    <li><strong>Suche:</strong> Header-Suchfeld mit Meilisearch aktivieren</li>
  </ul>

  <p>Worauf wir uns als Nächstes konzentrieren, entscheiden wir gemeinsam.</p>

  <p>Bei Rückfragen einfach auf diese Mail antworten (geht an <code>redaktion@pflegeatlas.org</code>, landet bei Oliver + dir).</p>

  <p class="footer">
    Liebe Grüße<br>
    Oliver
  </p>
</body>
</html>
`;

async function main(): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.error(
      'RESEND_API_KEY ist nicht gesetzt. Hol den Key aus 1Password (pflegeatlas-prod) ' +
        'und setze ihn als ENV-Var, z.B.:\n' +
        '  RESEND_API_KEY=re_xxx RESEND_FROM_ADDRESS=redaktion@pflegeatlas.org \\\n' +
        '    pnpm tsx scripts/send-handoff-to-christoph.ts',
    );
    process.exit(1);
  }
  if (!process.env.RESEND_FROM_ADDRESS) {
    console.error(
      'RESEND_FROM_ADDRESS ist nicht gesetzt. Sollte eine verifizierte Resend-Domain sein, ' +
        'z.B. redaktion@pflegeatlas.org oder noreply@pflegeatlas.org.',
    );
    process.exit(1);
  }

  const { getPayload } = await import('payload');
  const configModule = await import('../src/payload.config');
  const payload = await getPayload({ config: configModule.default });

  const result = await payload.sendEmail({
    to: RECIPIENT,
    subject: SUBJECT,
    text: TEXT_BODY,
    html: HTML_BODY,
  });

  console.log('Sent:', JSON.stringify(result, null, 2));
}

const isCli = import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
