# PflegeAtlas — Visual Identity & Frontend Polish V1.1 (Design-Spec)

**Status:** Entwurf nach Brainstorming-Session am 2026-06-05 · Folgt auf V1 Core Foundation (gemerged auf `main` als `bb0dc60`).

## 1. Zweck und Scope

V1.1 löst zwei verbundene Probleme aus dem V1-Handoff:

1. Das Lese-Frontend hat *kein* eigenes visuelles Profil — es trägt nur generische Tailwind-Defaults plus die Reste der Payload-CLI-Demo-CSS.
2. Der Arbeitstitel **PflegeCommons** soll durch den finalen Markennamen **PflegeAtlas** ersetzt werden, weil `pflege-wiki` als Wunschname belegt ist und `PflegeAtlas` im DACH-Markt orientierungsstark und sprachlich klar ist.

V1.1 ist ein UI/CSS-Refactor *ohne* funktionale Änderung. Es führt ein Design-Token-System ein, ersetzt die Wortmarke, polished die Lese-Komponenten und tauscht alle UI-sichtbaren Vorkommen von „PflegeCommons" gegen „PflegeAtlas".

V1.1 ist *nicht* der Plan für Search-UI, Auth-UI, Marketing-Pages oder Dark Mode. Diese sind explizit Spätere-Plan-Themen.

## 2. Markenname und Domain-Strategie

**Produktname (UI):** PflegeAtlas

**Wortmarke:** `Pflege·Atlas` — Mid-Dot `·` (U+00B7) als trennendes Identitätszeichen in Akzent-Farbe.

**Domain-Strategie:**

- Primär: `pflegeatlas.org` — passt zum Open-Content/Community-Charakter; registriert Oliver selbst (Cloudflare Registrar oder Porkbun empfohlen).
- Sekundär: `pflegeatlas.eu` — frei und unauffällig.
- `pflegeatlas.de` und `pflegeatlas.com` sind belegt (geparkt, keine aktive Site). Squatter-Verdacht. Soll später per Sedo-/DENIC-Inquiry adressiert werden, ist aber kein V1.1-Blocker.

**Repo- und Code-Identifier-Update außerhalb V1.1:** Repo-Verzeichnis `pflege-brainstorm` und npm-Paketname `pflegecommons` bleiben in V1.1 unverändert, weil sie nicht benutzerseitig sichtbar sind. Eine spätere Umbenennung gehört in einen Infrastruktur-Plan, sobald die Domain registriert und das öffentliche Repo aufgesetzt ist.

## 3. Visuelle Tonalität

**Charakter:** *Warm & menschlich.* Pflege ist ein Beruf am Menschen, nicht am Patient-als-Akte. Cremeweißer Untergrund, Serif-Headlines, ruhige Akzentfarben mit emotionalem Anker.

**Bewusste Nicht-Charaktere:**

- Nicht klinisch-blau-Wikipedia-medizinisch (zu kalt).
- Nicht behördlich-grau (zu nüchtern, verstößt gegen Spec-Maxime „Pflege ist Beruf am Menschen").
- Nicht techy-startup-bunt (verstößt gegen Spec-Maxime „einfach, schnell, nicht überladen").

## 4. Farbsystem

Sechs Tokens, keine sortierten Skalen — V1.1 bewusst flach, Skalen kommen wenn Dark Mode oder ein zweiter Brand-Tone gebraucht werden.

| Token | Hex | Rolle |
|---|---|---|
| `--color-surface` | `#f7f4ee` | Seiten-Hintergrund (Cremeweiß) |
| `--color-brand` | `#1f5e6d` | Petrol — primäre Marken-Farbe, Links, Buttons, H1-Akzent, Wortmarken-Hauptton |
| `--color-accent` | `#b8553d` | Clay/Terracotta — Intent-Labels, Mid-Dot in Wortmarke, Akzent-Highlights |
| `--color-ink` | `#1f2937` | Primärer Text (Headlines, Body in maximaler Stärke) |
| `--color-ink-muted` | `#4b5563` | Sekundärer Text (Caption, Sublinien) |
| `--color-rule` | `#e8e2d4` | Trennlinien, Card-Borders, Footer-Rule |

**Kontrast-Sicherheit:**
- `#1f5e6d` auf `#f7f4ee`: 7.0:1 (AAA für Body, AA für 24px+ Large)
- `#1f2937` auf `#f7f4ee`: 13.6:1 (AAA überall)
- `#b8553d` auf `#f7f4ee`: 4.6:1 (AA für Body, AAA für 24px+)

Clay (`--color-accent`) wird *nur* für nicht-bodytext-Elemente verwendet (Labels in 12-14px, Mid-Dot, Hover-Akzente), damit der knappe Kontrast unkritisch ist.

**Default-Status-/Feedback-Farben:** V1.1 definiert *keine* eigenen Error/Success/Warning-Farben. Falls Disclaimer eine visuelle Warnung braucht, nutzt er Brand-Petrol als Borderlinie links, nicht Rot. Dedizierte Status-Farben gehören in einen Form-/Feedback-Plan.

## 5. Typografie

**Schriftfamilie:** IBM Plex Familie aus einer Hand — `IBM Plex Serif` für Headlines und Wortmarke, `IBM Plex Sans` für UI und Body. Beide Open Source, Latin-Subset reicht für Deutsch inkl. Umlaute und scharfes ß.

**Lade-Strategie:** Beide über `next/font/google` self-hosted (kein externes CSS-Request, keine Fremd-CDN). Variable-Font-Versionen, `display: 'swap'`, `subsets: ['latin']`, je eine CSS-Variable `--font-serif` und `--font-sans` exposed.

**Typo-Skala (alle Werte in rem-Basis 16px):**

| Token | Größe | Line-Height | Font | Weight | Verwendung |
|---|---|---|---|---|---|
| `display` | `2rem` (32px) | `1.2` | Serif | 600 | Artikel-H1, Homepage-Hero-Titel |
| `h2` | `1.5rem` (24px) | `1.3` | Serif | 600 | Sektion-Headers in Artikel (`1. Definition` etc.) |
| `h3` | `1.25rem` (20px) | `1.35` | Serif | 600 | Unter-Headings |
| `body` | `1.0625rem` (17px) | `1.65` | Sans | 400 | Lauftext im Prose-Container |
| `ui` | `0.9375rem` (15px) | `1.5` | Sans | 500 | Buttons, Nav-Links, Card-Titel |
| `label` | `0.75rem` (12px) | `1.4` | Sans | 600 + `letter-spacing: 0.08em` + `uppercase` | Intent-Labels, „Geprüft am" |

Mobile-Tuning: `body` bleibt 17px (Lesbarkeit am Bett-Handy ist der höchste Use-Case), keine Verkleinerung unter 1024px Breakpoint.

## 6. Wortmarke und Favicon

**Wortmarke (`Pflege·Atlas`):**

- Schrift: IBM Plex Serif Medium (500)
- Farbe: Petrol (`--color-brand`)
- Mid-Dot (U+00B7) in Clay (`--color-accent`), Weight 700
- Verwendung in drei Größen: 36px (mobile Header), 24px (desktop Header), 12-14px (Footer-Caption)
- Komponente: `src/components/Wordmark.tsx` — Prop `size: 'sm' | 'md' | 'lg'`

**Favicon:**

- Symbol: `P·` — Plex Serif „P" in Petrol + Mid-Dot in Clay, mittig auf Baseline-Mitte
- Hintergrund: Cremeweiß mit 1.5-2px Petrol-Border (rounded corners), für gute Sichtbarkeit im weißen Browser-Tab-Bereich
- Größen: 64px (Apple Touch), 32px (Default), 16px (Tab)
- Implementierung: SVG-Favicon über Next.js File-Konvention (`src/app/(frontend)/icon.svg`) — Next generiert Multi-Size-Ausgabe; zusätzlich `src/app/(frontend)/apple-icon.png` als PNG-Fallback für iOS

## 7. Design-Token-Architektur

Tailwind CSS v4 hat einen nativen `@theme`-Block, in dem Design-Tokens deklariert werden und der direkt Tailwind-Utilities generiert (`bg-surface`, `text-brand`, `font-serif`).

**Implementierung in `src/app/(frontend)/styles.css`:**

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  /* Farben */
  --color-surface: #f7f4ee;
  --color-brand: #1f5e6d;
  --color-accent: #b8553d;
  --color-ink: #1f2937;
  --color-ink-muted: #4b5563;
  --color-rule: #e8e2d4;

  /* Schriftfamilien (von next/font befüllt) */
  --font-serif: var(--font-plex-serif), Georgia, "Times New Roman", serif;
  --font-sans: var(--font-plex-sans), system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
```

Die `--font-plex-serif` und `--font-plex-sans` werden in `layout.tsx` durch `next/font` injiziert.

**Webfont-Setup in `src/app/(frontend)/layout.tsx`:**

```typescript
import { IBM_Plex_Serif, IBM_Plex_Sans } from 'next/font/google'

const plexSerif = IBM_Plex_Serif({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex-serif',
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex-sans',
})
```

Beide Variablen kommen am `<html>`-Element an: `<html lang="de" className={`${plexSerif.variable} ${plexSans.variable}`}>`.

**Tailwind-Typography-Custom-Theme:**

Die `prose`-Klasse von Tailwind Typography muss auf das Token-System gemappt werden, damit Artikel-Sektionen Plex Serif für Headings und Plex Sans für Body nutzen, mit Petrol-Links. Variante via `@plugin`-Optionen oder Klassen-Override im Article-Layout. Konkrete Tailwind-v4-Syntax wird im Implementation-Plan entschieden — V4-Typo-Customisation ist neu und braucht Sanity-Check beim Build.

## 8. Komponenten-Polish-Inventar

### Aktiv überarbeitet

**`src/app/(frontend)/layout.tsx`**
- `next/font`-Imports + Variable-Injection am `<html>`
- `<title>` und `metadata.description` mit „PflegeAtlas"
- Header: aktuelles `<a>PflegeCommons` ersetzen durch `<Wordmark size="md" />` als Link auf `/`

**`src/app/(frontend)/page.tsx`**
- H1 wird Plex-Serif-Display-Headline in Text `PflegeAtlas` (ohne Mid-Dot — der Dot bleibt logo-only, damit H1 + Header-Wortmarke nicht redundant erscheinen)
- Subtitle bleibt textuell, in `body`-Token gestylt
- Such-Stub: Border-Color → Petrol, Plex-Sans für Placeholder
- Glossar-Link bleibt funktional, neu getypt

**`src/app/(frontend)/artikel/[slug]/page.tsx`**
- Intent-Pill: aktuell `text-xs uppercase tracking-wider text-gray-500` → `label`-Token in Clay
- H1 (Article-Titel): `display`-Token in Plex Serif
- Sektion-H2 (`1. Definition`, `2. Praxis`, etc.): `h2`-Token
- Datums-/Reviewer-Footer: `ui-muted` Plex Sans

**`src/components/Wordmark.tsx`** (neu)
- Props: `size: 'sm' | 'md' | 'lg'` mit Default `md`
- Optional: `as: 'a' | 'span'` (für Header-Link vs. Footer-Caption)

**`src/components/IntentCards.tsx`**
- Aktuell vier verschiedene Border-Farben (blue/emerald/amber/violet)
- Neu: alle Cards mit `--color-rule`-Border und linker Akzentlinie in `--color-brand` (Petrol); Intent-Label in Clay als kleines Inset-Tag
- Card-Title: `ui`-Token, Plex Sans Medium
- Card-Description: `body`-Token (etwas kleiner, Sans)
- QM-Card behält das `🔒` als visuelle Marker; Akzent in `--color-ink-muted` statt Violet

**`src/components/Footer.tsx`**
- Trennt sich vom „PflegeCommons"-Plaintext: oben `<Wordmark size="sm" />`
- Lizenz- und Hinweis-Texte: `body` und `ui-muted`-Token
- Borderlinie zur Page in `--color-rule`
- Hinweis-Disclaimer behält die bestehende Sätze, neu gesetzt

**`src/components/ArticleTOC.tsx`**
- Aktuell Blue-600-Border und Blue-700-Text für Mobile-Button → Petrol-Token
- Desktop-Sidebar-Links: Petrol on hover statt Blue-600
- „Auf dieser Seite"/„Verwandt"/„Geprüft"-Label-Caps: `label`-Token, Clay (Akzent)

**`src/components/ArticleDisclaimer.tsx`**
- Aktuell sehr minimal
- Neu: Cremeweiße Inset-Card mit 3px Petrol-Linie links, `ui`-Typo, `--color-ink-muted` für Text

**`src/components/ArticleLayout.tsx`**
- Prose-Container über Tailwind-Typography mit Plex-Theme
- Sticky-Behavior bleibt, Spacing über Tokens

**Favicon-Dateien**
- `src/app/(frontend)/icon.svg` neu — SVG-Favicon mit P + Mid-Dot
- `src/app/(frontend)/apple-icon.png` neu (180×180)
- Ggf. `src/app/(frontend)/icon.png` (32×32) als Fallback für ältere Browser

### Nur durch Tokens beerbt

- `src/app/(frontend)/index/page.tsx` (A-Z-Index) — Farben und Schriften kommen automatisch über Tokens, keine Layout-Änderung
- `src/app/sitemap.ts` — bekommt neue Base-URL erst, wenn die Domain wirklich registriert ist; in V1.1 bleibt sie auf `process.env.NEXT_PUBLIC_SITE_URL` mit Localhost-Default

### Tests

- `tests/component/IntentCards.test.tsx`, `tests/component/Footer.test.tsx`, `tests/component/ArticleTOC.test.tsx`, `tests/component/ArticleDisclaimer.test.tsx` werden vermutlich Snapshots oder Klassen-Assertions enthalten, die kollidieren. Tests werden mitgepflegt — Verhalten ist unverändert, nur Markup-Klassen/Texte ändern.
- Neuer Test: `tests/component/Wordmark.test.tsx` — verifiziert Rendering, Mid-Dot in Akzentfarbe, drei Größen.
- Snapshot-Tests vermeiden, falls neue eingeführt werden — Klassen-Assertions sind wertvoller.

## 9. Rebrand-Sweep (Textstellen)

Vor dem visuellen Polish wird ein Search-and-Replace-Sweep für UI-Strings durchgeführt:

| Ort | Vorher | Nachher |
|---|---|---|
| `layout.tsx` `metadata.title` | `PflegeCommons` | `PflegeAtlas` |
| `layout.tsx` `metadata.description` | bleibt inhaltlich | bleibt |
| Header-Link-Text | `PflegeCommons` | Wortmarken-Komponente |
| `page.tsx` H1 | `PflegeCommons` | `PflegeAtlas` (Plain-Text in Display-Typo, ohne Mid-Dot) |
| Page-Subtitle | bleibt | bleibt |
| `Footer.tsx` Wortmarke-Caption | `PflegeCommons` (implizit) | `<Wordmark size="sm" />` |
| `ArticleDisclaimer.tsx` Text | falls drin: nein, generisch | bleibt |
| `tests/e2e/*.spec.ts` | erwartete Titel-Texte | nachziehen |
| `tests/component/*.test.tsx` | etwaige Strings | nachziehen |
| `README.md` Top-Heading | `pflegecommons` | `PflegeAtlas` |
| `docs/HANDOFF-*.md` | bleibt (historisch) | bleibt — Historie nicht umschreiben |

Repo-Pfad (`/Users/oliverwosnitza/pflege-brainstorm`), Package-Name (`pflegecommons` in `package.json`), Postgres-DB-Name (`pflegecommons`), Migrations-Files — alles bleibt für V1.1 unverändert, weil nicht user-facing.

## 10. Was V1.1 nicht enthält

- Suchfeld-UI im Header (kommt mit Meilisearch-Plan)
- Dark Mode (Tokens sind so gewählt, dass ein späterer `@media`-Block additive Werte ergibt)
- Bildmarken, Illustrationen, Stock-Fotos
- Impressum-, Datenschutz-, AGB-Seiten (rechtlicher Block separat)
- Animationen / Micro-Interactions
- Touch-Target-Audit für Mobile (eigener Polish-Plan oder mit Meilisearch zusammen)
- A-Z-Index-Layout-Polish (erbt nur Tokens)
- Repo-Rename, Paket-Rename, Postgres-DB-Rename

## 11. Erfolgskriterien

V1.1 ist abgeschlossen, wenn:

1. `pnpm lint` 0 Errors
2. `pnpm test` alle grün, inkl. neuer `Wordmark.test.tsx` und aktualisierte Component-Tests
3. `pnpm build` ohne Warnings für CSS-Token-System
4. Browser-Verifikation (Chrome + Safari + Firefox + Mobile): Startseite, Artikel-Seite, A-Z-Index zeigen Plex Serif Headlines, Plex Sans Body, Cremeweißer Hintergrund, Petrol-Akzente, Clay-Labels, Mid-Dot in Wortmarke und Favicon
5. Keine Vorkommen von „PflegeCommons" im UI-Markup (curl-Check des Source-HTML)
6. Favicon im Browser-Tab sichtbar (P + Punkt)
7. Lighthouse Accessibility Score >= 95 für Startseite und Artikel-Seite (Kontrast-Sanity)
8. Keine Hydration-Warnings in Chrome DevTools-Console (gilt bereits aus V1)

## 12. Risiken und Mitigations

**Risiko 1:** Tailwind v4 `@theme` ist relativ neu. Mögliche Friktion mit Tailwind Typography Plugin v0.5 (das auf v3-Konventionen aufgebaut wurde).
- Mitigation: Token-Setup vorab in einem Spike-Branch testen. Falls Typography-Plugin nicht sauber theme-bar ist, Custom-Prose-Klassen schreiben statt `prose`-Override.

**Risiko 2:** IBM Plex Serif/Sans Variable-Fonts via `next/font/google` könnten Umlaut-Unicode-Range nicht im Default-Subset haben.
- Mitigation: Explizit `subsets: ['latin']` setzen, Latin-Subset deckt `Ä Ö Ü ä ö ü ß` ab. Build-Test mit Artikel-Title „Ärztliche Anordnung" als Smoke-Test.

**Risiko 3:** Component-Tests assertern Klassen-Namen, die sich ändern (`bg-blue-50`, `text-blue-700`).
- Mitigation: Tests gehen pro Komponente mit, nicht batchweise nachträglich. Assertions auf semantische Klassen-Substrings (z. B. `data-testid` einführen wo nötig).

**Risiko 4:** Favicon-Konvention `icon.svg` in Next.js 16 funktioniert nur, wenn keine zusätzlichen `favicon.ico` im Konflikt stehen.
- Mitigation: Prüfen, ob `src/app/favicon.ico` aus Payload-Bootstrap existiert. Wenn ja, löschen oder durch unsere SVG-Konvention ablösen.

**Risiko 5:** Die Marke „PflegeAtlas" ist nicht juristisch geprüft (DPMA-Recherche fehlt).
- Mitigation: V1.1 startet trotzdem mit dem Namen — das Risiko ist niedrig, weil das Repo nicht öffentlich ist und der Begriff in der existierenden Recherche bisher keine eingetragene Pflege-Marke trifft. Eine formale DPMA-Recherche gehört in den Pre-Launch-Plan, nicht in V1.1.

## 13. Spätere Ableitungen

Diese Themen ergeben sich aus V1.1, sind aber eigene Pläne:

- **„Suche-Header-Polish"-Bestandteil im Meilisearch-Plan** — prominentes Suchfeld in Header, Suche-Result-UI.
- **Dark Mode** — additive `@media`-Tokens, ggf. UI-Switch im Footer.
- **Repo-/Paket-/Domain-Rename-Sweep** — sobald Domain wirklich registriert ist und das öffentliche Repo aufgesetzt wird.
- **Asset-Konzept** — Foto-/Illustrationsrichtlinie, falls je Bilder dazukommen.

---

*Brainstorming-Session: 2026-06-05, zweite Session. Vorgänger-Spec: `docs/superpowers/specs/2026-06-04-pflegecommons-design.md`. Vorgänger-Plan: `docs/superpowers/plans/2026-06-05-pflegecommons-v1-core-foundation.md`. Vorgänger-Handoff: `docs/HANDOFF-2026-06-05-fixes.md`.*
