# PflegeAtlas V1.5 — Submissions als GitHub-PRs (Design-Spec)

**Datum:** 2026-06-20
**Status:** Brainstorm abgeschlossen, Spec erstellt, Plan steht aus.
**Vorgänger:** V1.4 (strukturierte Submissions mit Lexical-Editor), gemerged via PR #4.
**Folgeplan:** `docs/superpowers/plans/2026-06-20-pflegeatlas-submissions-as-prs-v1-5.md` (wird per `superpowers:writing-plans` erzeugt).
**Vorklärungen:** `docs/HANDOFF-2026-06-06-v1-4-merged.md` — Abschnitt „V1.5-Vorklärungen".

---

## 1 — Anlass und Ziel

PflegeAtlas-Submissions landen heute nur in der Payload-DB und werden per Mail an die Redaktion verschickt. Es gibt keinen externen Audit-Trail, keinen Markdown-Mirror der Artikel im Repo, kein „GitHub als Schaufenster des laufenden Redaktions-Workflows".

V1.5 schließt diese Lücke:
- Jede Submission erzeugt ab dem Triage-Schritt einen Pull-Request im Repo, der den Markdown-Stand des betroffenen Artikels diffbar zeigt.
- Akzeptierte Artikel werden als Markdown-Dateien unter `content/articles/<slug>.md` gespiegelt.
- Auch Direkt-Edits an Artikeln im Admin synct das System automatisch in das Repo.

**Was V1.5 explizit nicht löst:** Reverse-Parsing (Markdown→Lexical), Webhooks, Mehr-Reviewers-Rollen, Bootstrap-Migration alter Artikel. Siehe Abschnitt 11.

---

## 2 — Designentscheidungen (Kompaktübersicht)

| # | Frage | Antwort |
|---|---|---|
| 1 | Wer ist Source-of-Truth: GitHub-Repo oder Payload-DB? | **B'** — Payload-DB. PR ist Audit-Mirror und Diff-Reading-Tool. Kein Reverse-Parser. |
| 2 | Wann wird der PR erzeugt? | **b** — beim Klick „In Review nehmen" im Admin (nicht beim Submission-Eingang, nicht erst beim Annehmen). |
| 3 | Article-Edits außerhalb Submission-Flow → Sync wie? | **a** — direkter Commit auf `main`, kein PR. |
| 4 | Failure-Mode bei Octokit-Aussetzern? | **c** — atomar, alles oder nichts. Rollback der DB-Mutation bei API-Fehler. |
| 5 | PII-Hinweis im Submission-Form? | **a** — mit drin in V1.5 (Notice-Block, kein Acknowledge-Checkbox). |
| 6 | Test-Strategie? | **a** — Mock-only via `vi.mock`, manueller Smoke-Test vor Merge Pflicht. |

Hinzu kommen vier Punkte, die bereits am 2026-06-06 vorgeklärt wurden (siehe Handoff): GitHub-App unter `shogun160` mit Octokit, Markdown unter `content/articles/<slug>.md`, keine Submitter-PII im PR-Body, Christoph mergt Inhalts-PRs / Oliver Code-PRs.

---

## 3 — Architektur und Datenfluss

Drei beteiligte Welten:
- **Payload-DB** — Source-of-Truth für Articles und Submissions
- **GitHub-Repo `shogun160/pflege-atlas`** — Markdown-Mirror unter `content/articles/<slug>.md`, PR-Workflow für Audit und Transparenz
- **Payload-Admin** — wo Christoph alle Redaktionsaktionen durchführt

### 3.1 — Submission-Workflow (Happy Path)

```
┌──────────────┐
│ Submission   │ (1) Eingang via /einreichen
│ kommt rein   │     → reviewStatus = pending
└──────┬───────┘     → Mail an redaktion@pflegeatlas.org
       │
       │ Christoph schaut in Admin rein
       ▼
┌──────────────┐
│ "In Review"  │ (2) Atomare Aktion:
│ Klick        │     → Octokit: Branch submission/<id> erstellen
└──────┬───────┘     → Octokit: Markdown-Datei schreiben + PR öffnen
       │             → DB: reviewStatus=in_review, prNumber, prBranch, prState=open
       │             Wenn eine Operation fehlschlägt: alles rollbacken.
       ▼
┌──────────────┐
│ Bearbeitung  │ (3) Christoph editiert Submission im Admin (Lexical-Editor)
│ optional     │     → afterChange-Hook: push neuer Commit auf prBranch
└──────┬───────┘     → Inline-Diff im Admin aktualisiert sich
       │             → PR-Diff in GitHub aktualisiert sich
       │
       ▼
┌──────────────┐
│ "Annehmen"   │ (4) Atomare Aktion:
│ Klick        │     → DB: Article schreiben/updaten (status=published, lastReviewedAt=heute)
└──────┬───────┘     → Octokit: PR mergen
       │             → DB: reviewStatus=accepted, prState=merged
       │             → Mail an submitterEmail (wenn vorhanden): "Beitrag übernommen"
       ▼
   Fertig
```

### 3.2 — Reject-Pfad

`„Ablehnen"`-Klick (sichtbar wenn `reviewStatus ∈ {pending, in_review}`) → wenn PR existiert: schließen + Branch löschen; DB: `reviewStatus=rejected, prState=closed`. Atomar. **Keine Mail an Submitter in V1.5** (verschoben, siehe Abschnitt 11).

### 3.3 — Article-Direkt-Edit (außerhalb Submission)

```
Christoph editiert Article im Admin
  → afterChange-Hook auf Article:
     - status=published?            → upsertArticleMarkdown(): direkter Commit auf main
     - status wechselt zu archived? → deleteArticleMarkdown(): file gelöscht via Commit
     - status=draft/in_review?      → kein Sync (Drafts bleiben out-of-repo)
  → Inhalts-Hash-Vergleich vorher: kein Commit wenn nichts ändert
```

### 3.4 — DB-Schema-Erweiterungen

Submissions bekommen vier neue Felder:

| Feld | Typ | Beschreibung |
|---|---|---|
| `prNumber` | number, optional | GitHub-PR-Nummer, sobald PR existiert |
| `prBranch` | text, optional | Branch-Name (`submission/<id>`) |
| `prState` | select, optional | `open` / `merged` / `closed` |
| `proposedSlug` | text, optional, nur `new_article` | Vom Backend vorbelegt nach „In Review"-Klick, vor „Annehmen" editierbar |

Articles bleiben schemaseitig unverändert.

### 3.5 — Atomarität

Alle drei Server-Actions („In Review", „Annehmen", „Ablehnen") sowie der Article-Sync-Hook laufen in einer Payload-Transaction (`req.transactionID`).

**Ordnung in jeder Action:**
1. DB-Transaction starten (Payload).
2. DB-Mutationen vorbereiten, aber noch NICHT committen.
3. Octokit-Call durchführen.
4. Wenn Octokit erfolgreich → DB-Transaction committen.
5. Wenn Octokit wirft → DB-Transaction zurückrollen, Exception an die Server-Action propagieren.

Im Admin erscheint ein Toast mit Fehlermeldung; Christoph kann neu klicken.

**Compensating-Action für den seltenen Fall „Octokit ok, DB-Commit schlägt fehl":** explizit ein zweiter try/catch um Schritt 4. Wenn DB-Commit fehlschlägt, wird die in Schritt 3 erfolgreich durchgeführte Octokit-Mutation rückgängig gemacht (PR schließen + Branch löschen bei „In Review"; PR wieder öffnen ist nicht trivial, daher bei „Annehmen" / „Ablehnen" einen sauberen Fehlerbericht in den Logs + manuelle Korrektur durch Christoph notwendig). Akzeptabel, weil DB-Commits in einer well-konfigurierten Payload-Postgres-Umgebung praktisch nie fehlschlagen.

### 3.6 — Article-Hook und Submission-Annehmen ohne Doppel-Sync

Die „Annehmen"-Action updatet den Article in der DB. Der `Articles.afterChange`-Hook würde naiv ebenfalls einen `upsertArticleMarkdown()`-Call (direkter main-Commit) feuern — gleichzeitig zum PR-Merge der Submission. Das ergibt eine Race-Condition zwischen zwei Markdown-Commits auf main.

**Lösung:** Die Submission-„Annehmen"-Action setzt vor dem Article-Update ein Flag auf `req.context.skipMarkdownSync = true`. Der `Articles.afterChange`-Hook prüft dieses Flag und überspringt den direkten Sync. Der Markdown-Stand wandert dann ausschließlich über den PR-Merge auf main.

Für Article-Direkt-Edits außerhalb der Submission-Annehmen-Action ist das Flag nicht gesetzt, der Hook läuft normal.

---

## 4 — Markdown-Format

### 4.1 — Dateipfad

`content/articles/<slug>.md` — eine Datei pro Article, Dateiname identisch zum `slug` im Articles-Schema (slug ist unique).

### 4.2 — Frontmatter (YAML)

```yaml
---
payloadId: 42
slug: dekubitusprophylaxe
title: Dekubitusprophylaxe
intent: bedside
summary: Kurzbeschreibung (max 280)
status: published
authors:
  - Christoph Brück
lastReviewedAt: 2026-06-20
standardsBound: true
---
```

- `payloadId` ist redundant zum Dateinamen-Slug, aber explizit für Reverse-Lookup und Debugging.
- `intent` als technischer Wert (`bedside` / `background` / `learning`), nicht als Anzeige-Label.
- `authors` als Klartext-Namen, aufgelöst beim Sync über das Payload-User-Profil. User-IDs sind im Repo wertlos.
- `lastReviewedAt` als ISO-Date.
- `reviewedBy` wird in V1.5 **nicht** mitgespiegelt — die Standardgebundenheit-Erinnerung wird heute manuell gepflegt.

### 4.3 — Body

```markdown
## Definition

[Lexical-Output als Markdown]

## Praxis

...

## Risiken & Fallstricke

...

## Quellen & Weiterführendes

...
```

Fixe 4 Headings entsprechend den 4 Sektionen. Lexical→Markdown via Walker (analog zu `lexical-to-plain-text.ts` aus V1.4); reduzierte Toolbar (Bold/Italic/Lists/Links) ist verlustfrei mappbar. Alle 4 Sektionen sind im Schema `required`, daher sollten leere Sektionen nicht vorkommen.

### 4.4 — Slug-Konflikt-Auflösung (nur `new_article`)

1. Slug aus `proposedTitle` generieren via existierender `slugify`-Lib.
2. Wenn `content/articles/<slug>.md` schon existiert: Suffix-Logik `<slug>-2`, `<slug>-3`, ...
3. Der resolverte Slug landet als `proposedSlug` auf der Submission und wird im PR-Body sichtbar gemacht.
4. Christoph kann den Slug vor „Annehmen" überschreiben. Re-Push commitiert die Datei unter dem neuen Pfad (alte Datei löschen, neue anlegen — ein Commit).

---

## 5 — Branch-, PR- und Commit-Konventionen

### 5.1 — Branch-Naming

- Submission-PRs: **`submission/<id>`** (z.B. `submission/42`)
- Article-Direkt-Edits: **kein Branch** — direkter Commit auf `main`

### 5.2 — Commit-Messages

| Anlass | Commit-Message |
|---|---|
| „In Review", Initial-Commit | `submission(<id>): initial proposal` |
| Re-Push beim Editieren | `submission(<id>): editorial revision` |
| „Annehmen", Merge | `submission(<id>): accepted, merging to main` (Squash-Merge, kann via Octokit übersteuert werden) |
| Article-Direkt-Edit | `article(<slug>): update from admin` |
| Article veröffentlicht | `article(<slug>): publish` |
| Article archiviert | `article(<slug>): archive` |

### 5.3 — PR-Titel

- `new_article`: **`[Vorschlag] {proposedTitle}`**
- `correction`: **`[Korrektur] {article.title}`**

### 5.4 — PR-Body

```markdown
**Typ:** Korrektur  (oder: Neuer Artikelvorschlag)
**Betroffene Sektionen:** Definition, Praxis  ← nur bei correction
**Slug-Vorschlag:** `dekubitus-bei-diabetes`  ← nur bei new_article
**Admin-Link:** https://pflegeatlas.org/admin/collections/submissions/42

**Begründung der/des Einreichenden:**
> [correctionReason als Quote-Block, max 2000 Zeichen, optional]

---
*Submitter-Daten (Name/E-Mail) bleiben in der Datenbank und werden nicht hier veröffentlicht.*
```

- **Keine** `submitterName`, **keine** `submitterEmail` im PR-Body oder Commit-Metadaten (Vorklärung 3).
- `correctionReason` ist drin als fachliche Begründung. Wenn ausnahmsweise PII enthalten ist, kann Christoph beim Triage manuell editieren oder die Submission im Admin bereinigen vor „In Review"-Klick.
- Interne `reviewerNotes` werden nicht gespiegelt.

---

## 6 — Admin-Änderungen

### 6.1 — Neue Module unter `src/lib/`

| Datei | Job | Tests |
|---|---|---|
| `github-app.ts` | App-Auth (`@octokit/auth-app`), liefert Octokit-Instanz | Unit, Mock |
| `github-pr.ts` | High-Level: `createSubmissionPR`, `pushSubmissionEdit`, `mergeSubmissionPR`, `closeSubmissionPR` | Unit + Integration, Mock |
| `github-article-sync.ts` | High-Level: `upsertArticleMarkdown(article)`, `deleteArticleMarkdown(slug)` — direkter main-Commit | Unit, Mock |
| `lexical-to-markdown.ts` | Walker analog zu `lexical-to-plain-text.ts`, behandelt Bold/Italic/Lists/Links | Unit, viele Cases |
| `article-markdown.ts` | Frontmatter + Body-Renderer für ein komplettes Article-File | Unit, Roundtrip-Snapshot |
| `submission-to-article.ts` | Mapper: Submission → Article-Update-Payload + Markdown-File-Content | Unit |
| `submission-section-diff.ts` | Pro Sektion: original-Plain-Text vs. edited-Plain-Text, strukturiertes Diff-Result | Unit |

### 6.2 — Neue Hooks

- **`Submissions.afterChange`** — wenn `prNumber` gesetzt UND `reviewStatus === 'in_review'`: `pushSubmissionEdit()` mit aktuellem Stand. Hash-Vergleich vorher (kein Push wenn nichts ändert). Bei Octokit-Fehler wirft der Hook und rollt die DB-Mutation zurück.
- **`Articles.afterChange`** — wenn `status === 'published'`: `upsertArticleMarkdown()`. Wenn vorher `published` und jetzt anders: `deleteArticleMarkdown()`. Hash-Vergleich vermeidet leere Commits. Atomar wie oben.

### 6.3 — Admin-Buttons auf Submission-Detail-Seite

| Button | Sichtbar wenn | Aktion |
|---|---|---|
| „In Review nehmen" | `reviewStatus === 'pending'` | Octokit: Branch + Markdown-Datei + PR öffnen. DB: `reviewStatus=in_review`, `prNumber`, `prBranch`, `prState=open`. Atomar. |
| „Annehmen" | `reviewStatus === 'in_review'` | DB: Article schreiben/updaten (`status=published`, `lastReviewedAt=heute`), `reviewStatus=accepted`, `prState=merged`. Octokit: PR mergen. Mail an Submitter (wenn `submitterEmail`). Atomar. |
| „Ablehnen" | `reviewStatus ∈ {pending, in_review}` | Wenn PR existiert: Octokit close + delete branch. DB: `reviewStatus=rejected`, `prState=closed`. Atomar. Keine Mail. |

### 6.4 — Slug-Override-Feld

- Feld `proposedSlug` (text, optional) im `new_article`-Block der Submission, sichtbar in der Admin-Detail-Ansicht.
- Vorbelegt vom Backend mit dem konflikt-resolverten Slug-Vorschlag, sobald „In Review" geklickt wurde.
- Christoph kann überschreiben. Re-Push commitiert die Datei unter dem neuen Pfad.

### 6.5 — Inline-Diff-Komponente

- Eine React-Komponente pro Sektion (4 Stück), Custom Field auf Submission-Detail-Page.
- Bei `correction`: zeigt Plain-Text-Diff zwischen `article[section]` (über `lexicalToPlainText()` aus V1.4) und `submission.edited<Section>` (über `lexicalToPlainText()`). Diff-Library: `diff` (npm, MIT, klein).
- Visualisierung: rot-rausgenommen, grün-neu-drin, grau-unverändert. Inline auf Zeilenebene.
- Bei `new_article`: kein Diff (kein Original), stattdessen die proposed Sektion als Read-only Plain-Text-Preview.
- Auto-Refresh über Payloads `useField`-Hook bei jedem Save.

---

## 7 — Submission-Form-Änderungen

### 7.1 — PII-Notice

Neue Komponente `src/components/PiiNotice.tsx`, eingebunden in `SubmissionForm.tsx` über dem ersten Inhaltsfeld, sowohl im `new_article`- als auch im `correction`-Modus:

> **Datenschutz:** Bitte schreib generisch — keine Namen, Initialen oder Personen-Bezüge (auch nicht von Bewohner:innen, Kolleg:innen oder Arbeitgebern). Wenn dein Beitrag angenommen wird, landet er öffentlich auf GitHub.

Dezenter Petrol-Hintergrund, kein Modal, **kein Checkbox-Acknowledge** (kostet Conversion ohne harten Compliance-Mehrwert).

### 7.2 — Sonst keine Form-Änderungen

Der bestehende V1.4-Form-Code (Lexical-Editor, Section-Picker für Korrekturen, Turnstile, Server-Action) bleibt unverändert.

---

## 8 — GitHub-App-Setup und ENV

### 8.1 — Pre-Tasks (analog Turnstile bei V1.3b)

Diese Tasks führt Oliver per Klick aus, Claude assistiert beim base64-Encoding. Können parallel zum Code-Track laufen, da der Code-Track dank Dev-Bypass komplett ohne echte Creds funktioniert.

| # | Schritt | Wo |
|---|---|---|
| 1 | App `pflegeatlas-bot` anlegen unter Personal Account `shogun160` | `github.com/settings/apps/new` |
| 2 | Permissions setzen: Contents R/W, Pull Requests R/W, Metadata R | App-Settings |
| 3 | Webhook **deaktivieren** (Pull-Architektur, kein Push) | App-Settings |
| 4 | App auf Repo `shogun160/pflege-atlas` installieren | App-Install-Flow |
| 5 | App ID + Installation ID notieren | App-Settings |
| 6 | Private Key generieren (.pem-Datei downloaden) | App-Settings |
| 7 | .pem → base64-Single-Line: `base64 -i private-key.pem \| tr -d '\n' > pk.b64` | Lokal, Claude assistiert |
| 8 | Alle drei Werte in 1Password ablegen | 1Password |

### 8.2 — ENV-Vars

| Variable | Beschreibung |
|---|---|
| `GITHUB_APP_ID` | Numerische App-ID |
| `GITHUB_APP_INSTALLATION_ID` | Numerische Installation-ID (pro Repo eindeutig) |
| `GITHUB_APP_PRIVATE_KEY` | Base64-encoded Private Key (Single-Line) |
| `GITHUB_REPO_OWNER` | `shogun160` (default im Code) |
| `GITHUB_REPO_NAME` | `pflege-atlas` (default im Code) |

`.env.example` wird entsprechend ergänzt (analog zu V1.3a-Mail- und V1.3b-Turnstile-Sektion).

### 8.3 — Dev-Bypass (analog Turnstile)

- Im Code: wenn `GITHUB_APP_PRIVATE_KEY` leer/nicht gesetzt → der Octokit-Helper wirft **nicht**, sondern returned ein No-Op-Result (`{ prNumber: null, prBranch: null, prState: 'skipped' }`) und loggt eine Warnung.
- Admin-Buttons werden trotzdem klickbar; Submission-Status springt korrekt, nur ohne PR.
- Im Admin-UI: kleine Dev-Notice neben dem Button: *„(Dev: kein GitHub-Sync, ENV nicht gesetzt)"*.

### 8.4 — Production-Boot-Check

Wenn `NODE_ENV === 'production'` UND eine der drei kritischen Vars (`GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`) fehlt → App startet nicht. Lautes throw mit Anweisung. Analog Turnstile-Pflichtprüfung aus V1.3b.

### 8.5 — CONTRIBUTING.md

Neuer Abschnitt „Pull-Requests":
- Inhalts-PRs (Branch beginnt mit `submission/`): **Christoph** ist Default-Reviewer/Merger.
- Code-PRs (alles andere): **Oliver** ist Default-Reviewer/Merger.
- Keine harte Enforcement, beide können einspringen.

Lightweight-Konvention statt CODEOWNERS-Datei (Vorklärung 4).

---

## 9 — Test-Strategie

### 9.1 — Test-Typen

| Typ | Coverage | Tooling |
|---|---|---|
| Unit | `lexical-to-markdown` (Roundtrip-Cases), `article-markdown` (Frontmatter+Body), `submission-to-article`, `submission-section-diff`, `github-app` (Auth-Wiring) | Vitest + `vi.mock` für Octokit |
| Integration | Server-Actions „In Review", „Annehmen", „Ablehnen" — vollständiger DB+Octokit-Mock-Flow inkl. Rollback bei Fehler | Vitest, Payload-In-Memory |
| Component | Inline-Diff-Komponente, PII-Notice, neue Admin-Buttons, Slug-Override-Feld | Vitest + Testing-Library |

### 9.2 — Manueller Smoke-Test (Pflicht vor Merge)

Mit echten App-Credentials lokal:
1. Eine `new_article`-Submission einreichen → „In Review" → PR im echten Repo prüfen → „Annehmen" → Article im Admin und Markdown-Datei in main prüfen → PR-State `merged`
2. Eine `correction`-Submission einreichen → „In Review" → PR-Diff prüfen → Submission editieren → PR-Diff updated → „Annehmen" → updated Article + Merge prüfen
3. Eine Submission „Ablehnen" → PR-State `closed`, Branch weg
4. Ein Article direkt im Admin editieren (status=published) → Markdown-Datei in main updated, kein PR

Smoke-Test wird im PR-Body von V1.5 als Checkliste mit Screenshots dokumentiert.

### 9.3 — Akzeptanzkriterien

- Alle Tests grün
- 0 Lint-Errors
- `pnpm build` sauber
- Manueller Smoke-Test im PR-Body abgehakt mit Screenshots
- Christoph einmal manuell durch den Admin-Flow geklickt (per Loom oder live)

### 9.4 — Test-Disziplin

TDD strict (rot-grün-refactor) wie bei V1.3/V1.4. Bestehende 138 Tests müssen grün bleiben; geschätzt +50-70 neue Tests.

---

## 10 — Tasks-Vorschau

Der detaillierte Plan wird via `superpowers:writing-plans` erzeugt. Vorgesehene Tasks:

| # | Task | Größe | Dependency |
|---|---|---|---|
| 0a | GitHub-App-Pre-Tasks 1-8 (Oliver) | Setup | parallel zum Code |
| 1 | Deps installieren (`@octokit/auth-app`, `@octokit/rest`, `diff`, `js-yaml`) | XS | — |
| 2 | `lexical-to-markdown` Walker | M | — |
| 3 | `article-markdown` Renderer + Roundtrip-Tests | M | T2 |
| 4 | `github-app` + `github-pr` + `github-article-sync` (Mock-only) | M | T1 |
| 5 | `submission-to-article` Mapper | S | T2-4 |
| 6 | `submission-section-diff` Helper | S | — |
| 7 | DB-Schema-Migration für `prNumber`, `prBranch`, `prState`, `proposedSlug` | S | — |
| 8 | Submission-Server-Actions: in-review / accept / reject (atomar, Rollback-fähig) | L | T4, T5, T7 |
| 9 | Article-afterChange-Hook für Direkt-Sync | S | T3, T4 |
| 10 | Inline-Diff-Komponente (Custom Field) | M | T6 |
| 11 | Admin-Buttons + Slug-Override-Feld (Custom UI) | M | T8 |
| 12 | PII-Notice-Komponente + Einbindung in SubmissionForm | XS | — |
| 13 | ENV-Verkabelung + Dev-Bypass + Production-Boot-Check | S | T4 |
| 14 | `.env.example`, README-Update, CONTRIBUTING.md-Erweiterung | XS | — |
| 15 | Manueller Smoke-Test + PR + Merge | S | alle |

Vergleichbarer Umfang zu V1.3b (11 Tasks) und V1.4 (15 Tasks). Implementierung via Subagent-Driven-Workflow.

---

## 11 — Scope-Cuts

V1.5 löst explizit **nicht**:

- **Reverse-Sync Markdown→Lexical** — entfällt komplett dank Architektur B'
- **GitHub-Webhooks** — Pull-Architektur, kein Push-Empfang
- **Bot-User-Account** — App ist Christoph/Oliver-zugeordnet
- **Org-Move** auf `github.com/pflegeatlas/...` — verschoben bis V2 QM-Tool als eigenes Repo dazukommt
- **Rate-Limit-Resilienz / Background-Retry-Queues** — atomares Fail+Retry-by-Click reicht für erwartete Frequenz
- **Ablehnungs-Mail an Submitter mit Begründung** — verschoben, kommt evtl. mit V1.6 Editorial
- **Reviewer-spezifische Permissions** — kommt mit V1.6 Auth/Editorial
- **Article-Versionierung über Payload-Drafts hinaus** — eigener Plan, mit V1.6 Editorial
- **Bootstrap-Migration alter Artikel** — entfällt, da 0 echte Artikel in der DB (nur Test-Daten)
- **DSGVO-Tracks Datenschutzerklärung/Impressum/AVV** — eigener Track, Pflicht vor Production-Launch

---

## 12 — Risiken und Lessons aus V1.3/V1.4

| Risiko | Mitigation |
|---|---|
| Octokit-Mocks in TDZ-Context-Problemen unter Vitest | `vi.hoisted` (V1.4-Lesson) |
| `pnpm payload migrate:create` hängt auf non-TTY stdin | Manuelle Migration im init.ts-Stil schreiben, via psql applien (V1.4-Lesson) |
| ENV-Var-Konfiguration unklar, Production-Boot stumm fehlerhaft | Production-Boot-Check explizit erzwingen (V1.3b-Turnstile-Lesson) |
| Private Key / Bearer Token in Debug-Output | Niemals printen, nicht in `ps eww`, `printenv`, keine Mock-Replays mit echten Werten (V1.4-Security-Lesson) |
| Lexical-Version-Drift bricht Markdown-Mapper | Reduzierte Toolbar ist verlustfrei mappbar; Roundtrip-Tests fangen Drift bei Lexical-Updates |
| Inhalts-PII landet im public Repo | PII-Notice im Form (V1.5-Scope) + manuelle Triage durch Christoph vor „In Review" |
| Slug-Konflikte bei `new_article` | Suffix-Logik + sichtbarer Slug-Override im Admin |

---

## 13 — Quellen und Bezüge

- **Vorklärungen:** `docs/HANDOFF-2026-06-06-v1-4-merged.md` (Abschnitt „V1.5-Vorklärungen")
- **Brainstorm-Session:** 2026-06-20 mit Oliver (alle 6 Designentscheidungen + 5 Sektion-Approvals)
- **Memory-Pendant:** `~/.claude/projects/-Users-oliverwosnitza/memory/project_pflegeatlas.md`
- **Vorgänger-Specs:** V1.3b (`2026-06-05-pflegeatlas-submission-form-v1-3b-design.md`), V1.4 (`2026-06-06-pflegeatlas-structured-submissions-v1-4-design.md`)
- **Folgeplan (wird erstellt):** `docs/superpowers/plans/2026-06-20-pflegeatlas-submissions-as-prs-v1-5.md`
