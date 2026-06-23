# PflegeAtlas — Sub-C1 Articles-Export-Pagination

**Datum:** 2026-06-23
**Status:** Spec
**Vorgänger:** V1.7 live auf main (HEAD `832ead2`), V1.7.1-Polish abgeschlossen.
**Track:** Sub-C (DSGVO-Code-Härtung), erstes von drei Mini-Plans (C1 Pagination, C2 Hard-Delete, C3 Audit-Log).

## Problem

`exportOwnDataAction` in `src/lib/auth.ts:407-437` ruft `payload.find`
zweimal mit hartcodiertem `limit: 1000`:

- `submissions` (Z. 413-418)
- `articles` (Z. 422-427)

Bei einem Power-User mit mehr als 1000 Submissions oder mehr als 1000
Articles werden Daten **stillschweigend abgeschnitten**. Das verletzt
DSGVO Art. 15 (Vollständigkeit der Auskunft) und das
Datenexport-Versprechen in `src/components/DatenschutzSections.tsx:165-169`
(„eigenständig ihre Daten herunterladen").

In Phase 1 ist das Szenario praktisch unrealistisch (Userbase klein,
keine Massen-Submitter bekannt), aber Spec-Promise und Code müssen
übereinstimmen, und der Bug ist trivial zu beheben.

## Entscheidungen (Brainstorm 2026-06-23)

| Frage | Entscheidung |
|---|---|
| Pagination-Loop vs. NDJSON-Streaming vs. Hard-Cap? | **Pagination-Loop.** Behält JSON-Aggregate-Format, kein Client-Code-Touch, kein Memory-Problem bei realistischen Datenmengen. NDJSON wäre premature optimization. Hard-Cap ohne Loop ist nicht DSGVO-konform. |
| Page-Size für `payload.find`-Loop? | **500.** Default 10 würde bei einem 600-Doc-Export 60 Round-Trips machen; 500 ist Payload-üblicher Power-User-Wert und im Memory unproblematisch. |
| Safety-Cap-Wert? | **10.000 docs pro Collection.** Echte Daten-Power-User in Phase 1 sind <500 Submissions. 10k ist Faktor 20 darüber — wer das überschreitet, hat eindeutig einen Bug oder einen Edge-Case, der manuellen Admin-Export rechtfertigt. |
| Verhalten bei Cap-Überschreitung? | **Throw + Action-Error-Message.** `exportOwnDataAction` returnt `{ ok: false, error: 'Datenmenge übersteigt 10.000 Einträge — bitte datenschutz@pflegeatlas.org für manuellen Vollexport kontaktieren.' }`. Kein neuer UI-Pfad, bestehende Error-Anzeige in `/mein-bereich` greift. |
| Streaming, NDJSON, oder Multi-File-ZIP? | **Nein.** Out of Scope. Wenn jemals nötig: eigener Spec. |

## Architektur

Eine neue Helper-Funktion in `src/lib/data-export.ts` (Datei existiert
mit `shapeExport` + `SENSITIVE_USER_FIELDS`, wird ergänzt):

```ts
export const EXPORT_HARD_CAP = 10_000;
export const EXPORT_PAGE_SIZE = 500;

export class ExportTooLargeError extends Error {
  constructor(collection: string, count: number) {
    super(`Export aborted: ${collection} exceeds hard cap (${count} >= ${EXPORT_HARD_CAP})`);
    this.name = 'ExportTooLargeError';
  }
}

export async function findAllForExport<T>(args: {
  payload: Payload;
  collection: CollectionSlug;
  where: Where;
}): Promise<T[]>;
```

`findAllForExport` loopt `payload.find({ collection, where, limit: 500, page: N, depth: 0 })`,
sammelt `docs` in einem Akkumulator, bricht ab wenn `hasNextPage === false`.
Wirft `ExportTooLargeError` sobald `accumulated.length >= EXPORT_HARD_CAP`.

`exportOwnDataAction` in `src/lib/auth.ts:407-437` ersetzt die zwei
hartcodierten `payload.find({ limit: 1000 })` durch zwei
`findAllForExport`-Aufrufe. `try/catch` fängt `ExportTooLargeError`
zusätzlich ab und mappt auf die spezifische User-Message.

**Datenfluss bleibt identisch:** `/mein-bereich` Button →
`exportOwnDataAction` → JSON-String über `shapeExport` →
Browser-Download. Keine UI-Änderung.

**Page-Order:** `payload.find` ist ohne explizites `sort` deterministisch
nach `createdAt desc` (Payload-Default). Pagination-Konsistenz nicht
kritisch, da kein paralleler Schreib-Stream auf eigene User-Daten
während des eigenen Export-Klicks läuft.

## Touch-Liste

| Datei | Änderung |
|---|---|
| `src/lib/data-export.ts` | Neu: `EXPORT_HARD_CAP`, `EXPORT_PAGE_SIZE`, `ExportTooLargeError`, `findAllForExport`. Bestehender `shapeExport` + `SENSITIVE_USER_FIELDS` unverändert. |
| `src/lib/auth.ts` | `exportOwnDataAction` (Z. 407-437): zwei `payload.find({ limit: 1000 })` ersetzt durch `findAllForExport`. `catch` erweitert um `ExportTooLargeError`-Mapping. |
| `tests/unit/data-export.test.ts` | **Extend** (Datei existiert mit `shapeExport`-Tests). 4 neue Tests für `findAllForExport` + `ExportTooLargeError` siehe Abschnitt Tests. |
| `tests/integration/auth-data-export.test.ts` | **Extend** (Datei existiert mit `exportOwnDataAction`-Smoke-Test, nutzt `helpers/user-fixtures`). 1 neuer Test: 600-Submission-Seed, Export-Vollständigkeit. |

## Tests

**Unit-Tests (`tests/unit/data-export.test.ts`, neu):**

1. **`findAllForExport` sammelt über mehrere Pages.** Mock-Payload
   liefert 3 Pages à 500 docs (`hasNextPage: true, true, false`).
   Assertion: returnte Liste hat 1500 Einträge in korrekter Reihenfolge.
2. **`findAllForExport` returnt sofort bei 1 Page.** Mock liefert
   100 docs mit `hasNextPage: false`. Assertion: 1 Find-Call, 100 Einträge.
3. **`findAllForExport` wirft `ExportTooLargeError`.** Mock liefert
   immer `hasNextPage: true` mit 500 docs pro Page. Assertion: Loop
   bricht beim Erreichen von 10.000 ab und wirft `ExportTooLargeError`.
4. **`shapeExport`-Roundtrip-Smoke.** Existierender `shapeExport` mit
   einer zusammengeführten 1500-Doc-Liste — beweist Compat zwischen
   neuem Loop-Output und altem Aggregator.

**Integration-Test (`tests/integration/auth-export.test.ts`):**

5. **Realdaten-Pagination.** Seed: 1 User + 600 Submissions
   (`submittedBy = userId`) via `payload.create`-Loop in `beforeAll`.
   Action: `exportOwnDataAction()` aufrufen (mit Mock-Session via
   `requireUser`-Stub).
   Assertion: `JSON.parse(json).submissions.length === 600`.

**Bestehende Tests:** `tests/integration/auth-data-export.test.ts`
hat einen Smoke-Test, der einen User + 1 Submission anlegt und prüft
dass `submissions.length === 1`. Der neue Pagination-Test (#5) wird
als zusätzliches `it(...)` angehängt. Vorhandene `helpers/user-fixtures`
(`createUserFixture`) wird wiederverwendet. Der Login-Mock-Pattern
(`vi.doMock('next/headers')` mit `payload-token`-Cookie) wird vom
bestehenden Test übernommen. Bestehender Smoke bleibt grün.

## Out of Scope

- NDJSON-Streaming-API (B verworfen)
- Avatar-Inclusion ins Export-JSON (Avatar-Hard-Delete-Verhalten ist Sub-C2)
- Multi-File-ZIP (kein User-Request)
- Datenexport-Format-Erweiterungen (kein Bug, kein Request)
- UI-Änderung in `/mein-bereich` (bestehender Error-Pfad reicht)
- Telemetry/Logging (Vercel-Logs reichen für Phase 1)

## Risiken + Mitigation

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| Payload-`find`-Default-Sort ändert sich zwischen Pages | gering | ein Doc taucht zweimal auf | Bestehender V1.7-Pin auf Payload-Version reicht. Falls jemals upgrade: ein expliziter `sort: 'createdAt'` einbauen. |
| Memory-Spike bei 10k docs im Test-Cap | gering | Test-Worker-OOM | Page-Size 500 + Cap 10k = max ~5 MB JSON, unkritisch. |
| Integration-Test 600-Seed langsam | mittel | CI 5-10s langsamer | Akzeptabel — pro Test-File ein `beforeAll`-Seed reicht. |

## Release-Gate / Akzeptanz-Kriterien

- [ ] `findAllForExport` + `ExportTooLargeError` in `src/lib/data-export.ts` exportiert
- [ ] `exportOwnDataAction` benutzt `findAllForExport` für beide Collections
- [ ] 4 Unit-Tests + 1 Integration-Test grün
- [ ] `pnpm exec tsc --noEmit` grün
- [ ] `pnpm lint` 0 errors
- [ ] PR auf main mit Plan-Deviations (falls vorhanden) im Body
- [ ] Memory-Update + Backlog-Hinweis auf nächsten Sub-C2-Track

## Implementation-Workflow

Reines Direct-Write-Pattern wie V1.7-T7/T8/T9: 1 Production-File-Touch
(`auth.ts`), 1 Helper-Erweiterung (`data-export.ts`), 2 Test-Files.
Kein Subagent-Driven nötig — zu klein. Bei C3 (Audit-Log) lohnt sich
Subagent-Driven wieder.
