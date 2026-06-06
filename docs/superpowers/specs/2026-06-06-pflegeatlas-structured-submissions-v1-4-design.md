# PflegeAtlas V1.4 — Strukturierte Submissions (Design)

**Datum:** 2026-06-06
**Status:** Design-Spec (Brainstorming abgeschlossen, Plan steht aus)
**Vorgänger:** V1.3b Submission-Formular (PR #3, Merge-Commit `0f1abd5`)
**Branch (geplant):** `feat/v1-4-structured-submissions`

---

## 1. Kontext & Motivation

V1.3b liefert ein End-to-End-Submission-Formular mit Zod-Validation, Turnstile-Captcha, Server-Action, Mail-Notification und controlled-Inputs. Pipeline und UX-Pattern sind etabliert und werden in V1.4 unverändert wiederverwendet.

Olivers Praxistest hat aber einen strukturellen Bruch sichtbar gemacht: Das Formular sammelt nur `subject` (max 200) und ein einzelnes `body`-Feld (max 20.000) — Articles dagegen haben sieben inhaltliche Felder:

- `title` (text, required)
- `intent` (`bedside` | `background` | `learning`, required)
- `summary` (max 280, required)
- `definition` (RichText/Lexical, required)
- `praxis` (RichText/Lexical, required)
- `risiken` (RichText/Lexical, required)
- `quellen` (RichText/Lexical, required)

Konsequenz: Ein Vorschlag für einen neuen Artikel landet in V1.3b als unstrukturierter Block, und ein Korrekturvorschlag kann keine konkrete Sektion adressieren. Beides bremst den Editorial-Workflow.

V1.4 schließt diesen Gap: Submissions werden zur Article-Struktur passend strukturiert, und Korrekturen lassen sich pro Sektion gezielt einreichen.

## 2. Scope

**V1.4 enthält:**

- Umbau der `Submissions`-Collection auf typ-abhängige strukturierte Felder
- Neuer Artikel-Vorschlag (`new_article`): bis zu 7 strukturierte Felder, davon `intent` und `summary` optional
- Korrektur-Flow (`correction`): Article-Auswahl + Multi-Select-Sektionen + Lexical-Editor je gewählter Sektion mit vorgeladenem Article-Inhalt + optionales Reason-Feld
- Reduzierter Lexical-RichText-Editor für die 4 Inhalts-Sektionen (öffentliche Form-Variante mit minimaler Toolbar)
- Erweitertes Zod-Schema (discriminatedUnion) + Lexical-Sanitization + Dirty-Check
- Mail-Notification: strukturierte Plain-Text-Render der Submission-Inhalte
- Schema-Migration (Clean Cut — keine bestehenden Production-Submissions)
- Side-Quest: Per-Sektion-„Diese Sektion korrigieren"-Inline-Links in der Article-Page

**V1.4 enthält NICHT:**

- GitHub-PR-Workflow für Submissions (→ V1.5 als eigener Plan)
- HTML-Mail-Variante (→ V1.5 oder zusammen mit PR-Workflow)
- Admin-UI-Diff für Korrekturen (→ V1.5/V1.6 zusammen mit Editorial-Workflow)
- Lexical-Toolbar-Erweiterungen (Tables, Images, Quote, Headings) — YAGNI bis echte Submissions sie vermissen lassen
- Auth / Better-Auth / Editorial-Roles (→ V1.6+)
- Bestehende Submissions migrieren (Clean Cut, lokale Test-Daten werden truncated)

## 3. Architektur-Überblick

```
User-Form (/einreichen)
   │
   ├─ Type-Switch: new_article | correction
   │
   ├─ new_article-Pfad:
   │     • title (text, required)
   │     • intent (select, optional)
   │     • summary (textarea, max 280, optional)
   │     • definition, praxis, risiken, quellen (Lexical-RichText, required)
   │
   ├─ correction-Pfad:
   │     • article-Dropdown (required, onChange = router.push mit neuer URL)
   │     • 4× Section-Checkbox (mind. 1 required)
   │     • pro angewählter Sektion: Lexical-Editor mit vorgeladenem Original
   │     • optional: correctionReason (textarea, max 2000)
   │
   ├─ Gemeinsam: submitterName, submitterEmail (beide optional), Turnstile
   │
   ▼
Server Action (submitAction)
   │
   ├─ formData → raw object, selectedSections via formData.getAll(...)
   ├─ Zod-Parse (discriminatedUnion)
   ├─ Turnstile-Verify
   ├─ (bei correction) Article-Lookup mit allen 4 Sektionen
   ├─ (bei correction) Dirty-Check: editierter Lexical ≠ Original (nach Normalisierung)
   ├─ Lexical-Sanitize auf alle Lexical-Felder
   ├─ payload.create({collection: 'submissions', data: {...strukturierte Felder}})
   ├─ Mail-Notification (Lexical → Plain-Text-Render, Subject dynamisch)
   └─ redirect('/einreichen/danke')
```

**Wiederverwendet aus V1.3a/V1.3b (kein Re-Design):**

- Turnstile-Helper + Dev-Bypass (`src/lib/turnstile.ts`)
- ErrorSummary-Component (`src/components/ErrorSummary.tsx`)
- Server-Action-Pattern mit `useActionState` + controlled inputs + state.values-Sync
- Mail-Adapter (V1.3a, `src/lib/email-config.ts` + Resend)
- Danke-Page (`src/app/(frontend)/einreichen/danke/page.tsx`)
- Smart-Defaults via Query-Params (erweitert um `section`-Param)

**Neu in V1.4:**

- Reduzierter Lexical-Editor-Wrapper + 5-Button-Toolbar
- Article-Inhalt-Vorladen via Server-Component-Fetch
- Erweiterte Submissions-Collection (Schema-Migration)
- Lexical-Sanitization-Layer
- Lexical-Normalize-Helper für Dirty-Check
- Lexical-zu-Plain-Text-Walker für Mail-Render
- SectionCheckbox mit Hard-Constraint-Logik (Abwählen-Sperre + Verwerfen-Button)
- NewArticleFields- und CorrectionFields-Subkomponenten

## 4. Submissions-Collection-Schema

### 4.1 Felder, die bleiben

- `type` (`select`: `new_article` | `correction`, required)
- `relatedArticle` (`relationship` → articles, required wenn `type=correction`)
- `submitterName` (`text`, optional)
- `submitterEmail` (`email`, optional)
- `reviewStatus` (`select`: `pending` | `in_review` | `accepted` | `rejected`)
- `reviewerNotes` (`textarea`, intern)

### 4.2 Felder, die wegfallen (Clean Cut)

- `subject` (`text`) — ersetzt durch `proposedTitle` (`new_article`) bzw. dynamisch generierten `displayTitle` (`correction`)
- `body` (`textarea`) — ersetzt durch strukturierte Sektion-Felder

### 4.3 Neue Felder für `new_article`

- `proposedTitle` (`text`, required wenn `type=new_article`, min 3 / max 200)
- `proposedIntent` (`select`: `bedside` | `background` | `learning`, optional)
- `proposedSummary` (`textarea`, optional, max 280)
- `proposedDefinition` (`richText` / Lexical-JSON, required wenn `type=new_article`)
- `proposedPraxis` (`richText`, required)
- `proposedRisiken` (`richText`, required)
- `proposedQuellen` (`richText`, required)

### 4.4 Neue Felder für `correction`

- `editedDefinition` (`richText`, optional)
- `editedPraxis` (`richText`, optional)
- `editedRisiken` (`richText`, optional)
- `editedQuellen` (`richText`, optional)
- `correctionReason` (`textarea`, optional, max 2000)

Eine Sektion gilt genau dann als „eingereicht für Korrektur", wenn das entsprechende `edited<Section>`-Feld nicht null und **nicht identisch zum Original-Article-Inhalt** ist (Vergleich nach Normalisierung). Wenn alle 4 leer/identisch → Validation-Error.

### 4.5 Admin-UX

- `useAsTitle: 'displayTitle'` (virtuelles Feld, gesetzt per `beforeChange`-Hook):
  - bei `new_article`: `displayTitle = proposedTitle`
  - bei `correction`: `displayTitle = "Korrektur: " + relatedArticle.title`
- `defaultColumns: ['displayTitle', 'type', 'reviewStatus', 'createdAt']`
- `admin.condition`: `proposed*`-Felder nur bei `type=new_article`, `edited*` + `correctionReason` + `relatedArticle` nur bei `type=correction`. Hält den Edit-Screen aufgeräumt.

## 5. Form-UI & Components

### 5.1 Neue Komponenten

**`SubmissionForm.tsx`** (Top-Level, erweitert)
- type-switch zwischen `NewArticleFields` und `CorrectionFields`
- Behält V1.3b-Pattern: `useActionState`, controlled inputs, state.values-Sync, ErrorSummary, Turnstile, Submit-Button mit `useFormStatus`
- Erweitert um Lexical-State (Lexical-JSON-Strings) für 5–7 Editoren

**`NewArticleFields.tsx`** (neu)
- 7 Inputs für `new_article`:
  - title (text input, V1.3b-Style mit Live-Counter X/200)
  - intent (select mit „— offen, von Redaktion zu setzen —" als Default-Option)
  - summary (textarea, max 280, Live-Counter X/280, min-Hint unter 0)
  - 4× `<LexicalEditor>` für definition/praxis/risiken/quellen mit Section-Headings darüber

**`CorrectionFields.tsx`** (neu)
- Article-Dropdown (V1.3b-Style, `onChange` triggert `router.push` mit neuer URL)
- 4× `<SectionCheckbox>` (Checkbox + bedingt darunter `<LexicalEditor>` mit vorgeladenem Inhalt)
- `correctionReason` (textarea, optional, max 2000)

**`LexicalEditor.tsx`** (neu)
- Wrapper um `@lexical/react`
- Reduzierte Toolbar (5 Buttons): **Bold, Italic, Bullet-List, Numbered-List, Link**
- Output: Lexical-JSON-String (für controlled-Pattern)
- Props: `value`, `onChange`, `placeholder`, optional `originalValue` (für Dirty-Check)
- Lazy-Loaded via `dynamic(() => import('@/components/LexicalEditor'), { ssr: false })`
- Bewusst NICHT in Toolbar: Heading-3, Quote, Code, Tables, Images, Underline (siehe Sektion 2 „enthält NICHT")

**`SectionCheckbox.tsx`** (neu)
- Checkbox (`<input type="checkbox" name="selectedSections" value="<sectionKey>">`) + darunter conditional `<LexicalEditor>`
- Multi-Value-Pattern: alle 4 Checkboxes haben denselben `name="selectedSections"`, Server-Action liest via `formData.getAll('selectedSections')` → `string[]`
- Hard-Constraint-Logik:
  - dirty = `normalizeLexical(current) !== normalizeLexical(original)` (siehe Sektion 6.3)
  - Wenn Checkbox aktiv und dirty:
    - Abwählen-Click wird im `onChange` mit `preventDefault` abgefangen
    - Inline-Warnung erscheint: „Diese Sektion enthält Änderungen. Klicke ‚Verwerfen', um die Sektion zu entfernen."
    - „Verwerfen"-Button erscheint (sichtbar nur wenn dirty)
  - Wenn Checkbox aktiv und nicht dirty: Abwählen funktioniert sofort, Editor wird versteckt
- „Verwerfen"-Click: leert Editor (`null`-Lexical-State) + wählt Checkbox ab + entfernt Warnung in einem Schritt

**Wiederverwendet:**
- `ErrorSummary.tsx` (V1.3b)
- `SectionLabel.tsx` (V1.2)

### 5.2 State-Sync

`SubmitState['values']` erweitert um:

```ts
{
  type, submitterName, submitterEmail, relatedArticleSlug, // V1.3b
  proposedTitle, proposedIntent, proposedSummary,
  proposedDefinition, proposedPraxis, proposedRisiken, proposedQuellen,
  editedDefinition, editedPraxis, editedRisiken, editedQuellen,
  selectedSections,  // string[] der angehakten Sektionen
  correctionReason,
}
```

Lexical-JSON-Werte werden als serialisierte Strings übertragen (FormData-Limitation). `JSON.stringify`/`JSON.parse` an den Rändern, intern Lexical-Object-Form.

### 5.3 Smart-Defaults via Query-Params

| Param | Werte | Wirkung |
|---|---|---|
| `type` | `new_article` \| `correction` | Initialer Pfad |
| `article` | Article-Slug | Nur bei `correction`: Dropdown vorbelegen + Sektion-Inhalte vorladen |
| `section` | `definition` \| `praxis` \| `risiken` \| `quellen` | Nur bei `correction`: eine Sektion-Checkbox initial aktiv + Editor vorgeladen |

Ungültige Werte → Parameter ignoriert, kein Error (defensiv). Multi-Section per URL ist bewusst nicht supported (YAGNI — User klickt im Form selbst weitere Checkboxes an).

### 5.4 Article-Wechsel im Dropdown

`onChange` triggert `router.push('/einreichen?type=correction&article=<newSlug>')`. Server-Component re-rendert mit neuen Article-Sektionen. State geht verloren beim Wechsel — bewusst, weil Article-Wechsel ein neuer Kontext ist. Kein `beforeunload`-Handler (Anti-Pattern in SPAs).

### 5.5 Bundle-Strategie

Lexical wiegt ca. **50–80 KB gzipped** (Core + benötigte Nodes). Wird via `dynamic({ ssr: false })` lazy geladen — nur die `/einreichen`-Route ist betroffen, kein Hot-Path für Casual-Reader.

## 6. Server-Flow

### 6.1 Zod-Schema (`src/lib/submission-schema.ts` erweitert)

Discriminierte Union auf `type` für typsichere Pfade:

```ts
const LexicalJsonString = z.string().min(1).refine(isParseableLexicalJson, 'Ungültiges Lexical-JSON.')
const Section = z.enum(['definition', 'praxis', 'risiken', 'quellen'])

const NewArticleSchema = z.object({
  type: z.literal('new_article'),
  proposedTitle: z.string().trim().min(3).max(200),
  proposedIntent: z.enum(['bedside', 'background', 'learning']).optional(),
  proposedSummary: z.string().trim().max(280).optional().or(z.literal('')),
  proposedDefinition: LexicalJsonString,
  proposedPraxis: LexicalJsonString,
  proposedRisiken: LexicalJsonString,
  proposedQuellen: LexicalJsonString,
  // gemeinsame Felder: submitterName, submitterEmail, turnstileToken
})

const CorrectionSchema = z.object({
  type: z.literal('correction'),
  relatedArticleSlug: z.string().min(1),
  selectedSections: z.array(Section).min(1, 'Mindestens eine Sektion auswählen.'),
  editedDefinition: LexicalJsonString.optional(),
  editedPraxis: LexicalJsonString.optional(),
  editedRisiken: LexicalJsonString.optional(),
  editedQuellen: LexicalJsonString.optional(),
  correctionReason: z.string().trim().max(2000).optional(),
  // gemeinsame Felder: submitterName, submitterEmail, turnstileToken
}).refine(
  (data) => data.selectedSections.every(s => data[`edited${capitalize(s)}` as keyof typeof data]),
  { message: 'Editor-Inhalt fehlt für ausgewählte Sektion.' }
)

export const SubmissionSchema = z.discriminatedUnion('type', [NewArticleSchema, CorrectionSchema])
```

`flattenZodErrors` aus V1.3b bleibt unverändert (first-wins per path).

### 6.2 Lexical-Sanitization (`src/lib/lexical-sanitize.ts`, neu)

Manuell zusammengebaute Requests können beliebige Lexical-Nodes enthalten — Server-Side whitelisten:

```ts
const ALLOWED_TYPES = new Set([
  'root', 'paragraph', 'text', 'list', 'listitem', 'link', 'linebreak'
])

function sanitizeLexicalNode(node: any): any | null {
  if (!node || !ALLOWED_TYPES.has(node.type)) return null
  if (node.type === 'text') {
    // Lexical-Format-Bitmask: nur Bold (1) + Italic (2) erlauben
    node.format = (node.format ?? 0) & 0b11
  }
  if (node.type === 'link') {
    const url = node.url ?? ''
    if (!/^(https?:|mailto:|#)/i.test(url)) return null
    if (url.length > 2000) return null
  }
  if (Array.isArray(node.children)) {
    node.children = node.children.map(sanitizeLexicalNode).filter(Boolean)
  }
  return node
}
```

Wird auf jeden Lexical-JSON-Wert in der Server-Action angewendet **bevor** `payload.create`. Whitelist wird während Implementation gegen Lexical-Internals (z.B. `tab`-Node) iterativ getuned.

### 6.3 Lexical-Normalize (`src/lib/lexical-normalize.ts`, neu)

Für serverseitigen Dirty-Check. Interne Lexical-State-Felder strippen, dann JSON-Compare:

```ts
function normalizeLexical(node: any): any {
  if (!node) return null
  const { version, key, __key, __type, ...rest } = node
  if (rest.children) rest.children = rest.children.map(normalizeLexical)
  return rest
}

export function isLexicalDirty(edited: any, original: any): boolean {
  return JSON.stringify(normalizeLexical(edited)) !== JSON.stringify(normalizeLexical(original))
}
```

Children-Reihenfolge wird **nicht** sortiert — Reihenfolge ist semantisch.

### 6.4 Server-Action-Flow (`src/app/(frontend)/einreichen/actions.ts` erweitert)

```
1. raw = Object.fromEntries(formData.entries())
   selectedSections = formData.getAll('selectedSections')  // Multi-Value-Pattern
   ↓
2. Zod-Parse (discriminatedUnion)
   → fieldErrors bei Fehler, mit values zur Form-Preservation
   ↓
3. Turnstile-Verify
   → state.error bei Fehler
   ↓
4. (nur correction) Article-Lookup per slug, mit allen 4 Sektionen
   → fieldErrors{relatedArticleSlug: 'Artikel nicht gefunden.'} wenn weg
   ↓
5. (nur correction) Dirty-Check pro selectedSection:
   für jede selectedSection: isLexicalDirty(edited, articleOriginal)
   → fieldErrors{editedDefinition / editedPraxis / editedRisiken / editedQuellen: 'Keine Änderungen — bitte editieren oder Sektion abwählen.'}
   ↓
6. Lexical-Sanitize auf alle eingereichten Lexical-Felder
   ↓
7. payload.create({ collection: 'submissions', data: {...} })
   ↓
8. Mail bauen (siehe Sektion 7), payload.sendEmail (non-fatal — Fehler werden geloggt aber nicht zurückgegeben)
   ↓
9. redirect('/einreichen/danke')
```

## 7. Mail-Notification

### 7.1 Subject (dynamisch)

- `new_article`: `[PflegeAtlas] Neuer Artikel-Vorschlag: "<proposedTitle>"`
- `correction`: `[PflegeAtlas] Korrektur: "<Article-Title>"`

### 7.2 Body bei `new_article`

```
Neuer Artikel-Vorschlag

Titel: <proposedTitle>
Intent: <proposedIntent oder „— offen, von Redaktion zu setzen —">
Summary: <proposedSummary oder „— offen —">

--- Definition ---
<Lexical → Plain-Text>

--- Praxis ---
<Lexical → Plain-Text>

--- Risiken ---
<Lexical → Plain-Text>

--- Quellen ---
<Lexical → Plain-Text>

—
Eingereicht von: <submitterName oder „anonym"> <<submitterEmail oder „—">>
Submission-ID: <id>
Admin-Link: <PAYLOAD_URL>/admin/collections/submissions/<id>
```

### 7.3 Body bei `correction`

```
Korrekturvorschlag

Artikel: <Article-Title>
Article-Admin-Link: <PAYLOAD_URL>/admin/collections/articles/<articleId>
Sektionen mit Änderungen: <selectedSections, kommasepariert>

Begründung:
<correctionReason oder „— keine —">

--- Praxis (neuer Stand) ---
<Lexical → Plain-Text>

--- Risiken (neuer Stand) ---
<Lexical → Plain-Text>

(nur Sektionen mit Änderungen werden gerendert)

—
Eingereicht von: <submitterName oder „anonym"> <<submitterEmail oder „—">>
Submission-ID: <id>
Admin-Link: <PAYLOAD_URL>/admin/collections/submissions/<id>
```

### 7.4 Lexical-zu-Plain-Text-Walker (`src/lib/lexical-to-plain-text.ts`, neu)

Rekursiver Walker über Lexical-JSON:

- paragraph → text-Nodes konkatenieren + `\n\n` zwischen paragraphs
- text → raw text (Bold/Italic-Markup verworfen in Plain-Text)
- list (bullet) → `- <text>\n` pro listitem
- list (numbered) → `1. <text>\n`, `2. ...`
- link → `<linktext> (<url>)`
- linebreak → `\n`

Format: Plain-Text-only in V1.4. HTML-Render → V1.5.

## 8. Tests

TDD-Strategie wie V1.3a/V1.3b: rot-grün-refactor pro Task, ein Subagent pro Plan-Task.

### 8.1 Unit-Tests (`tests/unit/`)

**`submission-schema.test.ts`** (erweitert)
- discriminatedUnion akzeptiert `new_article` mit allen Pflichtfeldern
- `new_article` lehnt fehlende Lexical-Sektion ab (4 Tests, je 1 Sektion fehlt)
- `new_article` akzeptiert leeres `proposedIntent` / `proposedSummary`
- `new_article` lehnt title < 3 oder summary > 280 ab
- `correction` akzeptiert min 1 selectedSection + edited-Inhalt
- `correction` lehnt leere selectedSections ab
- `correction` lehnt selectedSection ohne korrespondierenden edited-Inhalt ab
- `correction` lehnt fehlenden `relatedArticleSlug` ab
- `correctionReason` ist optional, max 2000

**`lexical-sanitize.test.ts`** (neu)
- whitelist-Types durchgereicht (paragraph, text, list, listitem, link, linebreak)
- non-whitelist-Type entfernt (z.B. `image`-Node strippen)
- `text.format`-Bitmask reduziert auf bold+italic (höhere Flags = 0)
- Link mit `https://`, `http://`, `mailto:`, `#fragment` akzeptiert
- Link mit `javascript:`, `data:`, `file:` → Node entfernt
- Link mit URL > 2000 Zeichen → Node entfernt
- Rekursiv durch verschachtelte Children

**`lexical-normalize.test.ts`** (neu)
- identisches Lexical-JSON → normalized identisch
- differente Text-Inhalte → unterschiedlich
- nur `version`/`key`-Drift → normalized identisch
- Children-Reihenfolge wird nicht sortiert

**`lexical-to-plain-text.test.ts`** (neu)
- paragraph mit Text → `"text"`
- mehrere paragraphs → `"a\n\nb"`
- bullet list → `"- a\n- b"`
- numbered list → `"1. a\n2. b"`
- link → `"Linktext (URL)"`
- gemischte Strukturen rekursiv

**`submission-mail.test.ts`** (erweitert)
- Subject `new_article` enthält proposedTitle
- Subject `correction` enthält Article-Titel
- Body `new_article` enthält alle 4 Sektionen mit Plain-Text-Render
- Body `correction` enthält nur selectedSections (nicht-gewählte fehlen)
- Body enthält Admin-Link
- Body enthält submitterEmail wenn vorhanden, sonst „—"

**`turnstile.test.ts`** (unverändert aus V1.3b)

### 8.2 Integration-Test (`tests/integration/`)

**`submission-action.test.ts`** (erweitert, mit echten Payload-In-Memory-Fixtures)
- happy path `new_article`: Submission wird erstellt, Mail gesendet, redirect zu /danke
- happy path `correction` mit 1 Sektion
- happy path `correction` mit 3 Sektionen
- `correction` mit selectedSection aber unveränderter Lexical → fieldError pro Sektion
- `correction` mit ungültigem Article-Slug → fieldError relatedArticleSlug
- Turnstile-Fail → state.error
- Form-Preserve: state.values bei fieldError enthält alle eingereichten Felder
- Sanitization-Pfad: Submission mit `<image>`-Node → gestripped vor Persist

### 8.3 Component-Tests (`tests/component/`)

**Lexical-Mock-Strategie:** `vi.mock('@/components/LexicalEditor')` liefert simple `<textarea>`-Stub mit `value`/`onChange`. Damit testen wir Form-Logik, nicht Lexical-Internals. Echte Lexical-Init wird im Browser-Review verifiziert.

**`SubmissionForm.test.tsx`** (erweitert)
- type=`new_article` zeigt NewArticleFields, nicht CorrectionFields
- type=`correction` zeigt CorrectionFields, nicht NewArticleFields
- Type-Switch erhält Submitter-Felder (Name, Email)
- ErrorSummary erscheint bei state.fieldErrors
- Submit-Button disabled während pending

**`NewArticleFields.test.tsx`** (neu)
- alle 7 Inputs gerendert
- intent-Select hat 3 Optionen + Default „— offen —"
- summary-Counter zeigt X/280

**`CorrectionFields.test.tsx`** (neu)
- Article-Dropdown gerendert
- 4 SectionCheckboxes gerendert
- correctionReason-Textarea gerendert
- onChange auf Article-Dropdown triggert router.push (mock `next/navigation`)

**`SectionCheckbox.test.tsx`** (neu, Hard-Constraint-Kern)
- Checkbox initial unchecked → Editor versteckt
- Click → Checkbox checked, Editor sichtbar mit vorgeladenem Original
- Editor-Edit → SectionCheckbox kennt dirty=true
- Abwählen-Click bei dirty=true → abgewiesen, Inline-Warnung erscheint
- „Verwerfen"-Button erscheint bei dirty=true
- „Verwerfen"-Click → Editor leer, Checkbox unchecked, Warnung weg
- Abwählen-Click bei dirty=false → funktioniert sofort

**`LexicalEditor.test.tsx`** (neu, Smoke)
- Editor mounted ohne crash
- Toolbar zeigt 5 Buttons (Bold, Italic, Bullet, Numbered, Link)
- Initial-Value (Lexical-JSON) wird gerendert
- onChange propagiert Lexical-JSON-Stringify-Output

### 8.4 Wiederverwendet ohne Anpassung

- `email-config.test.ts`, `send-test-mail.test.ts` (V1.3a)
- `turnstile.test.ts` (V1.3b)

### 8.5 Erwartete Test-Zahlen

V1.3b: 70 Tests grün. V1.4 fügt geschätzt **30–40 neue Tests** hinzu, plus Anpassungen an 3 bestehenden Files. Gesamt ca. **100–110 Tests**.

Lint-Disziplin: 0 Errors halten, Warnings dürfen je Task einzelne neue dazukommen falls plan-prescribed (V1.3b-Pattern).

## 9. Migration, Dependencies, Rollout

### 9.1 Neue Dependencies

```
lexical                # Core (~30 KB gzipped)
@lexical/react         # React-Bindings (Composer, RichTextPlugin)
@lexical/list          # Bullet/Numbered-List-Nodes
@lexical/link          # Link-Plugin
@lexical/utils         # ggf. für Toolbar-Helpers
```

Payload nutzt intern `@payloadcms/richtext-lexical` (eigenes Bundle). Wir importieren bewusst die direkten `@lexical/*`-Pakete für den Public-Form-Editor, um Toolbar/Bundle zu kontrollieren. Ungefähr **+50–80 KB gzipped** auf der `/einreichen`-Route (lazy-loaded via `dynamic({ ssr: false })`). Andere Routes nicht betroffen.

```bash
pnpm add lexical @lexical/react @lexical/list @lexical/link @lexical/utils
```

### 9.2 Schema-Migration

```bash
pnpm payload migrate:create v1-4-structured-submissions
```

Migration-File:
- `ALTER TABLE submissions DROP COLUMN subject`
- `ALTER TABLE submissions DROP COLUMN body`
- `ALTER TABLE submissions ADD COLUMN proposed_title text`
- `ALTER TABLE submissions ADD COLUMN proposed_intent text`
- `ALTER TABLE submissions ADD COLUMN proposed_summary text`
- 4× `ALTER TABLE submissions ADD COLUMN proposed_<section> jsonb`
- 4× `ALTER TABLE submissions ADD COLUMN edited_<section> jsonb`
- `ALTER TABLE submissions ADD COLUMN correction_reason text`
- `ALTER TABLE submissions ADD COLUMN display_title text`

**V1.2-Lesson:** Migration muss self-contained gegen leere DB laufen. Keine Annahmen über bestehende Daten, keine Backfills. Lokale Test-Daten werden vor Migration weggetruncated:

```bash
docker compose exec postgres psql -U pflege -d pflege -c "TRUNCATE submissions;"
pnpm payload migrate
```

Pflicht-Check: `pnpm test` + `pnpm build` müssen nach Migration grün sein.

### 9.3 Branch-Strategie / Rollout

Identisch zu V1.3a/V1.3b:

1. Feature-Branch `feat/v1-4-structured-submissions` von `main`
2. Spec (dieser Doc) + Plan auf Branch pushen
3. Implementation per Subagent-Driven-Workflow, Task-für-Task aus Plan
4. PR auf `main` (Branch-Ruleset erzwingt PR + grüne CI)
5. `--no-ff`-Merge wie V1.1/V1.3a/V1.3b

### 9.4 Article-Footer-Per-Section-Links (V1.4-Side-Quest)

`src/app/(frontend)/artikel/[slug]/page.tsx` bekommt nach jeder der 4 Sektionen einen dezenten Inline-Link „Diese Sektion ergänzen oder korrigieren →" mit URL `/einreichen?type=correction&article=<slug>&section=<key>`.

Pattern: kleine Link-Komponente, identische Styles wie der bestehende Footer-„Diese Seite korrigieren"-Link, aber per Sektion.

Tests: Article-Page-Snapshot oder targeted Query — vier Section-Edit-Links müssen pro Article gerendert sein, mit korrekten `href`-Werten und `section`-Query-Params.

## 10. Risiken & Mitigations

| Risiko | Wahrscheinlichkeit | Mitigation |
|---|---|---|
| Lexical-Bundle bricht SSR (jsdom-Test-Pfad) | mittel | `vi.mock` im Component-Test, `dynamic({ ssr: false })` in Production |
| Lexical-Init-Format-Drift zwischen Payload-Admin und Public-Editor | mittel | Sanitize-Layer akzeptiert beide; bei Article-Vorladen explizit normalisieren, bevor in Editor |
| `selectedSections`-Multi-Checkbox-FormData verhält sich beim Subagent-Mock anders als im Browser | niedrig | `formData.getAll(...)`-Pattern in Integration-Tests explizit prüfen |
| Article-Wechsel im Dropdown verliert User-Eingaben ohne Warnung | niedrig | bewusst akzeptiert — Article-Wechsel = neuer Kontext, keine `beforeunload`-Hooks |
| Zod-discriminatedUnion macht `flattenZodErrors` doppelt-pfad-fehleranfällig | niedrig | Test-Cases je Pfad explizit (V1.3b first-wins-Pattern bleibt gültig) |
| Sanitize-Whitelist zu eng → User-Inhalt verloren | niedrig | bei Implementation Lexical-Internals durchgehen (z.B. `tab`-Node), Whitelist iterativ erweitern |
| Pflege-Praktiker:innen verstehen Lexical-Toolbar nicht | mittel | 5-Button-Toolbar minimal, Placeholder-Texte erklären die Sektionen, FieldHint unter jedem Editor mit Beispiel |

## 11. Lessons aus V1.3a/V1.3b explizit beachten

1. **Plan-Reihenfolge:** Editor-Komponente vor Form bauen (Form importiert Editor). Action vor Form (Form importiert Action-Type). Vermeidet V1.3b-Task-6/7-Swap-Situation.
2. **Existing-File-Handling im Plan:** `.env.example`, `README` — explizit appenden, nicht überschreiben (V1.3a-Lesson).
3. **Vitest-TDZ-Mocks:** `vi.hoisted(...)` für `vi.mock`-Targets (V1.3b-Lesson).
4. **Sicherheits-Lesson:** Niemals Env-Var-Werte ungefiltert printen — bei jedem Dev-Server-Log oder ENV-Check filtern (`sed 's/=.*$/=***/'`).
5. **React 19 form.reset() Race:** controlled inputs durchgängig, render-time setState-Sync (NICHT useEffect — Lint-Error). Gilt 1:1 für Lexical-Editor-Wrapper.

## 12. Offene Punkte für den Plan-Schritt

Die folgenden Punkte sind im Plan zu detaillieren, nicht hier:

- Genaue Task-Reihenfolge (Editor vor Form, Action-Types vor Form, Schema-Migration vor Action)
- Pre-Task ggf. für `pnpm add` der Lexical-Pakete (kann auch Task 1 sein)
- Subagent-Briefings pro Task: Spec-Pointer + Test-First-Reminder + Lesson-Pointer
- Browser-Review-Checkpoint nach Form-Komplett-Task (analog V1.3b)
- PR-Body-Template mit erwarteten bewussten Plan-Deviations
- Migration-Step im README / CONTRIBUTING dokumentieren
