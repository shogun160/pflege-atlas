# PflegeAtlas — Submission-Formular V1.3b (Design-Spec)

**Status:** Entwurf nach Brainstorming-Session am 2026-06-05 · Folgt auf V1.3a Mail-Infrastruktur (gemerged auf `main` als `27e160f`).

## 1. Zweck und Scope

V1.3b ersetzt den `/einreichen`-Stub (zwei Erklär-Karten + Mailto) durch ein echtes Submission-Formular, das gegen die seit V1 existierende `Submissions`-Collection schreibt und die Redaktion via Mail benachrichtigt. Damit wird der Mitmach-Flow, der seit V1.1 visuell präsent ist, tatsächlich funktional. Voraussetzung Mail-Infrastruktur ist seit V1.3a produktiv.

V1.3b liefert:

- Öffentliches, unauthenticated Formular unter `/einreichen` mit Cloudflare Turnstile als Spam-Schutz
- Smart-Defaults via Query-Params (`?type=correction&article=<slug>`) für Kontext-Sprünge aus Artikel-Seiten
- Zod-Schema als Single Source of Truth für Validation
- Form-Fehler-UX nach gov.uk-Pattern: Error-Summary oben + Inline-Errors pro Feld
- React Server Action mit `useActionState`, PRG-Redirect auf `/einreichen/danke` bei Erfolg
- Submission-Notification per Mail an `redaktion@pflegeatlas.org` über den V1.3a-Adapter
- Dank-Seite mit „Was passiert jetzt?"-Hinweis, Lizenz-Reminder und Link zurück
- Unit-, Component- und Integrations-Tests für alle neuen Module

V1.3b ist **nicht**:

- Keine Submitter-Bestätigungs-Mail („Danke, deine Submission ist eingegangen") — bewusst weggelassen, kann als optionale Erweiterung kommen
- Keine Auth, kein Login, kein Editorial-Review-Queue-Workflow im Admin — Auth-Plan ist eigenständig
- Keine Live-Autocomplete-Suche für `relatedArticle` — V1.3b nutzt ein einfaches `<select>` mit Top-N Articles oder Slug-Direkteintrag; Volltext-Live-Search kommt mit dem Meilisearch-Plan
- Keine Mehrsprachigkeit der Form
- Keine Server-side Idempotency-Key gegen Doppel-Submit — V1.3b nutzt nur Client-Disable via `useFormStatus`; Server-Idempotency kommt nur wenn Doppel-Submit-Volumen real wird
- Kein Honeypot-Feld als no-JS-Fallback — Form ist JS-Pflicht, `<noscript>`-Block bietet `mailto:mitmachen@…` als Alternative
- Kein Rate-Limit per IP — Turnstile + niedriges Volumen reichen vorerst

## 2. Architektur-Übersicht

Drei Schichten, klar getrennt:

**Client (`SubmissionForm.tsx`):** rendert Form, hält `useActionState`, zeigt Inline-Errors + Summary, integriert Turnstile-Widget, disabled Submit während pending. Liest initial state aus den Page-Props (die aus den Server-side `searchParams` kommen).

**Server Action (`actions.ts` in der Page-Route):** läuft serverseitig bei Form-Submit. Pipeline:

```
formData
  → Zod safeParse → bei Fail: return { fieldErrors }
  → verifyTurnstileToken(token) → bei Fail: return { error: 'Captcha…' }
  → payload.create({ collection: 'submissions', data })
  → payload.sendEmail({ to: 'redaktion@…', from: 'noreply@…', ... })
  → redirect('/einreichen/danke')
```

Bei Server-internen Errors (DB nicht erreichbar etc.) wird ein generisches `{ error }` zurückgegeben, der Fehler im Server-Log geloggt, kein Stacktrace zum Client.

**Daten-Layer (Payload + Mail):** unverändert seit V1 (Submissions-Collection mit `create: () => true` für public submit) bzw. V1.3a (Mail-Adapter).

## 3. Felder und Schema

Zod-Schema in `src/lib/submission-schema.ts` als Single Source of Truth. Spiegel zur Submissions-Collection, aber sticht nur die Submitter-Felder ein, nicht die Review-Felder (`reviewStatus`, `reviewerNotes`).

```typescript
const SubmissionSchema = z.object({
  type: z.enum(['new_article', 'correction']),
  subject: z.string().trim().min(3, 'Bitte mindestens 3 Zeichen.').max(200),
  relatedArticleSlug: z.string().trim().optional(),
  body: z.string().trim().min(20, 'Bitte mindestens 20 Zeichen.').max(20000),
  submitterName: z.string().trim().max(100).optional(),
  submitterEmail: z.string().trim().email('Keine gültige E-Mail-Adresse.').optional().or(z.literal('')),
  turnstileToken: z.string().min(1, 'Captcha-Token fehlt.'),
}).refine(
  (data) => data.type !== 'correction' || (data.relatedArticleSlug && data.relatedArticleSlug.length > 0),
  { path: ['relatedArticleSlug'], message: 'Bei Korrektur ist der bezogene Artikel Pflicht.' },
);
```

Die Refine-Regel deckt die Cross-Field-Validation ab: bei `type=correction` muss `relatedArticleSlug` gesetzt sein.

Der Server löst nach der Validation den Slug zu einer `Article`-ID auf (via Payload-Query) und übergibt die ID an `payload.create()`. Wenn der Slug nicht existiert, returnt die Action `{ fieldErrors: { relatedArticleSlug: 'Artikel nicht gefunden.' } }`.

## 4. Form-Komponente (`SubmissionForm.tsx`)

Client Component (`'use client'`). Props:

```typescript
type Props = {
  initialType?: 'new_article' | 'correction';
  initialArticleSlug?: string;
  articles: { slug: string; title: string }[]; // Top-N für Select
  turnstileSiteKey: string;
};
```

Aufbau (vereinfacht):

```tsx
const [state, formAction, isPending] = useActionState(submitAction, initialState);

<form action={formAction} noValidate>
  {state.error && <ErrorBanner message={state.error} />}
  {state.fieldErrors && <ErrorSummary errors={state.fieldErrors} />}

  <label> Art *
    <select name="type" defaultValue={initialType}>
      <option value="new_article">Neuer Artikel-Vorschlag</option>
      <option value="correction">Korrektur</option>
    </select>
    <FieldError name="type" errors={state.fieldErrors} />
  </label>

  {/* relatedArticleSlug, subject, body, submitterName, submitterEmail */}

  <Turnstile siteKey={turnstileSiteKey} />
  <SubmitButton />  {/* useFormStatus → disabled+spinner während pending */}
</form>
```

`ErrorSummary` setzt beim Mount nach einem Validation-Fail `focus()` auf sich selbst (a11y), zeigt Liste mit Anker-Links `<a href="#field-subject">Betreff fehlt</a>`. Jedes Feld hat `id` matching dem Anchor.

`<noscript>` außerhalb der Form: `<p>JavaScript ist für das Formular erforderlich. Du kannst stattdessen direkt an <a href="mailto:mitmachen@pflegeatlas.org">mitmachen@pflegeatlas.org</a> mailen.</p>`

Native HTML5-Attribute (`required`, `type="email"`, `minLength`) auf den Inputs für sofortiges Browser-Feedback bevor's an Server geht. Server-Validation ist die maßgebliche.

## 5. Server Action (`actions.ts`)

```typescript
'use server';

export async function submitAction(prevState, formData): Promise<SubmitState> {
  // 1. Schema-Validation
  const parsed = SubmissionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: flattenZodErrors(parsed.error) };
  }

  // 2. Turnstile
  const verified = await verifyTurnstileToken(parsed.data.turnstileToken);
  if (!verified) {
    return { error: 'Captcha-Verifikation fehlgeschlagen. Bitte erneut versuchen.' };
  }

  // 3. relatedArticleSlug → ID auflösen (nur bei correction)
  let relatedArticleId;
  if (parsed.data.type === 'correction' && parsed.data.relatedArticleSlug) {
    const article = await findArticleBySlug(parsed.data.relatedArticleSlug);
    if (!article) {
      return { fieldErrors: { relatedArticleSlug: 'Artikel nicht gefunden.' } };
    }
    relatedArticleId = article.id;
  }

  // 4. Submission anlegen
  try {
    const submission = await payload.create({
      collection: 'submissions',
      data: {
        type: parsed.data.type,
        subject: parsed.data.subject,
        body: parsed.data.body,
        relatedArticle: relatedArticleId,
        submitterName: parsed.data.submitterName || undefined,
        submitterEmail: parsed.data.submitterEmail || undefined,
        reviewStatus: 'pending',
      },
    });

    // 5. Mail
    await payload.sendEmail(buildSubmissionMail({ submission, articleTitle: article?.title }));
  } catch (err) {
    console.error('Submission failed', err);
    return { error: 'Es gab ein Problem beim Senden. Bitte später erneut versuchen.' };
  }

  // 6. Redirect (PRG)
  redirect('/einreichen/danke');
}
```

Mail-Send-Fehler **bouncen nicht den Submit** — Submission ist gespeichert, Mail-Send wird im Server-Log markiert, Redaktion sieht sie im Admin auch ohne Notification. Optional kann ein einfacher Retry im Hintergrund (`waitUntil`) später ergänzt werden.

## 6. Turnstile-Integration

**Client:** `@marsidev/react-turnstile` (~1 KB, offizielle React-Wrapper). Widget rendert sich auf `<Turnstile siteKey={...} />`, schreibt den Token in ein hidden field das mit `name="turnstileToken"` ausgelesen wird.

**Server:** `src/lib/turnstile.ts` mit einer Funktion `verifyTurnstileToken(token: string): Promise<boolean>`. Ruft `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` mit `secret=process.env.TURNSTILE_SECRET_KEY` und `response=token`. Liefert `true` wenn Antwort `success: true`.

**ENV-Vars:** `TURNSTILE_SITE_KEY` (öffentlich, in den `<Turnstile>`-Component) und `TURNSTILE_SECRET_KEY` (server-only, für siteverify). Beide in `.env.example` aufnehmen mit leeren Defaults.

**Dev-Mode:** wenn `TURNSTILE_SECRET_KEY` nicht gesetzt → `verifyTurnstileToken` returnt **immer true** und loggt eine Warning. So funktioniert die Form lokal ohne Cloudflare-Account. In CI ist der Key ebenfalls nicht gesetzt, also läuft mit demselben Bypass.

**Production-Setup:** Im Cloudflare-Dashboard → Turnstile → Site erstellen, Site-Key und Secret-Key kopieren, in den ENV-Vars des Hosting-Providers eintragen. Site-Key kann unbedenklich ins Frontend, Secret bleibt server-only.

## 7. Mail-Template

`src/lib/submission-mail.ts` exportiert `buildSubmissionMail({ submission, articleTitle? })` und liefert `{ to, from, subject, html, text }`. Plain HTML mit Inline-Styles (kein React Email als Dependency).

Subject: `[PflegeAtlas] Neue Submission: <subject>`

HTML-Body (Auszug):

```html
<h2>Neue Submission auf PflegeAtlas</h2>
<dl>
  <dt>Eingegangen am</dt><dd><ISO-Datum></dd>
  <dt>Typ</dt><dd><Neuer Artikel-Vorschlag | Korrektur></dd>
  <dt>Betreff</dt><dd><subject></dd>
  <dt>Bezogen auf</dt><dd><articleTitle | „—"></dd>
  <dt>Eingereicht von</dt><dd><name | „anonym"> (<email | „keine Mailadresse">)</dd>
</dl>
<h3>Inhalt</h3>
<p style="white-space: pre-wrap;"><body></p>
<hr>
<p><a href="https://pflegeatlas.org/admin/collections/submissions/<id>">Im Admin öffnen</a></p>
```

Plaintext-Variante parallel für Mail-Clients ohne HTML.

`to: 'redaktion@pflegeatlas.org'` (Cloudflare Worker forwarded an Oliver + Christoph). `from` kommt vom Resend-Adapter default (`noreply@pflegeatlas.org`).

## 8. Dank-Seite (`/einreichen/danke`)

Statische Page. Kein Code-Bezug zur Form-Submission — Submitter könnte die URL auch direkt aufrufen, das ist OK. Inhalt:

- H1: „Danke!"
- Paragraph: „Deine Submission ist bei uns angekommen. Die Redaktion prüft sie in den nächsten Tagen und meldet sich bei Rückfragen — falls du eine Mail-Adresse hinterlassen hast."
- Lizenz-Hinweis-Box: „Mit dem Einreichen hast du dein Material unter CC BY-SA 4.0 freigegeben. Danke fürs Mitmachen!"
- Buttons/Links: „Zur Startseite", „Weiteres einreichen" (`/einreichen`), „Inhalte stöbern" (`/`)

Visuell konsistent mit anderen Seiten (`<SectionLabel>` für „Mitmachen", Serif-H1, Body in `text-ink-muted`).

## 9. Smart-Defaults via Query-Params

Page-Komponente liest Server-side `searchParams`:

```typescript
type SearchParams = { type?: 'correction' | 'new_article'; article?: string };

export default async function EinreichenPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const initialType = params.type === 'correction' ? 'correction' : 'new_article';
  const initialArticleSlug = params.article || '';
  const articles = await fetchTopArticles();  // für Select-Dropdown
  return (
    <SubmissionForm
      initialType={initialType}
      initialArticleSlug={initialArticleSlug}
      articles={articles}
      turnstileSiteKey={process.env.TURNSTILE_SITE_KEY ?? ''}
    />
  );
}
```

Artikel-Footer-Links (existieren seit Commit `f12eb66` aus V1.1): `?type=correction&article=<slug>` setzt Form direkt in den Korrektur-Modus mit vorausgewähltem Artikel.

## 10. Tests

| Datei | Typ | Inhalt |
|---|---|---|
| `tests/unit/submission-schema.test.ts` | Unit | Zod-Schema: Pflichtfelder, Email-Format, Min/Max-Längen, Cross-Field-Refine für correction |
| `tests/unit/submission-mail.test.ts` | Unit | Template-Builder: Subject korrekt, HTML enthält alle Felder, Plaintext-Variante, anonym-Fallback bei fehlendem Name |
| `tests/unit/turnstile.test.ts` | Unit | `verifyTurnstileToken`: success-Response, fail-Response, Bypass-Mode ohne `TURNSTILE_SECRET_KEY` |
| `tests/integration/submission-action.test.ts` | Integration | `submitAction`: Schema-Fail returnt fieldErrors, Turnstile-Fail returnt error, Erfolg ruft `payload.create` + `payload.sendEmail` + `redirect` auf (alle drei gemockt) |
| `tests/component/SubmissionForm.test.tsx` | Component | Initial-Werte aus Props gerendert, Submit-Button disabled während pending, Field-Error wird angezeigt |

Soll-Suite nach V1.3b: ~56 Tests (36 Baseline + ~20 neu).

CI bleibt grün ohne `TURNSTILE_SECRET_KEY` und ohne `RESEND_API_KEY` — beide Bypass-Pfade greifen.

## 11. Repo-Änderungen (Übersicht)

**Neue Dependencies:**
- `zod` (production)
- `@marsidev/react-turnstile` (production)

**Neue Files:**
- `src/lib/submission-schema.ts`
- `src/lib/submission-mail.ts`
- `src/lib/turnstile.ts`
- `src/components/SubmissionForm.tsx`
- `src/components/ErrorSummary.tsx`
- `src/app/(frontend)/einreichen/actions.ts`
- `src/app/(frontend)/einreichen/danke/page.tsx`
- 5 Test-Dateien (siehe §10)

**Geänderte Files:**
- `src/app/(frontend)/einreichen/page.tsx` (Stub raus, echte Form rein)
- `.env.example` (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` ergänzen — **bestehende Werte nicht überschreiben**, V1.3a-Lesson)
- `package.json` (durch `pnpm add`)
- `README.md` (Mitmach-Setup oder Hinweis auf Turnstile-Setup ergänzen)

**Keine Migration** — `Submissions`-Collection existiert seit V1 mit allen nötigen Feldern.

## 12. Setup-Reihenfolge

Pre-Tasks (manuell, Oliver+Claude live):

1. **Cloudflare Turnstile-Site erstellen** — Cloudflare-Dashboard → Turnstile → „Add Site" → Domain `pflegeatlas.org` → Widget-Mode „Managed" → Site-Key und Secret-Key sicher ablegen
2. **Production-ENV** (zukünftig im Hosting-Dashboard) — `TURNSTILE_SITE_KEY` und `TURNSTILE_SECRET_KEY` setzen

Code-Tasks (siehe Plan-Doku):

3. Dependencies installieren (`zod`, `@marsidev/react-turnstile`)
4. Schema + Mail-Template + Turnstile-Helper (TDD)
5. ErrorSummary-Komponente (Component-Test)
6. SubmissionForm-Komponente (Component-Test)
7. Server Action (Integrations-Test mit Mocks)
8. Page + Danke-Page anpassen
9. `.env.example` und README aktualisieren
10. Lokale Verifikation: Form aufrufen, Bypass-Pfad senden, Mail in Resend + Inbox prüfen
11. PR + CI + Merge

## 13. Verifikations-Kriterien

V1.3b ist fertig wenn:

- [ ] `/einreichen` zeigt funktionsfähige Form statt Stub
- [ ] Submit ohne Pflichtfelder → ErrorSummary oben + Inline-Errors, Form-State bleibt erhalten
- [ ] Submit mit fehlendem Turnstile (Dev-Bypass leer in CI) → läuft durch, kein Spam-Schutz
- [ ] Erfolgs-Submit → Eintrag in Admin sichtbar, Redaktions-Mail in Resend-Logs + Gmail
- [ ] Smart-Default `?type=correction&article=test-dekubitus-...` füllt Form vor
- [ ] Dank-Seite erreichbar, kein direkter Submission-Bezug
- [ ] Tests grün (~56/56), Lint 0 Errors, Build grün
- [ ] CI grün ohne Turnstile- und Resend-ENV-Vars

## 14. Out-of-Scope und Folge-Themen

Ausdrücklich nicht in V1.3b:

- Submitter-Bestätigungs-Mail
- Auth + Editorial-Workflow + Review-Queue → eigener Plan
- Live-Autocomplete für `relatedArticle` → Meilisearch-Plan
- Server-side Idempotency-Key gegen Doppel-Submit → später wenn nötig
- Honeypot als no-JS-Fallback → mailto-Hinweis reicht
- Rate-Limit per IP → Turnstile + niedriges Volumen reichen vorerst
- Production-Deployment der ENV-Vars → Deployment-Plan
- Bounce-Handling der Submission-Notification-Mails → Resend macht's intern, eigener Plan bei Volumen
