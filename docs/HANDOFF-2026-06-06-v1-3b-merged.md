# Handoff — PflegeAtlas V1.3b shipped, V1.4 strukturierte Submissions next

**Datum:** 2026-06-06
**Vorherige Session:** sechste Session, lange Implementations-Runde
**Status:** V1.3b ist gemerged. Wartet auf Plan-Wahl + Brainstorming für V1.4.

---

## Repo-Stand

- Working tree: `/Users/oliverwosnitza/pflege-brainstorm`
- Branch: `main`, HEAD: **`0f1abd5`** (Merge V1.3b)
- Letzte 5 Commits: siehe `git log --oneline -5`
- CI grün, 70/70 Tests, Build sauber

## Was im Memory steht (NICHT duplizieren)

Diese Stellen lesen statt diesem Handoff alles nochmal zu erzählen:

- `~/.claude/projects/-Users-oliverwosnitza/memory/MEMORY.md` — Pointer
- `~/.claude/projects/-Users-oliverwosnitza/memory/project_pflegeatlas.md` — V1.3b-Stand inkl. Plan-Deviations, Lessons (React 19 Form-Preserve), Sicherheits-Lesson, Folgepläne
- `~/.claude/projects/-Users-oliverwosnitza/memory/reference_pflegeatlas_docs.md` — Pfade zu Specs/Plänen/Code

Im Repo:
- V1.3b-Spec: `docs/superpowers/specs/2026-06-05-pflegeatlas-submission-form-v1-3b-design.md`
- V1.3b-Plan: `docs/superpowers/plans/2026-06-05-pflegeatlas-submission-form-v1-3b.md`
- PR #3 (gemerged): https://github.com/shogun160/pflege-atlas/pull/3 — der Body enthält die 5 bewussten Plan-Deviations als Liste

## V1.4-Kontext (Plan-Wahl)

Oliver hat in der Browser-Praxistests von V1.3b einen echten Design-Gap entdeckt:

- **Articles** (`src/collections/Articles.ts`) haben 4 strukturierte RichText-Sektionen: `definition`, `praxis`, `risiken`, `quellen`, plus `title`, `intent` (bedside/background/learning), `summary` (max 280)
- **Submissions** (`src/collections/Submissions.ts`) hat nur 1 `body`-Textarea (max 20.000)
- → Der V1.3b-User kann mit dem aktuellen Form weder einen sauberen Artikel-Vorschlag machen (alles in ein Feld) noch eine Korrektur einem konkreten Abschnitt zuordnen

V1.4-Scope-Idee (offen, Brainstorming nötig):

- Neuer-Artikel-Flow: 7 strukturierte Felder analog Article (title, intent, summary, definition, praxis, risiken, quellen), evtl. RichText-Editor (Lexical, weil Payload das nutzt) für die 4 Sektionen
- Korrektur-Flow: Article-Auswahl → aktueller Inhalt der Sektionen wird vorgeladen → User wählt Sektion, editiert → Diff/Vorschlag geht raus
- Schema-Migration der Submissions-Collection ist nötig
- Pipeline aus V1.3b (Zod, Turnstile, Server-Action, Mail-Notification, controlled-inputs, ErrorSummary) wird komplett wiederverwendet
- Open Questions: RichText vs. Markdown, Diff-Format für Korrekturen, ob Korrekturen Section-by-Section gehen oder per-Article komplett

## V1.3b-Lessons die für V1.4 relevant sind

1. **React 19 form.reset() Race:** `<form action={useActionState-formAction}>` mit `defaultValue`-Pattern verliert den Race. Lösung in V1.3b: alle Inputs `value`/`onChange` (controlled), Sync von `state.values` über render-time-setState-Pattern. RichText-Editor in V1.4 muss ebenfalls controlled sein.

2. **Test-Mock-Ketten:** Server Actions ziehen `server-only` rein, brauchen `vi.mock('@/app/.../actions')` in Component-Tests. Bei `vi.mock`-Hoisting müssen Mocks in `vi.hoisted(...)` definiert werden.

3. **Plan-Reihenfolge prüfen:** V1.3b's Plan-Tasks 6/7 hatten Dependency-Inversion (Form importierte aus Action vor dessen Anlage). Bei V1.4-Plan-Schreiben gleich auf Import-Dependencies achten.

4. **Subagent-driven workflow funktioniert:** Plan → Implementer-Subagent pro Task → kurze Spec-Review (lightweight bei mechanischen Tasks) → kurze Code-Quality-Review bei komplexen. Bei kleinen Doc/Config-Tasks habe ich's selbst gemacht statt Subagent. Beide Pfade gangbar.

5. **Sicherheit:** Niemals `ps eww` oder `printenv` ungefiltert printen. Secrets immer maskieren (`sed 's/=.*$/=***/'`).

6. **Pre-existing Issues während Feature-Arbeit:** V1.4-Hygiene-Fix für `next/image localPatterns` lief als Drive-by im V1.3b-PR mit. War nötig um lokale Verifikation zu unblocken. Pattern: kleine Hygiene-Fixes können im selben PR landen wenn sie das Feature-Testing unblocken.

## Was Oliver in der Lounge-Zeit machen kann

- (nichts Erzwungenes) — Memory + dieses Doc sind aktuell, V1.3b läuft, Dev-Server ist gestoppt.

## Erste Aktion in der nächsten Session

1. Memory lesen (`MEMORY.md` → `project_pflegeatlas.md` → `reference_pflegeatlas_docs.md`)
2. Mit Oliver kurz checken: V1.4 strukturierte Submissions ist Plan-Wahl, oder doch was anderes (Auth/Editorial, Meilisearch, DSGVO-Track)?
3. Bei V1.4: **`superpowers:brainstorming`** Skill aufrufen — Olivers Praxis-Insights aus V1.3b-Test sind der Ausgangspunkt

## Empfohlene Skills für nächste Session

- **`superpowers:brainstorming`** — zwingend, weil V1.4 = neues Feature/Schema-Migration. Olivers Argument („mehrere Abschnitte vs. ein Body-Feld") + die Articles-Struktur in `src/collections/Articles.ts` sind der Ausgangspunkt.
- **`superpowers:writing-plans`** — nach Brainstorming, für den V1.4-Implementations-Plan.
- **`superpowers:subagent-driven-development`** oder **`superpowers:executing-plans`** — für die Implementation, je nachdem ob in derselben Session oder parallel.
- **`grill-with-docs`** wäre optional vor dem Plan, um den Brainstorm-Output gegen die Articles-Domain-Sprache + bisherige Submissions-Annahmen zu härten.

## Was NICHT erneut brainstormed werden muss

- Spam-Schutz (Turnstile ist drin)
- Mail-Notification (V1.3a-Adapter wird wiederverwendet)
- Validation-Stack (Zod + native HTML5)
- Form-UX (gov.uk ErrorSummary + Inline-Errors + Live-Counter sind etabliert)
- Form-Preserve (controlled-Inputs ist die Lösung)
- a11y-Pattern (aria-describedby + ErrorSummary autofocus sind drin)

## Repo-Convention für Handoffs

Bisherige Handoffs liegen unter `docs/HANDOFF-YYYY-MM-DD-<topic>.md` (siehe `docs/HANDOFF-2026-06-05*.md`). Falls sinnvoll, diesen Inhalt nach `/Users/oliverwosnitza/pflege-brainstorm/docs/HANDOFF-2026-06-06-v1-3b-merged.md` kopieren und committen — aktuell ist er nur im mktemp-Pfad.
