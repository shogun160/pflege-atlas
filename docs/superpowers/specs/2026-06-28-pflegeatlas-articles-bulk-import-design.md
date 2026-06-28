# PflegeAtlas — Bulk-Import für Artikel (Markdown)

**Datum:** 2026-06-28
**Status:** Spec, noch nicht umgesetzt
**Brainstorm-Ursprung:** Sitzung 2026-06-28, Frage „mehrere Artikel hochladen für Christoph"

## 1. Ziel & Kontext

Christoph (und perspektivisch weitere Editor:innen) sollen mehrere Artikel
auf einmal in den PflegeAtlas einspielen können, ohne das Submission-Formular
einzeln auszufüllen. Die Pflichtfelder-Struktur eines Artikels (Titel, Intent,
Summary plus vier RichText-Sektionen Definition / Praxis / Risiken & Fallstricke
/ Quellen & Weiterführendes) bleibt erhalten — der Import füllt sie 1:1.

**Nicht-Ziel:** Update bestehender Artikel via Datei, Medien-Import (Bilder),
Direkt-Publish ohne Editorial-Review, Tabellen-Konvertierung.

## 2. Format-Entscheidung: Markdown mit YAML-Frontmatter

Das System produziert bereits beim Publish ein klares Markdown-Format
(`src/lib/article-markdown.ts`, Funktion `renderArticleMarkdown`). Der
Bulk-Import liest genau dieses Format — Christoph kann also auch bestehende
published Articles als Vorlage exportieren, lokal editieren und re-importieren.

Verworfene Alternativen:

- **CSV/Excel:** RichText in einer Zelle ist unleserlich; Listen, Absätze, Links
  brechen die Struktur.
- **Direkt-Commit via GitHub:** zu schwergewichtig für Erstbestand; die
  Gegenrichtung (Repo → DB) wäre signifikant mehr Code als ein UI-Upload.

## 3. Dateiformat im Detail

```markdown
---
title: Dekubitusprophylaxe
intent: bedside
summary: Wie man Druckgeschwüre erkennt und verhindert — Schritte am Bett.
# optional:
slug: dekubitusprophylaxe
standardsBound: true
authors: [Christoph Müller]
lastReviewedAt: 2026-06-21
---

## Definition

Inhalt als Markdown…

## Praxis

…

## Risiken & Fallstricke

…

## Quellen & Weiterführendes

…
```

**Pflicht im Frontmatter:** `title`, `intent` (eine von `bedside` / `background` /
`learning`), `summary` (≤ 280 Zeichen).

**Optional im Frontmatter:** `slug` (sonst aus `title` via `slugify` erzeugt),
`standardsBound` (default `false`), `authors` (Liste von Display-Names),
`lastReviewedAt` (ISO-Datum YYYY-MM-DD).

**Ignoriert:** `payloadId` (kann aus Export-Datei stammen), `status` (wird immer
auf `draft` gesetzt — Direkt-Publish ist bewusst ausgeschlossen).

**Sektionen:** Genau vier `##`-Headings: `Definition`, `Praxis`,
`Risiken & Fallstricke`, `Quellen & Weiterführendes`. Vergleich
case-insensitive nach Trim. Reihenfolge egal, aber alle vier müssen vorhanden
und mit nicht-leerem Inhalt versehen sein.

## 4. UI / Einstiegspunkt

Custom Admin-Route unter `/admin/articles-import`, registriert über die
Payload-`admin.components.views`-Konfiguration. Sidebar-Eintrag im
Articles-Bereich (gleicher Ort wie die Collection-Liste).

**Rollen-Gate:** `admin` + `editor`. `contributor` und `reviewer` sehen die
Seite nicht. Die Auswahl folgt der bestehenden Permission-Logik aus
`src/lib/auth-permissions.ts` — neue Action `bulkImport` auf der `articles`-
Resource.

**Drei UI-Zustände:**

1. **Idle.** Drag&Drop-Zone, akzeptiert `.md` (mehrere) und `.zip` (entpackt zu
   `.md`-Dateien). Hinweise: Limits (50 Dateien, je ≤ 256 KB) sichtbar als
   Hilfetext, Link zu einer Beispiel-Datei.
2. **Dry-Run-Vorschau.** Tabelle mit einer Zeile pro erkannter Datei:
   - Dateiname
   - Erkannter Titel
   - Slug (final, nach Auto-Generierung)
   - Status-Badge: `✅ neu` / `⚠️ Slug existiert` / `❌ Validierungsfehler`
   - Detail-Toggle: zeigt Frontmatter-Dump und Validierungs-Issues
     (Hard-Fails + Soft-Warnings)
   - Button **„Import bestätigen"** ist nur aktiv, wenn mindestens eine Zeile
     ✅ ist. Skip-Zeilen werden mitgeführt, aber nicht importiert.
3. **Ergebnis.** Gleiche Tabelle, Status-Spalte zeigt jetzt das finale Resultat:
   - `✅ angelegt` mit Link zur neuen Article-Edit-Page
   - `⚠️ übersprungen` (Slug existierte)
   - `❌ Fehler` mit Begründung

Dry-Run und echter Import laufen gegen denselben Parser; einziger Unterschied
ist das abschließende `payload.create(...)`.

## 5. Architektur

```
src/app/(payload)/admin/articles-import/
  page.tsx                  Server Component, prüft Rolle → 403 oder Client-UI
  ArticlesImportClient.tsx  Client-UI (Drag&Drop, Tabellen, State-Machine)
  actions.ts                Server Actions: parseFilesAction(), runImportAction()

src/lib/article-import/
  parse-markdown-article.ts     Frontmatter + Sektion-Split + Validierung
  markdown-to-lexical.ts        Wrapper um @lexical/markdown
  match-author.ts               Display-Name → User-Id (oder null + Warning)
  unzip-bundle.ts               ZIP-Entpacker mit Pfad-Sanitization
  types.ts                      ParsedArticle, ValidationIssue, ImportRow

tests/unit/article-import/
  parse-markdown-article.test.ts
  markdown-to-lexical.test.ts
  match-author.test.ts
  unzip-bundle.test.ts
tests/integration/
  articles-import-action.test.ts   Dry-Run + Import End-to-End gegen DB
tests/component/
  ArticlesImportClient.test.tsx    Drag&Drop, Tabellen-Render, State-Übergänge
```

Klare Trennung: Parser (`src/lib/article-import/`) kennt kein Payload, Server
Action kennt kein React, Client-Komponente kennt keine DB.

## 6. Datenfluss

```
[User dropt 5 .md oder 1 .zip]
        ↓
parseFilesAction(formData)
  • ZIP-Entpacker (falls vorhanden) → flache Liste { filename, content }
  • Pro Datei: parseMarkdownArticle()
      → { ok: ParsedArticle, warnings: ValidationIssue[] }
        oder { issues: ValidationIssue[] }   (hard-fail)
  • Slug-Resolution: ParsedArticle.slug ?? slugify(title)
  • Bulk-Slug-Existenz-Check:
      payload.find({ collection: 'articles',
                     where: { slug: { in: [allSlugs] } },
                     limit: 100, depth: 0 })
  • Build ImportRow[] mit Status ∈ { ready, skip-duplicate, invalid }
        ↓
Client zeigt Vorschau-Tabelle (rows werden in einem Hidden-Field als JSON
gehalten, damit der Import-Klick keine zweite Parse-Runde braucht)
        ↓
[User klickt „Import bestätigen"]
        ↓
runImportAction(rows)
  • Permission re-check (defense in depth)
  • Für jede ready-Zeile:
    – markdownToLexical() pro Sektion (4×)
    – matchAuthor() für jeden Display-Name
    – payload.create({
        collection: 'articles',
        data: { title, slug, intent, summary, standardsBound,
                lastReviewedAt, authors,
                definition, praxis, risiken, quellen,
                status: 'draft' },
      })
    – Erfolg → ImportResultRow { ok: true, articleId, adminUrl }
    – Fehler → ImportResultRow { ok: false, error: message }
    – Audit-Log-Eintrag: writeAuditLog({ eventType: 'article.bulk_import',
        actor: user.id, subject: article.id,
        metadata: { filename, sourceHash } })
  • skip-duplicate / invalid bleiben unverändert
        ↓
Client zeigt Ergebnis-Tabelle
```

**Kein Bulk-Rollback.** Jede Datei ist isoliert; ein Fehler in Datei #3
blockiert nicht Datei #4. Das hält die UX vorhersehbar (Christoph kann eine
kaputte Datei nachreichen, ohne den Rest wegzuwerfen).

## 7. Validierung

`ValidationIssue { code, message, field? }` mit drei Klassen:

**Hard-Fails (Datei wird nicht importiert):**

- `frontmatter-parse-error` — YAML kaputt
- `title-missing`
- `intent-missing` / `intent-invalid` (nicht eine der drei Optionen)
- `summary-missing` / `summary-too-long` (>280 Zeichen)
- `section-missing` (`definition` | `praxis` | `risiken` | `quellen` fehlt)
- `section-empty` (nur Whitespace)
- `frontmatter-unknown-required-field-malformed` (z. B. `standardsBound: "vielleicht"`)
- `file-too-large` (>256 KB)
- `markdown-conversion-failed` (Edge-Case in `markdownToLexical`)

**Soft-Warnings (Datei wird trotzdem importiert):**

- `author-unknown` — Display-Name matcht keinen User, Feld bleibt leer
- `frontmatter-unknown-field` — z. B. `payloadId`, `status`, unbekannter Key
- `lastReviewedAt-invalid-format` — wird ignoriert statt zu rejecten

**Slug-Existenz** ist kein Validierungsfehler, sondern eine eigene Status-
Kategorie (`skip-duplicate`), damit Christoph sie auf einen Blick erkennt.

## 8. Sicherheit & Limits

- Rollen-Gate dreifach: Page-Render, Server-Action-Einstieg, direkt vor
  `payload.create`.
- Datei-Limits server-seitig hart durchgesetzt:
  - 50 Dateien pro Upload
  - 256 KB pro Datei
  - ZIP entpackt max. 5 MB Gesamtgröße, max. 50 Einträge, nur `.md`-Files
- ZIP-Entpacker (`yauzl` oder Node-eingebauter Stream-basiert) mit Pfad-
  Sanitization: kein `..`, keine absoluten Pfade, keine Symlinks.
- `js-yaml` mit `JSON_SCHEMA` (verhindert YAML-Tag-Code-Execution).
- `markdownToLexical` läuft mit konservativem Allowlist-Pattern (Paragraph,
  Bold, Italic, Code, Link, UL, OL, Heading-Level 3-4, Quote). Tabellen,
  HTML-Einbettungen, Images werden weggeworfen — Article-Schema lässt diese
  Knoten ohnehin nicht zu.

## 9. Audit-Trail

Neuer Audit-Event-Typ `article.bulk_import` (Erweiterung von
`AUDIT_EVENT_TYPES` in `src/lib/audit-log.ts`).

- Actor: importierender User
- Subject: neuer Article
- Metadaten: `{ filename: string, sourceHash: string }` (SHA-256 vom
  Datei-Inhalt, hilfreich für „diese Datei wurde schon importiert"-Forensik)

Folgt der bestehenden Audit-Log-Policy (`docs/legal/audit-log-policy.md`),
fällt unter 90-Tage-Retention.

## 10. Was bewusst NICHT enthalten ist (YAGNI)

- **Kein Update-Modus.** Gleicher Slug → immer skip. Edits via normales
  Admin-Formular.
- **Keine Bilder/Medien.** Wenn der Bedarf kommt, eigener Sub-Track mit ZIP-
  Bundle inkl. `media/`-Ordner und R2-Upload-Hook.
- **Kein Publish-Bypass.** `status` aus Frontmatter wird ignoriert. Christoph
  bekommt seine Artikel ins System, sie durchlaufen aber den normalen
  Editorial-Workflow (Review → Ready-to-Publish → Publish).
- **Keine Tabellen.** Schema unterstützt sie nicht, Markdown-Konverter
  konvertiert sie auch nicht.
- **Keine asynchrone Job-Queue.** 50 Dateien synchron in einer Server Action
  reichen für den realistischen Use-Case. Falls später Massen-Imports von
  500+ Artikeln kommen, wird das nachgezogen.

## 11. Akzeptanzkriterien

1. Eingeloggt als `editor`: `/admin/articles-import` rendert die Drag&Drop-UI.
2. Eingeloggt als `contributor`: Aufruf führt zu 403, Sidebar-Link wird nicht
   angezeigt.
3. Upload von 3 gültigen `.md`-Dateien zeigt Vorschau mit `✅ neu` × 3.
4. Klick auf „Import bestätigen" erzeugt 3 Article-Docs mit Status `draft`
   und 3 Audit-Log-Einträge.
5. Upload einer Datei mit `intent: foo` zeigt Vorschau-Status `❌` und der
   Detail-Toggle nennt `intent-invalid`.
6. Upload einer Datei mit Slug, der bereits in `articles` existiert, zeigt
   `⚠️ Slug existiert` und wird beim Import übersprungen.
7. Upload einer Datei ohne `## Praxis`-Sektion zeigt `❌` mit
   `section-missing` (field: praxis).
8. Upload einer Datei mit `authors: [Unbekannter Name]` importiert
   erfolgreich, die Soft-Warning `author-unknown` ist im Ergebnis sichtbar,
   `authors`-Feld am neuen Article ist leer.
9. Upload eines ZIPs mit 5 `.md`-Dateien funktioniert wie 5 separate Uploads.
10. Upload eines ZIPs mit Pfad-Traversal (`../etc/passwd.md`) wird mit hartem
    Fehler abgelehnt (Datei wird nicht entpackt).
11. Upload einer 300-KB-Datei wird mit `file-too-large` abgelehnt.

## 12. Offene Punkte für die Plan-Phase

- Wahl der `markdown-to-lexical`-Library: `@lexical/markdown` ist offizielle
  Wahl, aber im Node-Kontext ohne DOM gibt es Stolperfallen. Falls Probleme,
  Fallback auf `mdast` → handgeschriebener Lexical-Node-Builder
  (analog zu `lexical-to-markdown.ts` rückwärts).
- ZIP-Library-Wahl: `yauzl` (klein, stream-basiert) bevorzugt;
  `adm-zip` als Fallback wenn yauzl-API zu fummelig.
- Rollen-Permission `bulkImport` muss in `src/lib/auth-permissions.ts` und
  ggf. der `Role`-Migration ergänzt werden.
