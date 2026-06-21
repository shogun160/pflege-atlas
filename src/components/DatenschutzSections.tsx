export function DatenschutzSections() {
  return (
    <>
      <section>
        <h2>Hosting und Datenverarbeitung (Auftragsverarbeiter)</h2>
        <p>
          Wir nutzen folgende Anbieter zur Verarbeitung personenbezogener Daten.
          Mit allen Anbietern bestehen Auftragsverarbeitungsverträge (AVV) bzw.
          Data Processing Agreements (DPA). Übermittlungen in die USA stützen
          sich auf den EU-US Data Privacy Framework (DPF, angemessenheitsbeschluss
          der EU-Kommission vom 10. Juli 2023) und Standardvertragsklauseln (SCC).
        </p>
        <ul>
          <li>
            <strong>Vercel Inc.</strong> (San Francisco, USA, EU-DPF zertifiziert) —
            Hosting der Webanwendung in Frankfurt (Region <code>fra1</code>).
            Server-Logs werden für 1 Stunde aufbewahrt. Rechtsgrundlage:
            Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am Betrieb).
          </li>
          <li>
            <strong>Neon, Inc.</strong> (San Francisco, USA, EU-DPF zertifiziert) —
            Postgres-Datenbank in Region eu-central-1 (Frankfurt). Sicherungs-
            kopien werden für 7 Tage aufbewahrt (Point-in-Time-Recovery).
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
          </li>
          <li>
            <strong>Cloudflare, Inc.</strong> (San Francisco, USA, EU-DPF
            zertifiziert) — DNS und CDN-Edge-Schicht; eingehende E-Mails über
            Cloudflare Email Routing (nicht gespeichert, nur weitergeleitet);
            R2 Object Storage für Profilbilder (EU-Region); Turnstile als
            cookielose Spam-Schutz-Lösung im Beitrags-Formular; Cloudflare Web
            Analytics als <em>cookielose</em>, datenschutzfreundliche Reichweitenmessung.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Schutz und Funktion).
          </li>
          <li>
            <strong>Resend, Inc.</strong> (San Francisco, USA, EU-DPF zertifiziert) —
            Versand transaktionaler E-Mails (Einladungen, Passwort-Reset,
            Benachrichtigungen). Mail-Logs werden für 30 Tage aufbewahrt.
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragsdurchführung).
          </li>
          <li>
            <strong>GitHub, Inc.</strong> (Tochter der Microsoft Corporation,
            USA, EU-DPF zertifiziert über Microsoft) — Quellcode-Repository und
            Veröffentlichungsplattform für angenommene Beiträge (siehe nächster
            Abschnitt). GitHub ist hier <em>Empfänger</em> nach Art. 13 Abs. 1
            lit. e DSGVO, nicht klassischer Auftragsverarbeiter. Rechtsgrundlage:
            Art. 6 Abs. 1 lit. f DSGVO (Open-Source-Zweck) und Einwilligung
            beim Einreichen.
          </li>
        </ul>
      </section>

      <section>
        <h2>Veröffentlichung angenommener Beiträge auf GitHub (V1.5)</h2>
        <p>
          Wenn ein eingereichter Beitrag von der Redaktion angenommen wird,
          spiegeln wir den Inhalt als öffentlichen Pull-Request in unserem
          GitHub-Repository{' '}
          <a
            href="https://github.com/shogun160/pflege-atlas"
            target="_blank"
            rel="noreferrer noopener"
          >
            shogun160/pflege-atlas
          </a>
          . Der Inhalt ist ab diesem Zeitpunkt öffentlich einsehbar und Teil
          des unveränderlichen Versionsverlaufs des Repositorys.
        </p>
        <p>
          <strong>Wichtig:</strong> Eine Löschung des Inhalts aus diesem
          Versionsverlauf ist <em>unwiderruflich nicht möglich</em>. Der Inhalt
          steht außerdem unter der Lizenz Creative Commons BY-SA 4.0 und kann
          von Dritten kopiert und weiterverwendet werden. Beim Einreichen
          weisen wir hierauf in einem Hinweis-Banner („Datenschutz: Bitte
          schreib generisch — keine Namen, Initialen oder Personen-Bezüge…{'"'})
          explizit hin.
        </p>
      </section>

      <section>
        <h2>Editorial-Workflow und Sichtbarkeit für Redakteur:innen (V1.6)</h2>
        <p>
          Beiträge durchlaufen einen redaktionellen Review. Redakteur:innen,
          Reviewer:innen und Administrator:innen sehen im Admin-Backend:
          den Beitragstitel, den Inhalt, die optionale Kontakt-E-Mail-Adresse
          der einreichenden Person sowie den Bearbeitungs-Status. Diese
          Daten werden bis zur abschließenden Bearbeitung (Annahme oder
          Ablehnung) verarbeitet.
        </p>
        <p>
          Bei angemeldeten Beiträger:innen sind außerdem Name und Profil
          für Redakteur:innen sichtbar.
        </p>
      </section>

      <section>
        <h2>Anonymisierung gelöschter Konten</h2>
        <p>
          Beim Löschen eines Beiträger:innen-Kontos werden die personenbezogenen
          Daten (Name, E-Mail, Profilbild) entfernt bzw. anonymisiert. Die
          Verknüpfung zwischen Konto und veröffentlichten Beiträgen bleibt
          erhalten, da die Beiträge unter Creative Commons BY-SA 4.0 stehen
          und der Lizenzhinweis Bestand haben muss. Der Eintrag in unserer
          Datenbank zeigt nach Löschung „Gelöschte:r Beitragende:r{'"'} statt
          des Klarnamens.
        </p>
      </section>

      <section>
        <h2>Aufbewahrungsfristen</h2>
        <table>
          <thead>
            <tr><th>Daten</th><th>Aufbewahrung</th></tr>
          </thead>
          <tbody>
            <tr><td>Angenommene Beiträge</td><td>dauerhaft (Audit-Trail; Inhalt zusätzlich öffentlich auf GitHub)</td></tr>
            <tr><td>Beiträge im Review</td><td>bis Review-Entscheidung</td></tr>
            <tr><td>Abgelehnte Beiträge</td><td><strong>30 Tage</strong>, danach automatische Löschung</td></tr>
            <tr><td>Aktive Konten</td><td>bis zur Konto-Löschung durch Nutzer:in</td></tr>
            <tr><td>Gelöschte Konten (anonymisiert)</td><td>dauerhaft (Lizenz-Hinweis)</td></tr>
            <tr><td>Vercel-Server-Logs</td><td>1 Stunde</td></tr>
            <tr><td>Neon-Datenbank-Sicherungen</td><td>7 Tage Point-in-Time</td></tr>
            <tr><td>Resend-Mail-Logs</td><td>30 Tage</td></tr>
            <tr><td>Cloudflare Web Analytics</td><td>6 Monate (aggregiert, ohne PII)</td></tr>
            <tr><td>GitHub-Veröffentlichungen</td><td>dauerhaft, öffentlich, unwiderruflich</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Gemeinsam Verantwortliche (Art. 26 DSGVO)</h2>
        <p>
          PflegeAtlas wird von Oliver Wosnitza und Christoph Brück als
          <em> gemeinsam Verantwortliche</em> nach Art. 26 DSGVO betrieben.
          Eine entsprechende Vereinbarung regelt die Aufgaben-Verteilung
          intern. Der wesentliche Inhalt: Oliver Wosnitza ist primärer
          Ansprechpartner für Hosting, Sicherheit, Datenschutz-Anfragen
          und technische Pannen; beide sind als Editor:innen/Reviewer:innen
          gemeinsam für die inhaltliche Qualitätssicherung verantwortlich.
          Sie können Ihre Rechte gegenüber jedem von uns geltend machen.
        </p>
      </section>

      <section>
        <h2>Ihre Rechte als betroffene Person</h2>
        <p>
          Sie haben jederzeit das Recht auf Auskunft (Art. 15 DSGVO),
          Berichtigung (Art. 16), Löschung (Art. 17, soweit nicht
          ausgeschlossen durch öffentliche Veröffentlichung auf GitHub),
          Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit
          (Art. 20) und Widerspruch (Art. 21).
        </p>
        <p>
          Außerdem haben Sie das Recht, sich bei einer Datenschutz-Aufsichts-
          behörde zu beschweren (Art. 77 DSGVO).
        </p>
        <p>
          Anfragen richten Sie bitte an:{' '}
          <a href="mailto:datenschutz@pflegeatlas.org">
            datenschutz@pflegeatlas.org
          </a>
          . Wir antworten in der Regel innerhalb von 14 Tagen, spätestens
          innerhalb der gesetzlichen Frist von einem Monat.
        </p>
        <p>
          Eingeloggte Beitragende können außerdem über{' '}
          <a href="/mein-bereich">Mein Bereich</a> eigenständig ihre Daten
          herunterladen (Selbst-Service-Export) und ihr Konto löschen.
        </p>
      </section>
    </>
  );
}
