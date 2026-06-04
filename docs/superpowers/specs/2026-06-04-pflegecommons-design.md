# PflegeCommons – Design-Spezifikation

> Status: Entwurf nach Brainstorming-Session am 2026-06-04
> Arbeitstitel: **PflegeCommons** (endgültiger Name in Phase 0 zu wählen)

## 1. Vision & Positionierung

**Was wir bauen:** Eine offene, qualitätsgesicherte Wissensplattform für die professionelle Pflege mit Schwerpunkt Langzeitpflege (stationär) und ambulante Pflege, die ihre Inhalte als digitale Allgemeingüter unter CC BY-SA 4.0 verfügbar macht – und parallel ein kommerzielles QM-Tool für Pflegedienste verkauft, das die Plattform finanziert und der Zielgruppe konkrete Arbeitserleichterung bietet.

**Wofür wir explizit nicht stehen:**
- Kein weiteres pqsg – keine Paywall auf Grundlagenwissen, keine 2005er-UX, keine intransparenten Preise
- Kein „Wikipedia für Pflege" mit reiner Encyclopädik – wir sind handlungsorientiert
- Kein generisches Pflegeportal „für alle" – wir haben einen klaren Kern (Langzeit-/Ambulant-Pflege) und erweitern erst, wenn die Community es trägt

**Drei Prinzipien:**
1. **Wissen ist Allgemeingut** – CC BY-SA, frei für alle, auch Ärzt:innen
2. **Werkzeuge sind B2B-Produkt** – Pflegedienste finanzieren das Ökosystem
3. **Einfach, schnell, nicht überladen** – UX-Leitstern

**Erfolg sieht so aus:** In 12 Monaten ist die Wissens-Wiki mit qualitativ hochwertigen Inhalten live, hat eine stabile Rückkehrer-Quote, und das QM-Tool ist mit den ersten zahlenden Pflegediensten als V2 gestartet – mit dem Ziel, die laufenden Infrastruktur-Kosten zu decken.

## 2. Zielgruppe & Inhaltsscope

### Primäre Zielgruppen (freier Zugang)

- **Examinierte Pflegekräfte** (Altenpflege, Krankenpflege, Gesundheits-/Krankenpflege) in stationären Einrichtungen und ambulanten Diensten – Kerngruppe, für die wir primär schreiben
- **Pflegehilfskräfte / Pflegeassistenz** – brauchen verständliche, handlungsorientierte Anleitungen
- **Auszubildende und Quereinsteiger** in Pflegeberufen – profitieren besonders von der festen Artikelstruktur
- **Ärzt:innen mit Pflegeschnittstellen** (Hausärzte, Geriater, Palliativmediziner) – sekundäre Zielgruppe für Querverweise

### Sekundäre Zielgruppe (zahlend, V2)

- **Ambulante Pflegedienste und stationäre Pflegeeinrichtungen** als Organisationen, die das QM-Tool kaufen

### Inhaltlicher Kernbereich (V1)

- Krankheitsbilder im Alter und in der ambulanten Versorgung (Demenz, Schlaganfall, Diabetes, Herz, Krebs, Inkontinenz, palliative Situationen, chronische Wunden …)
- Pflegetechniken (Lagerung, Mobilisation, Injektionen, Katheter, Wundversorgung, Medikamentengabe …)
- Pflegeprozess (SIS-Logik, AEDL, Pflegeplanung – das **Verständnis**, die fertigen Vorlagen kommen ins Bezahltool)
- Expertenstandards-Themen (eigenständig formuliert, nicht 1:1 von DNQP übernommen → Urheberrecht)
- Recht & Rahmen der ambulanten Pflege (Pflegegrade, Kassenleistungen, Dokumentationspflichten – auf Verständnis-Ebene)
- Kommunikation in der Pflege (Angehörige, herausforderndes Verhalten, Sterbebegleitung)

### Bewusst ausgeschlossen für V1

- OP-/ICU-Pflege, Pädiatrie, psychiatrische Pflege als Hauptthemen (Community-getrieben später möglich)
- Reine Medizin/Diagnostik
- Aktuelle politische Pflege-Themen / News
- **Pflegende Angehörige** (potentiell viel später, eigene Tonalität nötig)

## 3. Inhaltsmodell & Redaktion

### Artikel-Struktur (festes Schema)

Jeder Artikel folgt vier Sektionen:

1. **Definition / Kurzantwort** – was ist es, in 2–3 Sätzen
2. **Praxis** – konkrete Anleitung, Schritte, Checkliste („was tun?"). **Erfahrungswissen ist hier eingewoben** („so funktioniert es wirklich")
3. **Risiken & Fallstricke** – häufige Fehler, Sicherheitshinweise, Kontraindikationen. **Erfahrungswissen ist hier eingewoben** („häufige Fehler aus der Praxis")
4. **Quellen & Weiterführendes** – Standards (verlinkt, nicht zitiert), Literatur, verwandte Artikel

**Optionale Bausteine** je Artikel: Entscheidungsbaum, Tabelle, Fallbeispiel, Foto/Diagramm (später Video/Audio).

### Editorial-Modell (Phasen-Evolution)

**Phase 1 (Start, 6–12 Monate):**
- Redakteur:innen: der Initiator (Hauptautor) + 1–2 weitere geprüfte Fachkräfte
- Nur Redakteure publizieren direkt
- Externe können sowohl **Korrekturvorschläge** als auch **komplett neue Artikel** einreichen
- Eingaben gehen in einen Review-Pool → Redakteure prüfen, ergänzen, publizieren
- Einreichende werden als Co-Autor:in genannt

**Phase 2 (ab ~50 aktive Mitwirkende):**
- Stufenmodell wie Wikipedia: angemeldete Nutzer dürfen direkt editieren
- „Sichter" (qualifizierte Pflege-Profis) geben Edits frei, bevor sie öffentlich werden
- Versionierung jederzeit nachvollziehbar

**Phase 3 (langfristig):**
- Vollständiger Wiki-Modus mit Community-Selbstkontrolle

### Qualitäts-Anker (immer)

- Sichtbarer **„Geprüft am"-Status** + Reviewer-Name(n) auf jedem Artikel
- Sichtbarer **Disclaimer** auf jeder Seite („Ersetzt keine ärztliche/pflegerische Beurteilung im Einzelfall")
- Standards/Quellen werden **verlinkt** (nicht 1:1 übernommen) → kein Urheberrechtsproblem
- Lizenz pro Artikel: **CC BY-SA 4.0**, Autorenname pflichtmäßig

### Review-Zyklus (gestaffelt nach Inhaltsart)

- **Stabile Themen** (Pflegetechniken, Krankheitsbilder, Pflegeprozess-Grundlagen): kein automatisches Review-Intervall
- **Änderungs-anfällige Themen** (Expertenstandards-Bezüge, MD-Prüfrichtlinien, QPR-Aktualisierungen, gesetzliche Rahmen, Kassenrecht): automatische Markierung nach 18 Monaten → E-Mail an Reviewer zur Prüfung
- Redaktion kennzeichnet beim Anlegen manuell „standardgebunden: ja/nein"

## 4. Information Architecture & UX

### Startseite – Intent-basiert („Ich brauche…")

Die zentrale Navigationslogik. Nutzer wählt nicht zwischen *Themen*, sondern zwischen *Anliegen*:

- *„…schnelle Hilfe am Bett"* → Pflegetechniken, Checklisten, Notfälle
- *„…Hintergrundwissen"* → Krankheitsbilder, Erklärungen, Pflegeprozess
- *„…etwas zum Lernen"* → Ausbildungsthemen, Quizze
- *„…QM- & Pflegedienst-Tools 🔒"* → klar als bezahlt markiert

Darüber prominent: **Suchfeld** mit semantischer Erweiterung – Eingabe „blauer Zeh" findet „periphere Durchblutungsstörung" / „Dekubitus Stadium I".

### Artikelseite – Sidebar-Layout

- Linke Sidebar (Desktop): sticky Inhaltsverzeichnis + verwandte Artikel + „Geprüft am"-Status
- Hauptbereich: die vier Sektionen (Definition / Praxis / Risiken / Quellen)
- Oben: Breadcrumb (Intent → Kategorie → Artikel)
- Unten: „Korrektur vorschlagen" / „Neuen Artikel zu verwandtem Thema schreiben"

### Mobile-First

- Sidebar wird zu **kollabierbarem TOC oben** (Standard: zugeklappt → Content first)
- Tap auf „📑 Inhalt & Verwandtes ▾" klappt die Navigation auf
- Suche bleibt sichtbar im Header

### Inhalts-Erschließung (drei parallele Wege)

1. **Intent-basierte Startseite** (Erstbesucher und „ich weiß ungefähr was ich brauche")
2. **Volltextsuche mit semantischer Erweiterung** („ich weiß genau, was ich brauche")
3. **Themenindex A–Z** (Stöberer und SEO)

→ Keine sichtbare Tag-Wolke, keine Kategorie-Bäume. Tags existieren intern (für Querverweise), nicht als Navigationselement.

### Bezahlbereich (V2)

- Klar abgesetzter Bereich „QM-Werkzeuge" mit Login-Pflicht
- Auf der freien Wiki sichtbare, nicht-aufdringliche Hinweise („Du arbeitest in einem Pflegedienst? So spart dir unser QM-System Stunden →")
- **Niemals Paywall mitten im Wissen**

### Vertrauens-Elemente immer sichtbar

- Lizenz-Footer (CC BY-SA 4.0)
- Autor:innen + „Geprüft am"-Status pro Artikel
- Disclaimer pro Artikel
- Footer: Impressum, Datenschutz, Open-Source-Verweis (GitHub-Spiegelung)

## 5. Geschäftsmodell

### Free Tier („Wissen ist Allgemeingut")

- Komplette Wiki-Inhalte: lesen, suchen, drucken, teilen, zitieren
- Lizenz: CC BY-SA 4.0
- Korrekturen einreichen, neue Artikel vorschlagen
- Nutzer-Account optional (Beiträge tracken, Favoriten) – Lesezugriff ohne Login
- Kostenlos auch für Ausbildungsstätten, Pflegeschulen, Berufsverbände, Universitäten

### Spenden (Free Tier, V1+)

- Dezenter Footer-Link „Projekt unterstützen" → eigene transparente Spendenseite
- Annahme über Stripe (SEPA + Karte) und PayPal
- Transparenter Kostentracker („dieses Jahr: X € Hosting, davon Y % durch Spenden gedeckt")
- Framing: *„Pflegedienste finanzieren die Infrastruktur. Wenn du als Einzelperson danken willst, freuen wir uns – niemand muss."*
- Kein Pop-up, kein „Wikipedia-Bettel-Banner". Keine Steuerquittungen in V1.

### Struktur-Option für später (≥ 12 Monate nach Launch)

Prüfen, ob gGmbH oder e.V. für die freie Wiki + Hosting sinnvoll ist (echte Spendenquittungen → Pflegeschulen, Stiftungen, Sozialträger als potenzielle Spender). Bezahl-Tools laufen dann über getrennte GmbH/UG, die Lizenzgebühr an die gemeinnützige Einheit zahlt.

### Paid Tier (V2 – „QM-System für Pflegedienste")

**Zielkunde:** ambulante Pflegedienste und stationäre Einrichtungen.

**Was sie bekommen:**
- Komplettes QM-Handbuch, **auto-personalisiert** mit Unternehmensname, Adresse, Geschäftsführung aus Registrierungsdaten
- Click-through-Konfigurator: „Was brauche ich, was nicht?" (z. B. Behandlungspflege ja/nein, Beatmung ja/nein) → Output ist ein **maßgeschneidertes QM-System**, nicht ein Stapel generischer PDFs
- SIS- und AEDL-Vorlagen, Audit-Checklisten, MD-Prüfungs-Vorbereitung
- Updates automatisch, wenn sich gesetzliche Grundlagen ändern
- Mehrbenutzer-Zugang (PDL, QMB, Mitarbeiter mit unterschiedlichen Rechten)

### Preismodell V2 – Entscheidung als Pflicht-Gate vor V2-Build

**Vorläufige Richtung:** Modell B (Einmalkauf + günstige Updates).

**Modell B – Einmalkauf + Updates**
- z. B. **1.499 € einmalig + 19 €/Monat** (oder 199 €/Jahr) für laufende Updates & Hosting
- Begründung: Pflegedienst-Inhaber sind oft konservative Bauchentscheider; „Softwarekauf" fühlt sich leichter an als „noch ein Abo"; CAPEX statt OPEX → bilanziell günstiger für PD; höhere Cash-Spitze direkt nach Verkauf
- Trade-off: Verkaufs-Hürde durch lump sum höher; weniger planbarer Umsatz

**Spätere Erweiterung (sobald weitere Bezahl-Inhalte/Module dazukommen):** Migration zu **Modell C – Hybrid (Kunde wählt zwischen Einmalkauf B und Abo A)**, um beide Kunden-Vorlieben abzudecken.

**Decision-Gate Bedingungen vor V2-Build:**
- ≥ 5 ausführliche Validierungsgespräche mit Pflegedienst-Inhaber:innen geführt
- Preisbereitschaft und Modell-Präferenz dokumentiert
- 2–3 Pilot-Pflegedienste für V2-Test gewonnen (vergünstigt oder umsonst gegen Feedback)

### Zahlung

- **V2:** SEPA Direct Debit (Stripe SEPA, **€0,35 fix pro Transaktion**) + Rechnung mit Überweisung
- **V3+:** Kreditkarte, PayPal, Google Pay, Apple Pay – wenn Volumen es rechtfertigt und Gebühren tragbar sind

### Spätere Erweiterungen (Roadmap-Andeutung, nicht V2)

- Schulungsmodul (frei für Ausbildungsstätten, evtl. Premium-Module für Pflegedienste)
- Audit-Vorbereitungs-Coaching als Service
- Schnittstellen zu Pflegedienst-Software (Vivendi, MediFox, etc.)

### Was wir bewusst NICHT monetarisieren

- Inhalte (immer frei)
- Bildung / Ausbildung (immer frei)
- Werbung auf der Wiki (würde Glaubwürdigkeit zerstören)
- Premium-Abo für Einzelpersonen (würde das pqsg-Modell wiederholen)

## 6. Technische Architektur

### Leitprinzip

Ein einziger, moderner Stack. Open Source wo möglich. Kein Vendor-Lock-in ohne Exit-Pfad. „Boring tech where it doesn't matter, modern where it does."

### Frontend + CMS in einem: Payload CMS 3 + Next.js

- Payload CMS 3 läuft *innerhalb* der Next.js-App – ein Codebase, ein Deployment, eine Datenbank
- Redaktions-UI (für Hauptautor und Reviewer) ist eingebaut, modern, intuitiv
- Leser-Frontend ist Next.js mit React Server Components → schnelle, statische Seiten + dynamische Bereiche
- Open Source (MIT), selbst hostbar
- TypeScript-first

### Datenbank: PostgreSQL via Neon

- Inhalte, Versionen, Nutzer, Kommentare, Submission-Pool, Lizenzen
- Versionierung der Artikel in Payload direkt in der DB
- Hosting: Neon (managed, Free Tier 0,5 GB für V1-Start, dann Pay-as-you-go)

### Suche: Meilisearch

- Open Source, blitzschnell, mit semantischer Suchoption über Embeddings
- Findet „blauer Zeh" → „Dekubitus Stadium I"
- Selbst hostbar (Docker), läuft auf Hetzner-VPS

### Auth: Better-Auth

- Open Source, modern: Magic Link Login, OAuth optional, Multi-Account/Team-Funktionalität für Pflegedienste in V2
- Keine Abhängigkeit von Clerk/Auth0

### Bezahlung: Stripe

- V2: SEPA Direct Debit (€0,35 fix pro Transaktion) + Rechnung
- V3+: Karten, Wallets ohne Code-Umbau nachrüstbar
- Webhooks für Abo-Status (Update-Subscription bei Modell B), Kündigung, Mahnung

### Datei-/Bildspeicher: Cloudflare R2

- S3-kompatibel, ~$0,015/GB/Monat, **kein Egress**
- 10 GB + 1 M Class-A + 10 M Class-B Operations gratis monatlich
- Cloudflare-CDN gratis dazu

### E-Mail: Resend

- Free Tier: 3.000 Mails/Mo (max. 100/Tag) – für V1 ausreichend
- Pro: $20/Mo für 50.000 Mails
- Saubere DX, gute Zustellung, EU-Server

### Open-Source-Spiegelung: GitHub Mirror

- Cron-Job (täglich) exportiert alle freien Artikel als Markdown in ein öffentliches Repo `github.com/<projekt>/inhalte`
- Read-only Mirror garantiert „Open Source"-Versprechen, auch wenn intern CMS-basiert gearbeitet wird
- Wer mag, kann darauf basierend forken, eigene Versionen bauen
- In Phase 2/3 der Editorial-Evolution kann das zum echten PR-Kanal werden
- **Glaubwürdigkeits-Anker:** Sichtbarer „Letzte Sync: vor X Stunden"-Indikator

### Hosting (V1)

| Komponente | Service | Kosten V1 |
|---|---|---|
| Frontend + CMS (Next.js) | Vercel | $0 Hobby / $20 pro Dev/Mo Pro |
| Datenbank | Neon (managed Postgres) | $0 Free / Pay-as-you-go (~$5–15 typisch) |
| Meilisearch + Cron-Jobs + ggf. Plausible | Hetzner Cloud VPS (CX22) | €4,49/Mo |
| Datei-Speicher | Cloudflare R2 | ~$0 (Free-Tier-Limits decken V1) |
| Transaktions-Mails | Resend | $0 (Free Tier, 100 Mails/Tag) |
| Fehler-Monitoring | Sentry | $0 Developer (1 User) / $26/Mo Team |
| Analytics | Plausible self-hosted | $0 (auf Hetzner-VPS) |
| Bezahlung | Stripe | $0 fix + €0,35 SEPA pro Transaktion |

**Realistische Gesamtkosten (Juni 2026):**
- **V1 Start (Solo, Free Tier):** ~€5/Monat (nur Hetzner CX22)
- **V1 nach Wachstum (Vercel Pro für 1 Dev, Neon Launch, Sentry Team):** ~€50–70/Monat
- **V2 mit Stripe live:** ~€60–80/Monat + €0,35 SEPA pro Kunde

### Exit-Pfade (gegen Vendor-Lock)

- **Vercel → Hetzner mit Coolify** (Self-hosted Next.js), wenn Pro-Tier zu teuer wird
- **Neon → Postgres auf Hetzner-VPS**, wenn DB-Kosten kippen
- **Resend → SMTP-Self-Host**, falls Mail-Limits stören
- **Cloudflare R2 → S3-kompatibler Self-Host (MinIO)**, falls nötig

### Sicherheits-Basics ab Tag 1

- HTTPS, HSTS, sichere Headers (Next.js Standard)
- DSGVO-konformes Privacy-Setup (Plausible cookielos, R2 in EU-Region, Neon EU-Region)
- Backup-Strategie (Neon Point-in-Time, R2 versioniert, VPS-Snapshots wöchentlich)
- Rate Limiting auf API (gegen Scraper/Spam)
- Pen-Test vor V2-Launch (wegen Firmendaten in QM-Tool)

### Monitoring & Analytics

- **Sentry** (Fehler-Tracking)
- **Plausible self-hosted** (datenschutzkonform, cookielos, passt zum Ethos)
- Kein Google Analytics, kein Cookiebanner-Albtraum

## 7. Roadmap & Phasen

### Phase 0 – Vorbereitung (2–4 Wochen, vor Code)

- Endgültigen Namen + Domain wählen
- Logo/Visual Identity (minimal)
- **Content-Audit:** existierende Texte sichten, Kategorien definieren, Lücken identifizieren → Backlog für V1
- Rechtliches: Impressum, Datenschutz, AGB (V2-Vorbereitung), Disclaimer-Vorlage
- 1–2 Pilot-Artikel in finaler Struktur als Stil-Referenz

### Phase 1 – Foundation Build (4–6 Wochen)

- Next.js + Payload CMS Setup
- DB-Schema (Artikel, Versionen, Submission-Pool, Nutzer)
- Auth (Better-Auth, Magic Link für Redakteure)
- Artikel-Rendering mit Sidebar-Layout (Desktop) + kollabierbarem TOC (Mobile)
- Intent-basierte Startseite
- Meilisearch eingebunden
- GitHub-Mirror-Cron läuft
- Basis-SEO (Sitemap, Open Graph, schema.org für Medical Articles)

### Phase 2 – Content-Befüllung (parallel zu Phase 1, 8–12 Wochen)

- Hauptautor + 1 Reviewer migrieren/schreiben existierende Texte
- Ziel bei Launch: **40–60 qualitativ hochwertige Artikel** (nicht 200 mittelmäßige)
- Submission-Workflow mit 2–3 eingeladenen Testern validieren

### 🚀 V1 Launch (Monat 3–4 nach Start)

- Soft Launch in Pflege-Community (LinkedIn, Pflege-Foren, Fachgruppen)
- Kein Marketing-Budget – Mund-zu-Mund
- Feedback-Schleife: was suchen Leute, was finden sie nicht?

### Phase 3 – Wachstum & V2-Validierung (Monat 4–9)

- Content-Ausbau (Velocity-Ziel: ≥ 1 neuer/überarbeiteter Artikel pro Woche)
- Spendenseite aktivieren
- Outreach an Pflegeschulen / Ausbildungsstätten
- Erstes Reviewer-Team (3–5 examinierte Pflegekräfte) aufbauen
- **Pflicht: ≥ 5 Pflegedienst-Validierungsgespräche** für V2-Preismodell und Pilotkunden
- 2–3 Pilot-Pflegedienste für V2-Test gewinnen

### Phase 4 – V2 Build (Monat 6–9, parallel zu Wachstum)

- Bezahl-Bereich hinter Login
- Stripe SEPA + Rechnungs-Workflow
- QM-Konfigurator („was brauche ich, was nicht?")
- Auto-Personalisierung mit Firmendaten
- Multi-User-Account-Logik
- PDF-Generierung der personalisierten QM-Dokumente
- Mit Pilot-Pflegediensten getestet

### 🚀 V2 Launch (Monat 9–12 nach Projektstart)

- Geschäftsmodell aktiv
- Preisseite live mit transparenten Preisen
- **Realistisches Ziel V2 + 6 Monate: laufende Kosten decken** (~2–3 zahlende Pflegedienste)
- **V2 + 12 Monate:** 8–15 Kunden = Modell trägt

### Phase 5 – Konsolidierung (Monat 12–18)

- Editorial-Modell evolviert Richtung Phase 2
- Prüfung gGmbH/e.V.-Struktur für Wiki-Säule
- Erweiterung Bezahl-Angebot → Übergang zu Preis-Modell C (Hybrid: Einmalkauf oder Abo)

### Phase 6+ (12–24 Monate)

- Schulungsmodul (frei für Ausbildung)
- Schnittstellen zu Pflegedienst-Software (Vivendi, MediFox)
- Internationalisierung? (offen)

### Was wir NICHT in der ersten Phase machen

- App (mobile Web reicht)
- KI-Chatbot
- Werbung / Reichweiten-Buzz
- Eigene Schulungs-Kurse als Bezahlprodukt
- Marketplace für externe Inhalte

## 8. Offene Punkte, Risiken & Erfolgs-Metriken

### Offene Entscheidungen (in Phase 0 zu klären)

- **Endgültiger Name + Domain** (Arbeitstitel: PflegeCommons)
- **Code-Lizenz** für den Wiki-Teil (MIT oder AGPL) – AGPL schützt stärker gegen kommerzielle Forks ohne Rückgabe, MIT ist freundlicher für Beitragende
- **Konkrete Preisstufen V2** (Vorschlag 1.499 € einmalig + 19 €/Mo oder 199 €/Jahr für Updates) – muss in Validierungsgesprächen verifiziert werden
- **2–3 Pilot-Pflegedienste** für V2-Testing
- **Reviewer-Crew Phase 1:** wer sind die ersten 1–2 zusätzlichen Redakteur:innen?
- **gGmbH/e.V.** für Wiki-Säule: bewusst später entscheiden (nicht V1)
- **Visual Identity / Logo:** minimal vor Launch

### Hauptrisiken & Gegenmaßnahmen

| # | Risiko | Wirkung | Gegenmaßnahme |
|---|---|---|---|
| 1 | **Bus-Faktor 1** – Projekt hängt am Hauptautor | Ausfall = Stillstand | Früh 1–2 Co-Redakteure einbeziehen. Inhalte gehören dem Projekt, nicht Personen |
| 2 | **Haftung bei Patientenschaden** durch falsche Pflege-Info | Existenzbedrohend im Worst Case | Sichtbarer Disclaimer + 4-Augen-Review-Pflicht + Berufshaftpflicht für juristische Person |
| 3 | **Urheberrechtsverletzung** durch zu nahe Übernahme von DNQP/Expertenstandards | Abmahnung, Inhalts-Löschung | Eigenständige Formulierungen, Standards nur **verlinken**. Anwaltsaudit beim ersten Content-Batch |
| 4 | **Content-Velocity zu niedrig** | Wiki wirkt tot, kein SEO, keine Nutzer | Externe Beiträge ernst nehmen, klare Submission-UX, schnelle Reviews |
| 5 | **Reviewer-Engpass** in Phase 1 | Wachstumsbremse, Frust bei Beitragenden | Phase-2-Editorial-Modell früh starten (nach ~6 Monaten) |
| 6 | **B2B-Sales zu langsam** für V2 | Geschäftsmodell trägt nicht | Pilot-Pflegedienste vorher gewinnen, V2 nicht „blind" launchen |
| 7 | **Spam im Submission-Pool** | Reviewer-Zeitfresser | E-Mail-Verifikation + Rate Limiting + ggf. Captcha |
| 8 | **Hosting-Preise steigen** (Vercel, Neon haben das schon getan) | Kostenrisiko | Klar dokumentierte Exit-Pfade (siehe Architektur) |
| 9 | **DSGVO/Datensicherheit V2** (Firmendaten Pflegedienste) | Compliance-Klagen, Vertrauensverlust | EU-Hosting, AV-Verträge, Datenexport-Funktion, Pen-Tests vor V2 |
| 10 | **pqsg-Konkurrenzreaktion** | Preisdruck, Feature-Kopien | Differenzierung über Open-Source-Identität und Modernität halten |
| 11 | **Open-Source-Theater** (GitHub-Mirror wird vernachlässigt) | Glaubwürdigkeitsverlust | Mirror-Cron monitort, sichtbarer „Letzte Sync"-Indikator |
| 12 | **Pflege-Standards ändern sich** (neue MD-Richtlinien etc.) | Veraltete Inhalte → Vertrauen weg | Review-Mail-System für standardgebundene Artikel + Subscribed-Updates für PD in V2 |

### Erfolgs-Metriken (signal- statt absolut-basiert)

**Wiki-Säule (V1):**
- **Konsistenter Wochenzuwachs** der Besucher (Kurve > Zahlen)
- **Inhalts-Velocity:** ≥ 1 neuer/überarbeiteter Artikel pro Woche durchgehend
- **Rückkehrer-Quote:** ≥ 30 % Returning Visitors als echter Nutzen-Indikator
- **SEO-Sichtbarkeit:** für fachliche Long-Tail-Anfragen in Top-10 der Google-Suche
- **Externe Beiträge:** existieren überhaupt fremde Einreichungen? (Ja/Nein-Signal vor Quantität)
- **Suchanfragen ohne Treffer:** Indikator für Content-Lücken (interner KPI)
- **GitHub-Mirror Stars / Forks:** Open-Source-Community-Signal

**B2B-Säule (V2):**
- **V2 + 6 Monate:** laufende Infrastruktur-Kosten gedeckt (~2–3 zahlende Pflegedienste)
- **V2 + 12 Monate:** 8–15 Kunden = Modell trägt
- **Churn:** < 5 %/Jahr bei Modell B (Einmalkauf hat per Definition geringes Churn auf Hauptprodukt; relevant ist Update-Sub-Churn)
- **NPS** (Promotor-Score) – ehrliches Kundenfeedback

**Globale Indikatoren:**
- **Spendenvolumen** (zahlen Privatpersonen tatsächlich freiwillig?)
- **Erwähnungen in Pflegeschulen / Berufsverbänden** (qualitativ, narrativ wichtig)

---

## Anhang: Lizenz-Übersicht

| Bereich | Lizenz |
|---|---|
| Wiki-Inhalte (Artikel, Texte) | **CC BY-SA 4.0** |
| QM-Tool und QM-Inhalte | **Proprietär** (Eigentum der juristischen Person) |
| Quellcode der Plattform | **Open Source (MIT oder AGPL – in Phase 0 zu entscheiden)** für den Wiki-Teil; QM-Tool-spezifischer Code bleibt proprietär |

---

*Spec-Version 1.0 · erstellt 2026-06-04 · Status: Entwurf zur Final-Review durch Projekteigner.*
