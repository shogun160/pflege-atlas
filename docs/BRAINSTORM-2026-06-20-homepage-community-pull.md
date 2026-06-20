# Brainstorm — Homepage als Community-Magnet

**Datum:** 2026-06-20
**Anlass:** Oliver hat sich die aktuelle Homepage angeschaut und festgestellt: optisch sachlich, polarisiert nicht, lädt nicht zum Mitmachen ein — obwohl die Plattform von Community-Beiträgen lebt.
**Status:** Brainstorm-Stand. Keine Entscheidung getroffen, kein Spec, kein Plan. Wird hier dokumentiert, damit die Ideen nicht verloren gehen.

---

## Ist-Stand (Stand 2026-06-20)

Homepage-Komponenten:
- Logo `Pflege·Atlas` + Wortmarke
- Claim: „Wissen für die professionelle Pflege. Frei. Geprüft. Praxisnah."
- Suchfeld (Stub, noch keine Such-Engine)
- 4 farbige „Ich brauche…"-Cards (Konsum-Pfade)
- Footer

Diagnose: Alles, was sichtbar ist, adressiert den **Konsumenten** (Nachschlagen, Lernen, Tools). Die Mitmach-Seite ist nur indirekt erreichbar (Footer / Header-Link `/einreichen`). Keine Gesichter, keine Aktivitätssignale, keine Haltung, kein „warum gibt es das hier überhaupt".

---

## 8 Hebel (Brainstorm-Output)

Sortiert nicht nach Priorität, sondern nach inhaltlicher Achse.

### 1. Haltung statt Claim
Aktuell „Frei. Geprüft. Praxisnah." → korrekt, neutral. Ein Satz mit Standpunkt zieht stärker:

> „Pflegewissen gehört denen, die es täglich anwenden — nicht hinter Paywalls und PDFs."

Polarisiert sanft gegen den Status quo (Springer/Thieme/MDK-PDFs), ohne aggressiv zu sein.

### 2. „Ich kann beitragen"-Card gleichberechtigt
Aktuell sind alle 4 Cards Konsum. Eine 5. Card im gleichen Stil — *„…mein Wissen teilen / korrigieren / prüfen"* — macht Mitmachen visuell gleichwertig statt versteckt im Header. Bonus: ein Live-Signal („3 Korrekturen diese Woche") darunter, sobald Daten existieren.

### 3. „Wer steckt dahinter"-Block (Christoph)
Ein kurzes Element mit Foto/Zitat:

> „Christoph, 30 Jahre Pflege, Inhaber eines Pflegedienstes seit 10 Jahren — *weil ich es satt habe, dass mein Team für jedes Standardwerk zahlen muss.*"

Stärkster sofort umsetzbarer Vertrauens-Hebel. Macht die Seite menschlich.

### 4. Lebenszeichen-Leiste
Mini-Leiste, z.B. unterhalb des Claims oder als Footer-Stripe:

> „Zuletzt aktualisiert: Dekubitusprophylaxe (vor 2 Tagen) · 14 Artikel · 3 Beiträge im Review"

Selbst kleine Zahlen wirken — sie zeigen, dass etwas läuft.

### 5. Reibung erzeugen — gegen den Status quo positionieren
Kleiner Vergleichsblock:

| Springer/Thieme/MDK-PDF | PflegeAtlas |
|---|---|
| bezahlt | frei |
| statisch | lebendig |
| oft veraltet | von der Praxis aktualisiert |

Gibt ein Feindbild, mobilisiert geteilten Frust. Juristisch zu prüfen, falls Markennamen genannt werden — generischer („teure Standardwerke") ist sicherer.

### 6. Niedrigschwellige Mitmach-Türen
„Artikel schreiben" ist eine hohe Schwelle. Niedrigere Türen:

- **„Was fehlt dir?"** — 1-Zeilen-Wunschformular (wird zu internem Backlog)
- **„Help Wanted"-Liste** à la GitHub Good-First-Issue: 3-5 offene Themen, mit Aufwandsschätzung („~30 Min", „braucht Quellenrecherche")

Erzeugt das Gefühl „ich kann was Konkretes tun".

### 7. Identifikation durch Rolle/Setting
Direkt unter dem Claim ein Mini-Pfad:

> „Ich arbeite in… [stationär · ambulant · PDL · Ausbildung]"

Filtert nicht nur Inhalte, sondern signalisiert *„diese Seite ist für meinen Alltag gemacht"*. Ein Klick, hoher Verbleibs-Effekt.

### 8. Contributor Stories — Beitrags-Porträts auf der Homepage
**Vorgemerkt für späteren Ausbau.** Eine Sektion mit 1-3 echten Geschichten von Autor:innen, mit Foto/Initial, Name, Rolle, Region, O-Ton, verlinkten Artikel, Reviewer-Count, Aktualität. Macht den Entstehungsprozess greifbar und zeigt „echte Menschen machen das hier".

#### Aufbau eines Story-Cards
```
┌─────────────────────────────────────────────────────┐
│  [Foto/Initial]   Maria, 47                          │
│                   Wohnbereichsleitung, Münsterland   │
│                                                      │
│  „Die Sektion zu Mundpflege bei Demenz war aus      │
│   den 90ern — wir machen das seit Jahren anders.    │
│   Hab's neu geschrieben, drei Kolleginnen aus       │
│   zwei Häusern haben gegengelesen."                  │
│                                                      │
│  → Artikel: Mundpflege bei Demenz                    │
│  → 3 Reviewer · letzte Änderung vor 4 Tagen          │
└─────────────────────────────────────────────────────┘
```

#### Aktivierungs-Trigger
**Nicht implementieren, bevor:**
1. ≥3 externe Beiträge von verschiedenen Autor:innen akzeptiert sind, UND
2. Die Autor:innen jeweils einen kurzen O-Ton geliefert haben, UND
3. Editorial-Workflow (V1.6) das Einsammeln des O-Tons als Schritt integriert hat („Magst du in 3 Sätzen sagen, warum du das geschrieben hast?").

**Bis dahin:** Vorschlag 3 (Christoph-Block) übernimmt die Wärme-Funktion.

#### DSGVO-Vorklärungen (wenn aktiviert)
- Opt-in pro Beitrag für Foto/Region/O-Ton (nicht global im Author-Profil)
- Region: lieber Bundesland/Großregion („Münsterland") als Stadt — kleine Orte = deanonymisierend
- Foto-Einwilligung mit Widerrufsrecht (Workflow + Speicher-Mechanismus außerhalb des Submission-Formulars)
- Reibungs-O-Ton („alte Version war aus den 90ern") nur unkritisch wenn gegen externe Standardwerke, nicht gegen Personen

#### Wartung
- Sichtbare Datums-Stempel an der Story selbst („vor 4 Tagen")
- Auto-Hide nach X Wochen ohne neue Story — Sektion verschwindet, statt veraltet zu wirken
- Redaktionelles Ritual: O-Ton-Frage als Standard-Schritt im Editorial-Workflow

#### Aufwand-Schätzung (MVP, ohne Foto-Upload)
- 1 Komponente `ContributorStory` + Sektion auf Homepage: ~½ Tag
- Author-Profil-Erweiterung (Region, O-Ton, Opt-in-Flag): 1-2 Tage
- Admin-UX zum Auswählen hervorgehobener Stories: 1 Tag
- Foto-Upload + Einwilligungs-Flow: eigener Mini-Track (juristisch sensibel)

---

## Quer-Hinweis Tonalität

Aktuell siezt die Seite (implizit, durch Distanz). Pflege ist eine Du-Kultur — ein konsequentes Du („Was brauchst *du*?", „Teile *dein* Wissen") senkt die Schwelle. Risiko: wirkt anbiedernd, wenn das die einzige Änderung bleibt. Funktioniert nur im Paket mit Substanz-Hebeln.

---

## Wirkung-/Aufwand-Matrix (für spätere Plan-Wahl)

| Hebel | Aufwand | Wirkung | Abhängig von Community |
|---|---|---|---|
| 1. Haltung-Claim | XS | hoch | nein |
| 2. Mitmach-Card | S | hoch | nein |
| 3. Christoph-Block | S | sehr hoch | nein |
| 4. Lebenszeichen | M | mittel | wenig (Daten-Aggregation) |
| 5. Reibungs-Vergleich | S | hoch | nein (aber juristisch sensibel) |
| 6. Help-Wanted-Pipeline | M-L | mittel | ja (Backlog-Pflege) |
| 7. Rollen-Filter | M | mittel | wenig (Content-Tagging) |
| 8. Contributor Stories | M (MVP) | sehr hoch | **stark** — siehe Trigger |

**Empfehlung für eine erste Homepage-Iteration:** Hebel 1 + 2 + 3 zusammen (alle XS-S, kein Community-Bottleneck, hoher Effekt). Hebel 8 später, wenn die Voraussetzungen stehen.

---

## Bezug zu existierenden Tracks

- **V1.6 Editorial-Workflow:** muss den O-Ton-Schritt (Hebel 8) integrieren, falls Contributor Stories später kommen sollen.
- **DSGVO-Track:** Foto-Einwilligungen + Profil-Felder sind Teil der DSGVO-Vorbereitung vor Production-Launch.
- **Meilisearch:** würde das Suchfeld endlich funktionsfähig machen — eigener Track, unabhängig.
- **V1.5 PR-Workflow:** orthogonal, beeinflusst diesen Track nicht direkt.

---

## Nicht im Brainstorm enthalten (bewusste Auslassungen)

- Onboarding-Tour „In 60 Sekunden verstehen" — könnte parallel kommen, aber separate Diskussion
- Newsletter / Discord / Forum — größere Community-Infrastruktur-Frage, eigener Track
- Animations / Mikrointeraktionen — eher Visual-Polish-Round 2, nicht Community-Pull-Frage

---

## Quellen

- Brainstorm-Session 2026-06-20 mit Oliver
- Memory-Pendant: `~/.claude/projects/-Users-oliverwosnitza/memory/project_pflegeatlas_homepage_community.md`
