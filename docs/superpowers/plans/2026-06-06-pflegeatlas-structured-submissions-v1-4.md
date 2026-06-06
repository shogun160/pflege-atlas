# V1.4 Strukturierte Submissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Submissions-Collection und das `/einreichen`-Formular von 1 freiem `body`-Feld auf typ-abhängige strukturierte Felder umbauen, sodass Vorschläge und Korrekturen zur Articles-Struktur (title + intent + summary + 4 Lexical-Sektionen) passen.

**Architecture:** Vier Schichten: (1) Lexical-Helper-Layer (Sanitize, Normalize, Plain-Text-Render); (2) erweiterte Daten-Schicht (Submissions-Collection mit `proposed*`- und `edited*`-Feldern, Schema-Migration); (3) erweiterte Validation/Action-Schicht (Zod discriminatedUnion, Article-Lookup mit Sektionen, Dirty-Check); (4) Form-Schicht mit lazy-geladenem Lexical-Editor, SectionCheckbox mit Hard-Constraint und type-Switch zwischen NewArticleFields und CorrectionFields. V1.3b-Pipeline (Turnstile, Mail-Adapter, ErrorSummary, controlled inputs, Server-Action-Pattern) wird unverändert wiederverwendet.

**Tech Stack:** Next.js 16, React 19 (Server Actions + `useActionState` + `useFormStatus`), Payload CMS 3.85, Postgres 16, Zod 4 (discriminatedUnion), `lexical` + `@lexical/react` + `@lexical/list` + `@lexical/link`, `@marsidev/react-turnstile` (aus V1.3b), Vitest 4.1, pnpm 10.

**Branch:** `feat/v1-4-structured-submissions` (existiert, Spec ist drauf als `89b1730`).

**Spec-Referenz:** `docs/superpowers/specs/2026-06-06-pflegeatlas-structured-submissions-v1-4-design.md`

**Vorgänger-Lessons explizit beachten:**
1. **Plan-Reihenfolge (V1.3b):** LexicalEditor und SectionCheckbox VOR den Field-Komponenten bauen; Server-Action mit Types VOR SubmissionForm (Form importiert `SubmitState`-Type).
2. **Existing-File-Handling (V1.3a):** README appenden, niemals überschreiben.
3. **Vitest-TDZ-Mocks (V1.3b):** `vi.hoisted(...)` für `vi.mock`-Targets bei Server-only-Modulen.
4. **React 19 form.reset() Race (V1.3b):** Controlled inputs durchgängig, render-time setState-Sync für state.values (NICHT useEffect — Lint-Error).
5. **Security (V1.3b):** Niemals Env-Var-Werte ungefiltert printen.

---

## File Structure

| Pfad | Typ | Zuständigkeit |
|---|---|---|
| `src/lib/lexical-sanitize.ts` | **NEU** | `sanitizeLexicalNode(node)` + `sanitizeLexicalRoot(root)` — Whitelist-basiertes Stripping unerlaubter Node-Types |
| `src/lib/lexical-normalize.ts` | **NEU** | `normalizeLexical(node)` + `isLexicalDirty(a, b)` — interne Lexical-Felder strippen für Dirty-Check |
| `src/lib/lexical-to-plain-text.ts` | **NEU** | `lexicalToPlainText(root)` — rekursiver Walker für Mail-Render |
| `src/lib/submission-schema.ts` | MODIFIZIERT | Discriminated union (`new_article` vs. `correction`), neue Felder, alte `subject`/`body` raus |
| `src/lib/submission-mail.ts` | MODIFIZIERT | `buildSubmissionMail({...})` für beide Pfade, Lexical → Plain-Text-Render pro Sektion |
| `src/collections/Submissions.ts` | MODIFIZIERT | `subject`/`body` raus, `proposed*` und `edited*` rein, `displayTitle`-Hook |
| `src/migrations/<timestamp>_v1_4_structured_submissions.ts` | **NEU** | Auto-generierte Payload-Migration, self-contained gegen leere DB |
| `src/components/LexicalEditor.tsx` | **NEU** | Client-Component, `@lexical/react`-Wrapper, 5-Button-Toolbar, controlled value/onChange (Lexical-JSON-String) |
| `src/components/SectionCheckbox.tsx` | **NEU** | Checkbox + conditional LexicalEditor + Hard-Constraint-Logik + Verwerfen-Button |
| `src/components/NewArticleFields.tsx` | **NEU** | title, intent, summary, 4× LexicalEditor (definition/praxis/risiken/quellen) |
| `src/components/CorrectionFields.tsx` | **NEU** | Article-Dropdown (router.push onChange), 4× SectionCheckbox, correctionReason |
| `src/components/SubmissionForm.tsx` | MODIFIZIERT | Top-Level, type-switch zwischen NewArticleFields und CorrectionFields, Lexical-State |
| `src/app/(frontend)/einreichen/actions.ts` | MODIFIZIERT | Erweiterter `SubmitState`-Type, erweiterte `submitAction` mit Article-Sektion-Lookup, Sanitize, Dirty-Check |
| `src/app/(frontend)/einreichen/page.tsx` | MODIFIZIERT | Neuer `section`-Query-Param, Article-Sektion-Inhalte zusätzlich fetchen wenn `?article=` gesetzt |
| `src/app/(frontend)/artikel/[slug]/page.tsx` | MODIFIZIERT | Pro Sektion ein „Diese Sektion ergänzen oder korrigieren →"-Link mit `?section=<key>` |
| `tests/unit/lexical-sanitize.test.ts` | **NEU** | Whitelist-Pfade, URL-Filter, Text-Format-Bitmask |
| `tests/unit/lexical-normalize.test.ts` | **NEU** | Internals strippen, identical vs. different |
| `tests/unit/lexical-to-plain-text.test.ts` | **NEU** | paragraphs, lists, links rekursiv |
| `tests/unit/submission-schema.test.ts` | MODIFIZIERT | discriminatedUnion-Pfade, optional-Felder, Section-Refine |
| `tests/unit/submission-mail.test.ts` | MODIFIZIERT | Subject + Body für beide Pfade, sektionsweise Render bei correction |
| `tests/integration/submission-action.test.ts` | MODIFIZIERT | Beide happy-paths, Dirty-Check, Sanitize-Pfad, Article-Lookup-Erweiterung |
| `tests/component/SubmissionForm.test.tsx` | MODIFIZIERT | type-Switch, NewArticleFields vs. CorrectionFields, Lexical-Mock |
| `tests/component/NewArticleFields.test.tsx` | **NEU** | 7 Inputs, intent-Default, summary-Counter |
| `tests/component/CorrectionFields.test.tsx` | **NEU** | Article-Dropdown, 4 SectionCheckboxes, router.push-Mock |
| `tests/component/SectionCheckbox.test.tsx` | **NEU** | Hard-Constraint, Verwerfen-Button |
| `tests/component/LexicalEditor.test.tsx` | **NEU** | Smoke-Test (mount, Toolbar-Buttons, onChange) |
| `package.json` | MODIFIZIERT (auto) | `lexical`, `@lexical/react`, `@lexical/list`, `@lexical/link`, `@lexical/utils` durch `pnpm add` |
| `README.md` | MODIFIZIERT (Append) | Kurzer Hinweis im Submission-Abschnitt, dass Form jetzt strukturiert ist |

---

## Setup-Track

V1.4 braucht **keine** externen Services oder neue Secrets (Turnstile-Keys aus V1.3b bleiben). Reiner Code-Track.

---

## Task 1: Dependencies installieren

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (auto durch `pnpm add`)

- [ ] **Step 1:** Branch-Check.

```bash
git status && git branch --show-current
```

Expected: `On branch feat/v1-4-structured-submissions`, working tree clean (außer evtl. Plan-Doc selbst, wenn dieser Task vor Plan-Commit läuft).

- [ ] **Step 2:** Lexical-Pakete installieren.

```bash
pnpm add lexical @lexical/react @lexical/list @lexical/link @lexical/utils
```

- [ ] **Step 3:** Sanity-Check Baseline.

```bash
pnpm test
```

Expected: 70/70 grün (V1.3b-Baseline).

- [ ] **Step 4:** Commit.

```bash
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(v1.4): add lexical packages for public-form rich text editor

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Lexical-Sanitize-Helper mit TDD

**Files:**
- Create: `src/lib/lexical-sanitize.ts`
- Test: `tests/unit/lexical-sanitize.test.ts`

**Zweck:** Server-side Whitelist gegen manipulierte Lexical-JSON-Payloads. Erlaubte Node-Types: `root`, `paragraph`, `text`, `list`, `listitem`, `link`, `linebreak`. Text-Format-Bitmask reduziert auf Bold (1) + Italic (2). Link-URLs gefiltert auf `https:`, `http:`, `mailto:`, `#fragment`, max 2000 Zeichen.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lexical-sanitize.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { sanitizeLexicalRoot } from '@/lib/lexical-sanitize';

function paragraph(text: string, format = 0) {
  return {
    type: 'paragraph',
    version: 1,
    children: [{ type: 'text', version: 1, text, format }],
  };
}

const validRoot = {
  type: 'root',
  version: 1,
  children: [paragraph('Hallo')],
};

describe('sanitizeLexicalRoot', () => {
  it('passes a valid paragraph+text tree through', () => {
    const result = sanitizeLexicalRoot(JSON.parse(JSON.stringify(validRoot)));
    expect(result.type).toBe('root');
    expect(result.children[0].type).toBe('paragraph');
    expect(result.children[0].children[0].type).toBe('text');
    expect(result.children[0].children[0].text).toBe('Hallo');
  });

  it('strips an unknown node type', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        paragraph('keep'),
        { type: 'image', version: 1, src: 'x.png' },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children).toHaveLength(1);
    expect(result.children[0].children[0].text).toBe('keep');
  });

  it('reduces text format bitmask to bold+italic only', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [paragraph('fancy', 0b11111)],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0].children[0].format).toBe(0b11);
  });

  it('passes paragraph + bullet list + listitem through', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'list',
          listType: 'bullet',
          version: 1,
          children: [
            {
              type: 'listitem',
              version: 1,
              children: [{ type: 'text', version: 1, text: 'a', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0].type).toBe('list');
    expect(result.children[0].children[0].type).toBe('listitem');
  });

  it('keeps a https link', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              url: 'https://example.org',
              children: [{ type: 'text', version: 1, text: 'X', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0].children[0].type).toBe('link');
    expect(result.children[0].children[0].url).toBe('https://example.org');
  });

  it('strips a javascript: link', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              url: 'javascript:alert(1)',
              children: [{ type: 'text', version: 1, text: 'evil', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0].children).toHaveLength(0);
  });

  it('strips a data: link', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              url: 'data:text/html,<script>',
              children: [{ type: 'text', version: 1, text: 'evil', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0].children).toHaveLength(0);
  });

  it('keeps a fragment-only link', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              url: '#abschnitt-2',
              children: [{ type: 'text', version: 1, text: 'A', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0].children[0].type).toBe('link');
  });

  it('keeps a mailto link', () => {
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              url: 'mailto:redaktion@pflegeatlas.org',
              children: [{ type: 'text', version: 1, text: 'mail', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0].children[0].type).toBe('link');
  });

  it('strips an over-long URL', () => {
    const longUrl = 'https://example.org/' + 'a'.repeat(2001);
    const input = {
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 1,
              url: longUrl,
              children: [{ type: 'text', version: 1, text: 'long', format: 0 }],
            },
          ],
        },
      ],
    };
    const result = sanitizeLexicalRoot(input);
    expect(result.children[0].children).toHaveLength(0);
  });

  it('returns a minimal empty root for null input', () => {
    const result = sanitizeLexicalRoot(null);
    expect(result.type).toBe('root');
    expect(result.children).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/lexical-sanitize.test.ts
```

Expected: FAIL with `Failed to resolve import "@/lib/lexical-sanitize"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/lexical-sanitize.ts`:

```typescript
const ALLOWED_TYPES = new Set([
  'root',
  'paragraph',
  'text',
  'list',
  'listitem',
  'link',
  'linebreak',
]);

const TEXT_FORMAT_MASK = 0b11; // bold = 1, italic = 2
const URL_REGEX = /^(https?:|mailto:|#)/i;
const URL_MAX = 2000;

export interface LexicalNode {
  type: string;
  version?: number;
  children?: LexicalNode[];
  format?: number;
  url?: string;
  [k: string]: unknown;
}

export interface LexicalRoot extends LexicalNode {
  type: 'root';
  children: LexicalNode[];
}

function sanitizeLexicalNode(node: LexicalNode | null | undefined): LexicalNode | null {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return null;
  if (!ALLOWED_TYPES.has(node.type)) return null;

  if (node.type === 'text') {
    const fmt = typeof node.format === 'number' ? node.format : 0;
    node.format = fmt & TEXT_FORMAT_MASK;
  }

  if (node.type === 'link') {
    const url = typeof node.url === 'string' ? node.url : '';
    if (!URL_REGEX.test(url) || url.length > URL_MAX) return null;
  }

  if (Array.isArray(node.children)) {
    node.children = node.children
      .map((c) => sanitizeLexicalNode(c as LexicalNode))
      .filter((c): c is LexicalNode => c !== null);
  }

  return node;
}

export function sanitizeLexicalRoot(root: LexicalNode | null | undefined): LexicalRoot {
  const sanitized = sanitizeLexicalNode(root);
  if (!sanitized || sanitized.type !== 'root') {
    return { type: 'root', version: 1, children: [] };
  }
  return sanitized as LexicalRoot;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/unit/lexical-sanitize.test.ts
```

Expected: 11 tests passing.

- [ ] **Step 5: Full suite + lint**

```bash
pnpm test && pnpm lint
```

Expected: 81/81 grün (70 baseline + 11 neu), 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/lexical-sanitize.ts tests/unit/lexical-sanitize.test.ts
git commit -m "$(cat <<'EOF'
feat(v1.4): lexical-sanitize helper with whitelist + URL filter

Whitelist node types: root, paragraph, text, list, listitem, link, linebreak.
Text format bitmask reduced to bold+italic. Link URLs filtered to http/https/mailto/#fragment, max 2000 chars.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Lexical-Normalize-Helper mit TDD

**Files:**
- Create: `src/lib/lexical-normalize.ts`
- Test: `tests/unit/lexical-normalize.test.ts`

**Zweck:** Für serverseitigen Dirty-Check bei Korrekturen. Strippt Lexical-Internals (`version`, `key`, `__key`, `__type`), behält semantischen Inhalt + Reihenfolge.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lexical-normalize.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { isLexicalDirty, normalizeLexical } from '@/lib/lexical-normalize';

const para = (text: string) => ({
  type: 'paragraph',
  version: 1,
  children: [{ type: 'text', version: 1, text, format: 0 }],
});

describe('normalizeLexical', () => {
  it('strips version field from a node', () => {
    const normalized = normalizeLexical({
      type: 'paragraph',
      version: 1,
      children: [],
    });
    expect(normalized).not.toHaveProperty('version');
  });

  it('strips key/__key/__type fields', () => {
    const normalized = normalizeLexical({
      type: 'text',
      version: 1,
      key: 'abc',
      __key: 'def',
      __type: 'text',
      text: 'foo',
      format: 0,
    });
    expect(normalized).not.toHaveProperty('key');
    expect(normalized).not.toHaveProperty('__key');
    expect(normalized).not.toHaveProperty('__type');
    expect(normalized?.text).toBe('foo');
  });

  it('recurses into children', () => {
    const normalized = normalizeLexical({
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          key: 'p-key',
          children: [{ type: 'text', version: 1, text: 'x', format: 0 }],
        },
      ],
    });
    expect(normalized?.children[0]).not.toHaveProperty('key');
    expect(normalized?.children[0]).not.toHaveProperty('version');
  });

  it('returns null for null input', () => {
    expect(normalizeLexical(null)).toBeNull();
  });
});

describe('isLexicalDirty', () => {
  it('returns false for identical content', () => {
    const a = { type: 'root', version: 1, children: [para('same')] };
    const b = { type: 'root', version: 1, children: [para('same')] };
    expect(isLexicalDirty(a, b)).toBe(false);
  });

  it('returns true for different text content', () => {
    const a = { type: 'root', version: 1, children: [para('alt')] };
    const b = { type: 'root', version: 1, children: [para('neu')] };
    expect(isLexicalDirty(a, b)).toBe(true);
  });

  it('returns false when only internal version differs', () => {
    const a = { type: 'root', version: 1, children: [para('same')] };
    const b = { type: 'root', version: 99, children: [para('same')] };
    expect(isLexicalDirty(a, b)).toBe(false);
  });

  it('returns false when only internal key differs', () => {
    const a = {
      type: 'root',
      version: 1,
      key: 'root-a',
      children: [para('same')],
    };
    const b = {
      type: 'root',
      version: 1,
      key: 'root-b',
      children: [para('same')],
    };
    expect(isLexicalDirty(a, b)).toBe(false);
  });

  it('preserves children order in compare', () => {
    const a = {
      type: 'root',
      version: 1,
      children: [para('a'), para('b')],
    };
    const b = {
      type: 'root',
      version: 1,
      children: [para('b'), para('a')],
    };
    expect(isLexicalDirty(a, b)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/lexical-normalize.test.ts
```

Expected: FAIL with import resolution error.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/lexical-normalize.ts`:

```typescript
type LexicalLike = {
  type?: string;
  children?: LexicalLike[];
  [k: string]: unknown;
};

const STRIPPED_KEYS = ['version', 'key', '__key', '__type'] as const;

export function normalizeLexical(node: LexicalLike | null | undefined): LexicalLike | null {
  if (!node || typeof node !== 'object') return null;
  const out: LexicalLike = {};
  for (const [k, v] of Object.entries(node)) {
    if ((STRIPPED_KEYS as readonly string[]).includes(k)) continue;
    if (k === 'children' && Array.isArray(v)) {
      out.children = v
        .map((c) => normalizeLexical(c as LexicalLike))
        .filter((c): c is LexicalLike => c !== null);
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function isLexicalDirty(
  edited: LexicalLike | null | undefined,
  original: LexicalLike | null | undefined,
): boolean {
  return JSON.stringify(normalizeLexical(edited)) !== JSON.stringify(normalizeLexical(original));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/unit/lexical-normalize.test.ts
```

Expected: 8 tests passing.

- [ ] **Step 5: Full suite + lint**

```bash
pnpm test && pnpm lint
```

Expected: 89/89 grün, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/lexical-normalize.ts tests/unit/lexical-normalize.test.ts
git commit -m "$(cat <<'EOF'
feat(v1.4): lexical-normalize helper for dirty-check

Strips internal Lexical fields (version, key, __key, __type) so that
two Lexical JSON values can be compared semantically. Used in the server
action's correction-flow dirty-check to detect "no real change".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Lexical-zu-Plain-Text-Helper mit TDD

**Files:**
- Create: `src/lib/lexical-to-plain-text.ts`
- Test: `tests/unit/lexical-to-plain-text.test.ts`

**Zweck:** Mail-Notifications brauchen einen Plain-Text-Render der Lexical-JSON-Inhalte. Walker geht rekursiv durch root → paragraphs/lists/links/text und baut formattierten Plain-Text.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lexical-to-plain-text.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { lexicalToPlainText } from '@/lib/lexical-to-plain-text';

const text = (t: string, format = 0) => ({ type: 'text', text: t, format });
const para = (...children: any[]) => ({ type: 'paragraph', children });

describe('lexicalToPlainText', () => {
  it('renders a single paragraph as plain text', () => {
    const root = { type: 'root', children: [para(text('Hallo Welt'))] };
    expect(lexicalToPlainText(root)).toBe('Hallo Welt');
  });

  it('separates multiple paragraphs with a blank line', () => {
    const root = {
      type: 'root',
      children: [para(text('A')), para(text('B'))],
    };
    expect(lexicalToPlainText(root)).toBe('A\n\nB');
  });

  it('renders a bullet list as "- item"', () => {
    const root = {
      type: 'root',
      children: [
        {
          type: 'list',
          listType: 'bullet',
          children: [
            { type: 'listitem', children: [text('a')] },
            { type: 'listitem', children: [text('b')] },
          ],
        },
      ],
    };
    expect(lexicalToPlainText(root)).toBe('- a\n- b');
  });

  it('renders a numbered list as "N. item"', () => {
    const root = {
      type: 'root',
      children: [
        {
          type: 'list',
          listType: 'number',
          children: [
            { type: 'listitem', children: [text('a')] },
            { type: 'listitem', children: [text('b')] },
          ],
        },
      ],
    };
    expect(lexicalToPlainText(root)).toBe('1. a\n2. b');
  });

  it('renders a link as "text (url)"', () => {
    const root = {
      type: 'root',
      children: [
        para({
          type: 'link',
          url: 'https://example.org',
          children: [text('Quelle')],
        }),
      ],
    };
    expect(lexicalToPlainText(root)).toBe('Quelle (https://example.org)');
  });

  it('renders linebreak as newline', () => {
    const root = {
      type: 'root',
      children: [para(text('Zeile 1'), { type: 'linebreak' }, text('Zeile 2'))],
    };
    expect(lexicalToPlainText(root)).toBe('Zeile 1\nZeile 2');
  });

  it('returns empty string for empty root', () => {
    expect(lexicalToPlainText({ type: 'root', children: [] })).toBe('');
  });

  it('returns empty string for null', () => {
    expect(lexicalToPlainText(null)).toBe('');
  });

  it('handles list and paragraph mixed', () => {
    const root = {
      type: 'root',
      children: [
        para(text('Intro')),
        {
          type: 'list',
          listType: 'bullet',
          children: [{ type: 'listitem', children: [text('punkt')] }],
        },
      ],
    };
    expect(lexicalToPlainText(root)).toBe('Intro\n\n- punkt');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/lexical-to-plain-text.test.ts
```

Expected: FAIL with import resolution error.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/lexical-to-plain-text.ts`:

```typescript
type Node = { type?: string; children?: Node[]; text?: string; url?: string; listType?: string };

function renderInline(nodes: Node[] | undefined): string {
  if (!Array.isArray(nodes)) return '';
  return nodes.map((n) => renderNode(n)).join('');
}

function renderNode(node: Node): string {
  switch (node.type) {
    case 'text':
      return typeof node.text === 'string' ? node.text : '';
    case 'linebreak':
      return '\n';
    case 'link': {
      const inner = renderInline(node.children);
      return node.url ? `${inner} (${node.url})` : inner;
    }
    case 'paragraph':
      return renderInline(node.children);
    case 'listitem':
      return renderInline(node.children);
    default:
      return renderInline(node.children);
  }
}

function renderBlock(node: Node, listIndexRef: { i: number }, parentListType?: string): string {
  if (node.type === 'paragraph') {
    return renderInline(node.children);
  }
  if (node.type === 'list') {
    const items = (node.children ?? []).map((item, idx) => {
      const prefix = node.listType === 'number' ? `${idx + 1}. ` : '- ';
      return `${prefix}${renderInline(item.children)}`;
    });
    return items.join('\n');
  }
  if (node.type === 'listitem' && parentListType) {
    const prefix = parentListType === 'number' ? `${listIndexRef.i}. ` : '- ';
    listIndexRef.i += 1;
    return `${prefix}${renderInline(node.children)}`;
  }
  return renderInline(node.children);
}

export function lexicalToPlainText(root: Node | null | undefined): string {
  if (!root || !Array.isArray(root.children) || root.children.length === 0) return '';
  const listRef = { i: 1 };
  const blocks = root.children.map((child) => renderBlock(child, listRef));
  return blocks.filter((b) => b.length > 0).join('\n\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/unit/lexical-to-plain-text.test.ts
```

Expected: 9 tests passing.

- [ ] **Step 5: Full suite + lint**

```bash
pnpm test && pnpm lint
```

Expected: 98/98 grün, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/lexical-to-plain-text.ts tests/unit/lexical-to-plain-text.test.ts
git commit -m "$(cat <<'EOF'
feat(v1.4): lexical-to-plain-text walker for mail render

Recursive walker that turns Lexical JSON into plain text.
- paragraphs joined with double newline
- bullet list as "- item", numbered list as "1. item / 2. item"
- link as "text (url)"
- linebreak as newline

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Submissions-Collection-Schema umbauen + Migration

**Files:**
- Modify: `src/collections/Submissions.ts`
- Create: `src/migrations/<timestamp>_v1_4_structured_submissions.ts` (auto durch `pnpm payload migrate:create`)
- Test: keine eigenen Tests (Collection-Schema läuft über Payload-Integration-Tests in Task 10)

**Voraussetzung:** Docker Postgres läuft (`docker compose up -d`). Lokale Submissions-Tabelle wird vorher leer gezogen.

- [ ] **Step 1:** Lokale Test-Daten clean cut.

```bash
docker compose exec postgres psql -U pflege -d pflege -c "TRUNCATE submissions CASCADE;"
```

Expected: `TRUNCATE TABLE`.

- [ ] **Step 2:** `src/collections/Submissions.ts` ersetzen mit dem strukturierten Schema.

Replace the full file content with:

```typescript
import type { CollectionConfig } from 'payload';

const SECTIONS = ['definition', 'praxis', 'risiken', 'quellen'] as const;

const conditionNewArticle = (data: Record<string, unknown> | undefined) =>
  data?.type === 'new_article';

const conditionCorrection = (data: Record<string, unknown> | undefined) =>
  data?.type === 'correction';

export const Submissions: CollectionConfig = {
  slug: 'submissions',
  admin: {
    useAsTitle: 'displayTitle',
    defaultColumns: ['displayTitle', 'type', 'reviewStatus', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: () => true,
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => user?.role === 'editor',
  },
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        if (!data) return data;
        if (data.type === 'new_article') {
          data.displayTitle = data.proposedTitle ?? 'Neuer Artikel-Vorschlag';
          return data;
        }
        if (data.type === 'correction') {
          if (data.relatedArticle) {
            try {
              const article = await req.payload.findByID({
                collection: 'articles',
                id: data.relatedArticle,
                depth: 0,
              });
              const title = (article as { title?: string })?.title ?? 'Artikel';
              data.displayTitle = `Korrektur: ${title}`;
            } catch {
              data.displayTitle = 'Korrektur';
            }
          } else {
            data.displayTitle = 'Korrektur';
          }
          return data;
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      label: 'Art',
      required: true,
      options: [
        { label: 'Neuer Artikel-Vorschlag', value: 'new_article' },
        { label: 'Korrekturvorschlag', value: 'correction' },
      ],
    },
    {
      name: 'displayTitle',
      type: 'text',
      label: 'Anzeige-Titel',
      admin: { readOnly: true, description: 'Wird automatisch gesetzt.' },
    },
    {
      name: 'relatedArticle',
      type: 'relationship',
      label: 'Bezogen auf Artikel',
      relationTo: 'articles',
      admin: { condition: conditionCorrection },
    },
    // ====== new_article fields ======
    {
      name: 'proposedTitle',
      type: 'text',
      label: 'Vorgeschlagener Titel',
      admin: { condition: conditionNewArticle },
    },
    {
      name: 'proposedIntent',
      type: 'select',
      label: 'Vorgeschlagener Intent (optional)',
      options: [
        { label: 'Schnelle Hilfe am Bett', value: 'bedside' },
        { label: 'Hintergrundwissen', value: 'background' },
        { label: 'Etwas zum Lernen', value: 'learning' },
      ],
      admin: { condition: conditionNewArticle },
    },
    {
      name: 'proposedSummary',
      type: 'textarea',
      label: 'Vorgeschlagene Kurzbeschreibung (optional, max 280)',
      maxLength: 280,
      admin: { condition: conditionNewArticle },
    },
    ...SECTIONS.map((section) => ({
      name: `proposed${section.charAt(0).toUpperCase()}${section.slice(1)}`,
      type: 'richText' as const,
      label: `Vorgeschlagene Sektion: ${section}`,
      admin: { condition: conditionNewArticle },
    })),
    // ====== correction fields ======
    ...SECTIONS.map((section) => ({
      name: `edited${section.charAt(0).toUpperCase()}${section.slice(1)}`,
      type: 'richText' as const,
      label: `Editierte Sektion: ${section}`,
      admin: { condition: conditionCorrection },
    })),
    {
      name: 'correctionReason',
      type: 'textarea',
      label: 'Begründung der Korrektur (optional)',
      maxLength: 2000,
      admin: { condition: conditionCorrection },
    },
    // ====== common: submitter + review ======
    {
      name: 'submitterName',
      type: 'text',
      label: 'Name (optional)',
    },
    {
      name: 'submitterEmail',
      type: 'email',
      label: 'E-Mail (für Rückfragen, optional)',
    },
    {
      name: 'reviewStatus',
      type: 'select',
      label: 'Review-Status',
      defaultValue: 'pending',
      options: [
        { label: 'Eingegangen', value: 'pending' },
        { label: 'In Review', value: 'in_review' },
        { label: 'Übernommen', value: 'accepted' },
        { label: 'Abgelehnt', value: 'rejected' },
      ],
    },
    {
      name: 'reviewerNotes',
      type: 'textarea',
      label: 'Interne Notizen der Redaktion',
    },
  ],
};
```

- [ ] **Step 3:** Migration erzeugen.

```bash
pnpm payload migrate:create v1_4_structured_submissions
```

Expected: neue Datei unter `src/migrations/<timestamp>_v1_4_structured_submissions.ts` und passende `.json`. Payload generiert die ALTER-Statements basierend auf dem geänderten Schema vs. aktuellem DB-State.

- [ ] **Step 4:** Migration anwenden.

```bash
pnpm payload migrate
```

Expected: Migration läuft sauber, `submissions`-Tabelle hat neue Spalten (`proposed_title`, `proposed_intent`, `proposed_summary`, `proposed_definition`, `proposed_praxis`, `proposed_risiken`, `proposed_quellen`, `edited_definition`, `edited_praxis`, `edited_risiken`, `edited_quellen`, `correction_reason`, `display_title`), alte `subject` und `body` weg.

- [ ] **Step 5:** Self-contained-Check gegen leere DB.

```bash
docker compose exec postgres psql -U pflege -d pflege -c "DROP TABLE IF EXISTS submissions CASCADE; DROP TABLE IF EXISTS payload_migrations CASCADE;"
pnpm payload migrate
```

Expected: alle Migrationen (V1 init + V1.4) laufen sauber gegen leere DB. Wenn ein Schritt rot wird → Migration ist nicht self-contained, V1.2-Lesson neu fixen.

- [ ] **Step 6:** Full test + lint + build

```bash
pnpm test && pnpm lint && pnpm build
```

Expected: 98 tests grün (Schema-Änderung bricht noch keine Tests, weil V1.3b-Tests via Mocks/Stubs laufen), 0 lint errors, build grün. (Manche bestehenden Tests, die `subject`/`body` direkt referenzieren, werden in Task 6 angepasst — sind aktuell aber via Mock-Pattern entkoppelt.)

Falls Tests rot werden, weil bestehende Tests auf `subject`/`body` zugreifen: das ist erwartet. Skip-Markierung mit `it.skip(...)` für diese Tests bis Task 6, dort werden sie umgeschrieben. Vor dem Commit alle Skips dokumentiert.

- [ ] **Step 7: Commit**

```bash
git add src/collections/Submissions.ts src/migrations/
git commit -m "$(cat <<'EOF'
feat(v1.4): restructure Submissions collection to typ-dependent fields

- subject + body removed (clean cut, no production data)
- new_article path: proposedTitle/Intent/Summary + 4 Lexical sections
- correction path: relatedArticle + 4 edited sections + correctionReason
- displayTitle virtual field via beforeChange hook for admin list
- conditional admin visibility per type

Self-contained migration verified against empty DB.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Zod-Schema erweitern (discriminatedUnion)

**Files:**
- Modify: `src/lib/submission-schema.ts`
- Modify: `tests/unit/submission-schema.test.ts`

**Zweck:** Validation für beide Pfade. `new_article` mit 5 Pflichtfeldern + 2 optionalen, `correction` mit Article-Slug + min 1 selectedSection + edited-Inhalt pro selectedSection.

- [ ] **Step 1: Write the new tests (replace existing file content)**

Replace the full content of `tests/unit/submission-schema.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { SubmissionSchema, flattenZodErrors } from '@/lib/submission-schema';

const lexicalSample = JSON.stringify({
  type: 'root',
  version: 1,
  children: [
    {
      type: 'paragraph',
      version: 1,
      children: [{ type: 'text', version: 1, text: 'Inhalt', format: 0 }],
    },
  ],
});

const validNewArticle = {
  type: 'new_article' as const,
  proposedTitle: 'Dekubitusprophylaxe',
  proposedDefinition: lexicalSample,
  proposedPraxis: lexicalSample,
  proposedRisiken: lexicalSample,
  proposedQuellen: lexicalSample,
  turnstileToken: 'test-token',
};

const validCorrection = {
  type: 'correction' as const,
  relatedArticleSlug: 'dekubitus',
  selectedSections: ['praxis' as const],
  editedPraxis: lexicalSample,
  turnstileToken: 'test-token',
};

describe('SubmissionSchema — new_article path', () => {
  it('accepts a valid new_article submission with required fields only', () => {
    const result = SubmissionSchema.safeParse(validNewArticle);
    expect(result.success).toBe(true);
  });

  it('rejects when proposedTitle is too short', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, proposedTitle: 'ab' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(flat.proposedTitle).toMatch(/3 Zeichen/);
    }
  });

  it('rejects when proposedDefinition is missing', () => {
    const { proposedDefinition, ...rest } = validNewArticle;
    const result = SubmissionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('accepts empty proposedIntent (optional)', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, proposedIntent: undefined });
    expect(result.success).toBe(true);
  });

  it('accepts a valid proposedIntent', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, proposedIntent: 'bedside' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid proposedIntent', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, proposedIntent: 'something' });
    expect(result.success).toBe(false);
  });

  it('accepts empty proposedSummary (optional)', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, proposedSummary: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a proposedSummary over 280 chars', () => {
    const result = SubmissionSchema.safeParse({
      ...validNewArticle,
      proposedSummary: 'x'.repeat(281),
    });
    expect(result.success).toBe(false);
  });

  it('accepts an optional submitterEmail when correctly formatted', () => {
    const result = SubmissionSchema.safeParse({
      ...validNewArticle,
      submitterEmail: 'oliver@example.org',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed submitterEmail', () => {
    const result = SubmissionSchema.safeParse({
      ...validNewArticle,
      submitterEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty-string submitterEmail (optional)', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, submitterEmail: '' });
    expect(result.success).toBe(true);
  });
});

describe('SubmissionSchema — correction path', () => {
  it('accepts a valid correction with one section', () => {
    const result = SubmissionSchema.safeParse(validCorrection);
    expect(result.success).toBe(true);
  });

  it('accepts a valid correction with multiple sections', () => {
    const result = SubmissionSchema.safeParse({
      ...validCorrection,
      selectedSections: ['praxis', 'risiken'],
      editedRisiken: lexicalSample,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty selectedSections array', () => {
    const result = SubmissionSchema.safeParse({ ...validCorrection, selectedSections: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(flat.selectedSections).toMatch(/Mindestens/);
    }
  });

  it('rejects when selectedSections includes a section without edited content', () => {
    const result = SubmissionSchema.safeParse({
      ...validCorrection,
      selectedSections: ['praxis', 'risiken'],
      // editedRisiken missing
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing relatedArticleSlug on correction', () => {
    const { relatedArticleSlug, ...rest } = validCorrection;
    const result = SubmissionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid section name in selectedSections', () => {
    const result = SubmissionSchema.safeParse({
      ...validCorrection,
      selectedSections: ['notasection'],
    });
    expect(result.success).toBe(false);
  });

  it('accepts an optional correctionReason', () => {
    const result = SubmissionSchema.safeParse({
      ...validCorrection,
      correctionReason: 'Standard X seit 2025 anders.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a correctionReason over 2000 chars', () => {
    const result = SubmissionSchema.safeParse({
      ...validCorrection,
      correctionReason: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('SubmissionSchema — turnstile + common', () => {
  it('rejects when turnstileToken is missing', () => {
    const { turnstileToken, ...rest } = validNewArticle;
    const result = SubmissionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe('flattenZodErrors', () => {
  it('flattens errors into { fieldName: firstErrorMessage }', () => {
    const result = SubmissionSchema.safeParse({ ...validNewArticle, proposedTitle: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(typeof flat.proposedTitle).toBe('string');
      expect(flat.proposedTitle.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/submission-schema.test.ts
```

Expected: FAIL with multiple type errors / refine errors — current schema is the V1.3b shape.

- [ ] **Step 3: Write the new schema (replace existing file content)**

Replace the full content of `src/lib/submission-schema.ts`:

```typescript
import { z, ZodError } from 'zod';

const Section = z.enum(['definition', 'praxis', 'risiken', 'quellen']);
export type SubmissionSection = z.infer<typeof Section>;

const LexicalJsonString = z
  .string()
  .min(1, 'Inhalt fehlt.')
  .refine(
    (s) => {
      try {
        const parsed = JSON.parse(s);
        return parsed && typeof parsed === 'object' && parsed.type === 'root';
      } catch {
        return false;
      }
    },
    { message: 'Ungültiger Editor-Inhalt.' },
  );

const CommonFields = {
  submitterName: z.string().trim().max(100, 'Maximal 100 Zeichen.').optional(),
  submitterEmail: z
    .string()
    .trim()
    .email('Keine gültige E-Mail-Adresse.')
    .optional()
    .or(z.literal('')),
  turnstileToken: z.string().min(1, 'Captcha-Token fehlt.'),
};

const NewArticleSchema = z.object({
  type: z.literal('new_article'),
  proposedTitle: z
    .string()
    .trim()
    .min(3, 'Bitte mindestens 3 Zeichen.')
    .max(200, 'Maximal 200 Zeichen.'),
  proposedIntent: z.enum(['bedside', 'background', 'learning']).optional(),
  proposedSummary: z
    .string()
    .trim()
    .max(280, 'Maximal 280 Zeichen.')
    .optional()
    .or(z.literal('')),
  proposedDefinition: LexicalJsonString,
  proposedPraxis: LexicalJsonString,
  proposedRisiken: LexicalJsonString,
  proposedQuellen: LexicalJsonString,
  ...CommonFields,
});

const CorrectionSchema = z
  .object({
    type: z.literal('correction'),
    relatedArticleSlug: z.string().trim().min(1, 'Artikel auswählen.'),
    selectedSections: z.array(Section).min(1, 'Mindestens eine Sektion auswählen.'),
    editedDefinition: LexicalJsonString.optional(),
    editedPraxis: LexicalJsonString.optional(),
    editedRisiken: LexicalJsonString.optional(),
    editedQuellen: LexicalJsonString.optional(),
    correctionReason: z.string().trim().max(2000, 'Maximal 2000 Zeichen.').optional(),
    ...CommonFields,
  })
  .refine(
    (data) =>
      data.selectedSections.every((s) => {
        const key = `edited${s.charAt(0).toUpperCase()}${s.slice(1)}` as keyof typeof data;
        return typeof data[key] === 'string' && (data[key] as string).length > 0;
      }),
    {
      path: ['selectedSections'],
      message: 'Editor-Inhalt fehlt für eine ausgewählte Sektion.',
    },
  );

export const SubmissionSchema = z.discriminatedUnion('type', [NewArticleSchema, CorrectionSchema]);

export type SubmissionInput = z.infer<typeof SubmissionSchema>;

export function flattenZodErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? '_root';
    if (!out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/unit/submission-schema.test.ts
```

Expected: all 20 new tests passing.

- [ ] **Step 5: Full suite + lint**

```bash
pnpm test && pnpm lint
```

Expected: ~108 tests grün. **Erwarteter Bruch:** `tests/integration/submission-action.test.ts` und `tests/component/SubmissionForm.test.tsx` brechen, weil sie auf das alte Schema (`subject`/`body`) bauen. Beide werden in Task 10 bzw. Task 12 umgeschrieben. Für jetzt mit `it.skip(...)` auf den V1.3b-Test-Cases markieren und Skip-Begründung im Test-Body als Kommentar dokumentieren.

- [ ] **Step 6: Commit**

```bash
git add src/lib/submission-schema.ts tests/unit/submission-schema.test.ts tests/integration/submission-action.test.ts tests/component/SubmissionForm.test.tsx
git commit -m "$(cat <<'EOF'
feat(v1.4): rewrite submission-schema as discriminatedUnion

- new_article path: 5 required content fields (title + 4 Lexical sections), intent + summary optional
- correction path: relatedArticleSlug + selectedSections (min 1) + per-section edited Lexical content + optional reason
- common: submitterName/Email optional, turnstileToken required
- LexicalJsonString validator parses JSON and checks root type

Tests in submission-action.test.ts and SubmissionForm.test.tsx skipped here, will be rewritten in T10/T12.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Submission-Mail-Template erweitern mit TDD

**Files:**
- Modify: `src/lib/submission-mail.ts`
- Modify: `tests/unit/submission-mail.test.ts`

**Zweck:** Subject dynamisch je type, Body bei `new_article` mit allen 4 Sektionen, bei `correction` nur mit gewählten Sektionen + Reason + Article-Admin-Link.

- [ ] **Step 1: Read current file structure (so refactor is targeted)**

```bash
cat src/lib/submission-mail.ts
```

- [ ] **Step 2: Write the new tests (replace existing file content)**

Replace the full content of `tests/unit/submission-mail.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildSubmissionMail } from '@/lib/submission-mail';

const lexical = (text: string) =>
  JSON.stringify({
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text, format: 0 }],
      },
    ],
  });

describe('buildSubmissionMail — new_article', () => {
  it('uses proposedTitle in subject', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'new_article',
        proposedTitle: 'Dekubitusprophylaxe',
        proposedDefinition: lexical('Definition…'),
        proposedPraxis: lexical('Praxis…'),
        proposedRisiken: lexical('Risiken…'),
        proposedQuellen: lexical('Quellen…'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.subject).toContain('Neuer Artikel-Vorschlag');
    expect(mail.subject).toContain('Dekubitusprophylaxe');
  });

  it('renders all four sections in body', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'new_article',
        proposedTitle: 'X',
        proposedDefinition: lexical('Def-Text'),
        proposedPraxis: lexical('Prax-Text'),
        proposedRisiken: lexical('Risi-Text'),
        proposedQuellen: lexical('Quel-Text'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('Definition');
    expect(mail.text).toContain('Def-Text');
    expect(mail.text).toContain('Praxis');
    expect(mail.text).toContain('Prax-Text');
    expect(mail.text).toContain('Risiken');
    expect(mail.text).toContain('Risi-Text');
    expect(mail.text).toContain('Quellen');
    expect(mail.text).toContain('Quel-Text');
  });

  it('renders placeholder when intent or summary missing', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'new_article',
        proposedTitle: 'X',
        proposedDefinition: lexical('a'),
        proposedPraxis: lexical('a'),
        proposedRisiken: lexical('a'),
        proposedQuellen: lexical('a'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('Intent: — offen');
    expect(mail.text).toContain('Summary: — offen');
  });
});

describe('buildSubmissionMail — correction', () => {
  it('uses article title in subject', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'correction',
        selectedSections: ['praxis'],
        editedPraxis: lexical('Neuer Praxis-Text'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      articleTitle: 'Dekubitus',
      articleId: 42,
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.subject).toContain('Korrektur');
    expect(mail.subject).toContain('Dekubitus');
  });

  it('renders only selected sections', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'correction',
        selectedSections: ['praxis'],
        editedPraxis: lexical('PRAX-NEU'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      articleTitle: 'A',
      articleId: 1,
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('Praxis');
    expect(mail.text).toContain('PRAX-NEU');
    expect(mail.text).not.toContain('Risiken (neuer Stand)');
    expect(mail.text).not.toContain('Quellen (neuer Stand)');
    expect(mail.text).not.toContain('Definition (neuer Stand)');
  });

  it('includes article admin link', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '5',
        type: 'correction',
        selectedSections: ['praxis'],
        editedPraxis: lexical('x'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      articleTitle: 'A',
      articleId: 7,
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('http://localhost:3000/admin/collections/articles/7');
  });

  it('includes correctionReason when present', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '5',
        type: 'correction',
        selectedSections: ['praxis'],
        editedPraxis: lexical('x'),
        correctionReason: 'Standard X seit 2025 anders.',
        createdAt: '2026-06-06T12:00:00Z',
      },
      articleTitle: 'A',
      articleId: 7,
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('Standard X seit 2025 anders.');
  });

  it('shows „— keine —" placeholder when no correctionReason', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '5',
        type: 'correction',
        selectedSections: ['praxis'],
        editedPraxis: lexical('x'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      articleTitle: 'A',
      articleId: 7,
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('— keine —');
  });
});

describe('buildSubmissionMail — common', () => {
  it('shows submitterEmail when provided', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'new_article',
        proposedTitle: 'X',
        proposedDefinition: lexical('a'),
        proposedPraxis: lexical('a'),
        proposedRisiken: lexical('a'),
        proposedQuellen: lexical('a'),
        submitterName: 'Anna',
        submitterEmail: 'anna@example.org',
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('Anna');
    expect(mail.text).toContain('anna@example.org');
  });

  it('shows „anonym" placeholder when submitterName missing', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'new_article',
        proposedTitle: 'X',
        proposedDefinition: lexical('a'),
        proposedPraxis: lexical('a'),
        proposedRisiken: lexical('a'),
        proposedQuellen: lexical('a'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('anonym');
  });

  it('includes submission admin link', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '42',
        type: 'new_article',
        proposedTitle: 'X',
        proposedDefinition: lexical('a'),
        proposedPraxis: lexical('a'),
        proposedRisiken: lexical('a'),
        proposedQuellen: lexical('a'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.text).toContain('http://localhost:3000/admin/collections/submissions/42');
  });

  it('uses redaktion@pflegeatlas.org as to address', () => {
    const mail = buildSubmissionMail({
      submission: {
        id: '1',
        type: 'new_article',
        proposedTitle: 'X',
        proposedDefinition: lexical('a'),
        proposedPraxis: lexical('a'),
        proposedRisiken: lexical('a'),
        proposedQuellen: lexical('a'),
        createdAt: '2026-06-06T12:00:00Z',
      },
      adminUrl: 'http://localhost:3000',
    });
    expect(mail.to).toBe('redaktion@pflegeatlas.org');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/submission-mail.test.ts
```

Expected: FAIL — old `buildSubmissionMail` signature doesn't match.

- [ ] **Step 4: Write the new implementation (replace existing file content)**

Replace the full content of `src/lib/submission-mail.ts`:

```typescript
import { lexicalToPlainText } from './lexical-to-plain-text';

export type SubmissionMailInput =
  | {
      id: string;
      type: 'new_article';
      proposedTitle: string;
      proposedIntent?: string;
      proposedSummary?: string;
      proposedDefinition: string;
      proposedPraxis: string;
      proposedRisiken: string;
      proposedQuellen: string;
      submitterName?: string;
      submitterEmail?: string;
      createdAt: string;
    }
  | {
      id: string;
      type: 'correction';
      selectedSections: Array<'definition' | 'praxis' | 'risiken' | 'quellen'>;
      editedDefinition?: string;
      editedPraxis?: string;
      editedRisiken?: string;
      editedQuellen?: string;
      correctionReason?: string;
      submitterName?: string;
      submitterEmail?: string;
      createdAt: string;
    };

interface BuildArgs {
  submission: SubmissionMailInput;
  articleTitle?: string;
  articleId?: number;
  adminUrl: string;
}

interface BuiltMail {
  to: string;
  from?: string;
  subject: string;
  text: string;
}

const SECTION_LABELS = {
  definition: 'Definition',
  praxis: 'Praxis',
  risiken: 'Risiken',
  quellen: 'Quellen',
} as const;

function safeRender(jsonString: string | undefined): string {
  if (!jsonString) return '';
  try {
    return lexicalToPlainText(JSON.parse(jsonString));
  } catch {
    return '';
  }
}

function renderSubmitterLine(s: SubmissionMailInput): string {
  const name = s.submitterName?.trim() || 'anonym';
  const email = s.submitterEmail?.trim() || '—';
  return `Eingereicht von: ${name} <${email}>`;
}

function buildNewArticleBody(s: Extract<SubmissionMailInput, { type: 'new_article' }>, adminUrl: string): string {
  const lines: string[] = [];
  lines.push('Neuer Artikel-Vorschlag');
  lines.push('');
  lines.push(`Titel: ${s.proposedTitle}`);
  lines.push(`Intent: ${s.proposedIntent ?? '— offen, von Redaktion zu setzen —'}`);
  lines.push(`Summary: ${s.proposedSummary?.trim() || '— offen —'}`);
  lines.push('');
  for (const section of ['definition', 'praxis', 'risiken', 'quellen'] as const) {
    const key = `proposed${section.charAt(0).toUpperCase()}${section.slice(1)}` as
      | 'proposedDefinition'
      | 'proposedPraxis'
      | 'proposedRisiken'
      | 'proposedQuellen';
    lines.push(`--- ${SECTION_LABELS[section]} ---`);
    lines.push(safeRender(s[key]));
    lines.push('');
  }
  lines.push('—');
  lines.push(renderSubmitterLine(s));
  lines.push(`Submission-ID: ${s.id}`);
  lines.push(`Admin-Link: ${adminUrl}/admin/collections/submissions/${s.id}`);
  return lines.join('\n');
}

function buildCorrectionBody(
  s: Extract<SubmissionMailInput, { type: 'correction' }>,
  articleTitle: string,
  articleId: number,
  adminUrl: string,
): string {
  const lines: string[] = [];
  lines.push('Korrekturvorschlag');
  lines.push('');
  lines.push(`Artikel: ${articleTitle}`);
  lines.push(`Article-Admin-Link: ${adminUrl}/admin/collections/articles/${articleId}`);
  lines.push(`Sektionen mit Änderungen: ${s.selectedSections.join(', ')}`);
  lines.push('');
  lines.push('Begründung:');
  lines.push(s.correctionReason?.trim() || '— keine —');
  lines.push('');
  for (const section of s.selectedSections) {
    const key = `edited${section.charAt(0).toUpperCase()}${section.slice(1)}` as
      | 'editedDefinition'
      | 'editedPraxis'
      | 'editedRisiken'
      | 'editedQuellen';
    lines.push(`--- ${SECTION_LABELS[section]} (neuer Stand) ---`);
    lines.push(safeRender(s[key]));
    lines.push('');
  }
  lines.push('—');
  lines.push(renderSubmitterLine(s));
  lines.push(`Submission-ID: ${s.id}`);
  lines.push(`Admin-Link: ${adminUrl}/admin/collections/submissions/${s.id}`);
  return lines.join('\n');
}

export function buildSubmissionMail({ submission, articleTitle, articleId, adminUrl }: BuildArgs): BuiltMail {
  const to = 'redaktion@pflegeatlas.org';
  if (submission.type === 'new_article') {
    return {
      to,
      subject: `[PflegeAtlas] Neuer Artikel-Vorschlag: "${submission.proposedTitle}"`,
      text: buildNewArticleBody(submission, adminUrl),
    };
  }
  return {
    to,
    subject: `[PflegeAtlas] Korrektur: "${articleTitle ?? 'Artikel'}"`,
    text: buildCorrectionBody(submission, articleTitle ?? 'Artikel', articleId ?? 0, adminUrl),
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm vitest run tests/unit/submission-mail.test.ts
```

Expected: 14 tests passing.

- [ ] **Step 6: Full suite + lint**

```bash
pnpm test && pnpm lint
```

Expected: ~122 tests grün (Schemas + Mail + Helpers), submission-action.test.ts noch skipped (Task 10).

- [ ] **Step 7: Commit**

```bash
git add src/lib/submission-mail.ts tests/unit/submission-mail.test.ts
git commit -m "$(cat <<'EOF'
feat(v1.4): rebuild submission-mail for structured submissions

- new_article: subject with proposedTitle, body renders all 4 Lexical sections via plain-text walker
- correction: subject with article title, body renders only selectedSections, includes article admin link, correctionReason
- common: anonymous fallback, submission admin link, redaktion@pflegeatlas.org as to

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: LexicalEditor-Component

**Files:**
- Create: `src/components/LexicalEditor.tsx`
- Create: `tests/component/LexicalEditor.test.tsx`

**Zweck:** Wrapper um `@lexical/react` mit reduzierter Toolbar (Bold, Italic, Bullet-List, Numbered-List, Link). Controlled `value` (Lexical-JSON-String) + `onChange`. Lazy-loaded im Konsumenten.

**Wichtig:** LexicalEditor selbst exportieren als named-export `LexicalEditor`. Konsumenten (`NewArticleFields`, `SectionCheckbox`) importieren via `dynamic({ ssr: false })`.

- [ ] **Step 1: Write the failing component smoke test**

Create `tests/component/LexicalEditor.test.tsx`:

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LexicalEditor } from '@/components/LexicalEditor';

const emptyRoot = JSON.stringify({
  type: 'root',
  version: 1,
  children: [],
});

describe('LexicalEditor', () => {
  it('mounts without crashing', () => {
    render(<LexicalEditor value={emptyRoot} onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders 5 toolbar buttons', () => {
    render(<LexicalEditor value={emptyRoot} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /fett/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kursiv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aufzählung/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nummerierte/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /link/i })).toBeInTheDocument();
  });

  it('shows placeholder when provided', () => {
    render(
      <LexicalEditor value={emptyRoot} onChange={() => {}} placeholder="Hier deine Beschreibung…" />,
    );
    expect(screen.getByText('Hier deine Beschreibung…')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/component/LexicalEditor.test.tsx
```

Expected: FAIL with `Failed to resolve import "@/components/LexicalEditor"`.

- [ ] **Step 3: Implement the LexicalEditor component**

Create `src/components/LexicalEditor.tsx`:

```typescript
'use client';

import { useEffect } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ListNode, ListItemNode, INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from '@lexical/list';
import { LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $getRoot, FORMAT_TEXT_COMMAND, type EditorState } from 'lexical';

interface Props {
  value: string;
  onChange: (json: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const initialConfig = {
  namespace: 'PflegeAtlasSubmissionEditor',
  onError: (err: Error) => {
    console.error('Lexical error', err);
  },
  nodes: [ListNode, ListItemNode, LinkNode],
  theme: {
    paragraph: 'mb-2',
    list: {
      ul: 'list-disc pl-6',
      ol: 'list-decimal pl-6',
    },
    text: {
      bold: 'font-bold',
      italic: 'italic',
    },
    link: 'text-brand underline',
  },
};

function Toolbar() {
  const [editor] = useLexicalComposerContext();
  return (
    <div className="flex gap-2 border-b border-rule pb-2 mb-2">
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        className="px-2 py-1 rounded hover:bg-surface font-bold"
        aria-label="Fett"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        className="px-2 py-1 rounded hover:bg-surface italic"
        aria-label="Kursiv"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
        className="px-2 py-1 rounded hover:bg-surface"
        aria-label="Aufzählung"
      >
        •
      </button>
      <button
        type="button"
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
        className="px-2 py-1 rounded hover:bg-surface"
        aria-label="Nummerierte Liste"
      >
        1.
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('Link-URL (https://, mailto: oder #fragment)');
          if (url) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
        }}
        className="px-2 py-1 rounded hover:bg-surface"
        aria-label="Link einfügen"
      >
        🔗
      </button>
    </div>
  );
}

function ValueSyncPlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    try {
      const parsed = JSON.parse(value);
      const current = editor.getEditorState().toJSON();
      if (JSON.stringify(current) === JSON.stringify(parsed)) return;
      const newState = editor.parseEditorState(value);
      editor.setEditorState(newState);
    } catch {
      // ignore invalid JSON; editor stays in current state
    }
  }, [value, editor]);
  return null;
}

export function LexicalEditor({ value, onChange, placeholder, ariaLabel }: Props) {
  const config = {
    ...initialConfig,
    editorState: (() => {
      try {
        const parsed = JSON.parse(value);
        if (parsed && parsed.type === 'root') return value;
      } catch {
        // fallthrough
      }
      return undefined;
    })(),
  };

  const handleChange = (editorState: EditorState) => {
    const json = JSON.stringify(editorState.toJSON());
    onChange(json);
  };

  return (
    <div className="border border-rule rounded-md p-3 bg-white">
      <LexicalComposer initialConfig={config}>
        <Toolbar />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                role="textbox"
                aria-label={ariaLabel ?? 'Rich-Text-Editor'}
                className="min-h-[120px] outline-none"
              />
            }
            placeholder={
              placeholder ? <div className="pointer-events-none absolute top-0 text-ink-muted">{placeholder}</div> : null
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <OnChangePlugin onChange={handleChange} />
          <ValueSyncPlugin value={value} />
        </div>
      </LexicalComposer>
    </div>
  );
}

export function emptyLexicalJson(): string {
  return JSON.stringify({
    root: {
      children: [
        {
          children: [],
          direction: null,
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/component/LexicalEditor.test.tsx
```

Expected: 3 tests passing. If jsdom complains about missing browser APIs Lexical uses, see Step 5 for stubs.

- [ ] **Step 5: jsdom-Compat fixes (if needed)**

Lexical uses `Range`/`Selection` APIs that jsdom partially supports. If a test errors with `getBoundingClientRect` or selection-related errors, add minimal stubs at the top of the test file:

```typescript
beforeAll(() => {
  if (typeof window !== 'undefined' && !window.Range.prototype.getBoundingClientRect) {
    window.Range.prototype.getBoundingClientRect = () =>
      ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => {} } as DOMRect);
  }
  if (typeof window !== 'undefined' && !window.Range.prototype.getClientRects) {
    window.Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} } as any);
  }
});
```

Re-run tests.

- [ ] **Step 6: Full suite + lint**

```bash
pnpm test && pnpm lint
```

Expected: ~125 tests grün. Submission-action + SubmissionForm tests still skipped.

- [ ] **Step 7: Commit**

```bash
git add src/components/LexicalEditor.tsx tests/component/LexicalEditor.test.tsx
git commit -m "$(cat <<'EOF'
feat(v1.4): LexicalEditor wrapper with reduced 5-button toolbar

Wraps @lexical/react with Bold/Italic/Bullet/Numbered/Link toolbar.
Controlled value/onChange surface using Lexical JSON string at the boundary.
emptyLexicalJson() helper for initial-state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: SectionCheckbox-Component mit Hard-Constraint

**Files:**
- Create: `src/components/SectionCheckbox.tsx`
- Create: `tests/component/SectionCheckbox.test.tsx`

**Zweck:** Checkbox + bedingt darunter LexicalEditor. Wenn dirty (current ≠ original Lexical JSON) und User wählt ab: Click wird abgewiesen, Inline-Warnung + Verwerfen-Button erscheinen.

- [ ] **Step 1: Write the failing tests**

Create `tests/component/SectionCheckbox.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionCheckbox } from '@/components/SectionCheckbox';

vi.mock('@/components/LexicalEditor', () => ({
  LexicalEditor: ({ value, onChange, ariaLabel }: { value: string; onChange: (s: string) => void; ariaLabel?: string }) => (
    <textarea
      role="textbox"
      aria-label={ariaLabel ?? 'mock-editor'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  emptyLexicalJson: () =>
    JSON.stringify({ type: 'root', version: 1, children: [] }),
}));

const originalLexical = JSON.stringify({
  type: 'root',
  version: 1,
  children: [
    {
      type: 'paragraph',
      version: 1,
      children: [{ type: 'text', version: 1, text: 'Original', format: 0 }],
    },
  ],
});

describe('SectionCheckbox', () => {
  it('renders unchecked + hidden editor by default', () => {
    render(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue=""
        onChange={() => {}}
        onCheckedChange={() => {}}
        checked={false}
      />,
    );
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows editor when checked', () => {
    render(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue={originalLexical}
        onChange={() => {}}
        onCheckedChange={() => {}}
        checked
      />,
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('allows unchecking when current equals original (clean)', () => {
    const onCheckedChange = vi.fn();
    render(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue={originalLexical}
        onChange={() => {}}
        onCheckedChange={onCheckedChange}
        checked
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it('blocks unchecking when current differs from original (dirty) and shows warning', () => {
    const onCheckedChange = vi.fn();
    const editedLexical = JSON.stringify({
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', version: 1, text: 'GEÄNDERT', format: 0 }],
        },
      ],
    });
    render(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue={editedLexical}
        onChange={() => {}}
        onCheckedChange={onCheckedChange}
        checked
      />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/enthält Änderungen/i);
  });

  it('shows the Verwerfen button only when dirty', () => {
    const editedLexical = JSON.stringify({
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', version: 1, text: 'GEÄNDERT', format: 0 }],
        },
      ],
    });
    const { rerender } = render(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue={originalLexical}
        onChange={() => {}}
        onCheckedChange={() => {}}
        checked
      />,
    );
    expect(screen.queryByRole('button', { name: /verwerfen/i })).not.toBeInTheDocument();
    rerender(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue={editedLexical}
        onChange={() => {}}
        onCheckedChange={() => {}}
        checked
      />,
    );
    expect(screen.getByRole('button', { name: /verwerfen/i })).toBeInTheDocument();
  });

  it('Verwerfen click resets editor and unchecks', () => {
    const onCheckedChange = vi.fn();
    const onChange = vi.fn();
    const editedLexical = JSON.stringify({
      type: 'root',
      version: 1,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', version: 1, text: 'GEÄNDERT', format: 0 }],
        },
      ],
    });
    render(
      <SectionCheckbox
        sectionKey="praxis"
        label="Praxis"
        originalValue={originalLexical}
        currentValue={editedLexical}
        onChange={onChange}
        onCheckedChange={onCheckedChange}
        checked
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /verwerfen/i }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/component/SectionCheckbox.test.tsx
```

Expected: FAIL with import resolution error.

- [ ] **Step 3: Write the SectionCheckbox component**

Create `src/components/SectionCheckbox.tsx`:

```typescript
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { isLexicalDirty } from '@/lib/lexical-normalize';

const LexicalEditor = dynamic(() => import('@/components/LexicalEditor').then((m) => m.LexicalEditor), {
  ssr: false,
  loading: () => <div className="text-ink-muted">Editor lädt…</div>,
});

interface Props {
  sectionKey: 'definition' | 'praxis' | 'risiken' | 'quellen';
  label: string;
  originalValue: string;
  currentValue: string;
  onChange: (json: string) => void;
  onCheckedChange: (checked: boolean) => void;
  checked: boolean;
}

function isDirty(current: string, original: string): boolean {
  if (!current) return false;
  try {
    const c = JSON.parse(current);
    const o = JSON.parse(original);
    return isLexicalDirty(c, o);
  } catch {
    return current !== original;
  }
}

export function SectionCheckbox({
  sectionKey,
  label,
  originalValue,
  currentValue,
  onChange,
  onCheckedChange,
  checked,
}: Props) {
  const [warning, setWarning] = useState<string | null>(null);
  const dirty = checked && isDirty(currentValue, originalValue);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    if (!next && dirty) {
      e.preventDefault();
      setWarning(
        'Diese Sektion enthält Änderungen. Klicke „Verwerfen", um die Sektion zu entfernen.',
      );
      return;
    }
    setWarning(null);
    if (next && !checked) {
      // Vorladen mit Original beim Anhaken
      onChange(originalValue);
    }
    onCheckedChange(next);
  };

  const handleDiscard = () => {
    onChange('');
    onCheckedChange(false);
    setWarning(null);
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 font-semibold">
        <input
          type="checkbox"
          name="selectedSections"
          value={sectionKey}
          checked={checked}
          onChange={handleCheckboxChange}
          className="h-4 w-4"
        />
        {label}
      </label>
      {warning && (
        <p role="alert" className="text-sm text-accent">
          {warning}
        </p>
      )}
      {checked && (
        <>
          <LexicalEditor
            value={currentValue || originalValue}
            onChange={onChange}
            ariaLabel={`Editor für ${label}`}
          />
          {dirty && (
            <button
              type="button"
              onClick={handleDiscard}
              className="text-sm text-accent underline"
            >
              Verwerfen
            </button>
          )}
        </>
      )}
      <input
        type="hidden"
        name={`edited${sectionKey.charAt(0).toUpperCase()}${sectionKey.slice(1)}`}
        value={checked && dirty ? currentValue : ''}
        readOnly
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/component/SectionCheckbox.test.tsx
```

Expected: 6 tests passing.

- [ ] **Step 5: Full suite + lint**

```bash
pnpm test && pnpm lint
```

Expected: ~131 tests grün.

- [ ] **Step 6: Commit**

```bash
git add src/components/SectionCheckbox.tsx tests/component/SectionCheckbox.test.tsx
git commit -m "$(cat <<'EOF'
feat(v1.4): SectionCheckbox with hard-constraint dirty-check

Checkbox + conditional LexicalEditor with original content preloaded.
- Uncheck-click is blocked when editor content differs from original (dirty)
- Inline warning appears with role=alert
- Verwerfen button visible only when dirty, resets editor + unchecks in one step

Hidden inputs (name=selectedSections multi-value + name=editedXxx) for FormData.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Server-Action erweitern (Types + Implementation)

**Files:**
- Modify: `src/app/(frontend)/einreichen/actions.ts`
- Modify: `tests/integration/submission-action.test.ts`

**Zweck:** Server-Action für beide Pfade. SubmitState-Type vor SubmissionForm verfügbar (Lesson V1.3b). Article-Lookup bei correction lädt alle 4 Sektionen für Dirty-Check.

- [ ] **Step 1: Write the new integration tests (replace existing file content)**

Replace the full content of `tests/integration/submission-action.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockCreate, mockFindByID, mockFind, mockSendEmail, mockVerify, mockRedirect } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindByID: vi.fn(),
  mockFind: vi.fn(),
  mockSendEmail: vi.fn(),
  mockVerify: vi.fn(),
  mockRedirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/lib/payload', () => ({
  getPayloadClient: async () => ({
    create: mockCreate,
    findByID: mockFindByID,
    find: mockFind,
    sendEmail: mockSendEmail,
  }),
}));

vi.mock('@/lib/turnstile', () => ({
  verifyTurnstileToken: mockVerify,
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

import { submitAction } from '@/app/(frontend)/einreichen/actions';

const lexicalSample = JSON.stringify({
  type: 'root',
  version: 1,
  children: [
    {
      type: 'paragraph',
      version: 1,
      children: [{ type: 'text', version: 1, text: 'X', format: 0 }],
    },
  ],
});

const editedLexical = JSON.stringify({
  type: 'root',
  version: 1,
  children: [
    {
      type: 'paragraph',
      version: 1,
      children: [{ type: 'text', version: 1, text: 'EDITIERT', format: 0 }],
    },
  ],
});

function formDataFrom(obj: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      for (const item of v) fd.append(k, item);
    } else {
      fd.append(k, v);
    }
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerify.mockResolvedValue(true);
  mockCreate.mockResolvedValue({ id: 42, createdAt: '2026-06-06T12:00:00Z' });
});

describe('submitAction — new_article happy path', () => {
  it('creates submission, sends mail, redirects to /einreichen/danke', async () => {
    const fd = formDataFrom({
      type: 'new_article',
      proposedTitle: 'Dekubitusprophylaxe',
      proposedDefinition: lexicalSample,
      proposedPraxis: lexicalSample,
      proposedRisiken: lexicalSample,
      proposedQuellen: lexicalSample,
      turnstileToken: 'ok',
    });

    await expect(submitAction({}, fd)).rejects.toThrow('NEXT_REDIRECT');
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith('/einreichen/danke');
    const createArgs = mockCreate.mock.calls[0][0];
    expect(createArgs.collection).toBe('submissions');
    expect(createArgs.data.type).toBe('new_article');
    expect(createArgs.data.proposedTitle).toBe('Dekubitusprophylaxe');
  });
});

describe('submitAction — correction happy path', () => {
  beforeEach(() => {
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 7,
          title: 'Dekubitus',
          definition: JSON.parse(lexicalSample),
          praxis: JSON.parse(lexicalSample),
          risiken: JSON.parse(lexicalSample),
          quellen: JSON.parse(lexicalSample),
        },
      ],
    });
  });

  it('accepts correction with one edited section', async () => {
    const fd = formDataFrom({
      type: 'correction',
      relatedArticleSlug: 'dekubitus',
      selectedSections: ['praxis'],
      editedPraxis: editedLexical,
      turnstileToken: 'ok',
    });

    await expect(submitAction({}, fd)).rejects.toThrow('NEXT_REDIRECT');
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith('/einreichen/danke');
    const createArgs = mockCreate.mock.calls[0][0];
    expect(createArgs.data.type).toBe('correction');
    expect(createArgs.data.relatedArticle).toBe(7);
    expect(createArgs.data.editedPraxis).toBeDefined();
  });

  it('accepts correction with multiple edited sections', async () => {
    const fd = formDataFrom({
      type: 'correction',
      relatedArticleSlug: 'dekubitus',
      selectedSections: ['praxis', 'risiken'],
      editedPraxis: editedLexical,
      editedRisiken: editedLexical,
      turnstileToken: 'ok',
    });

    await expect(submitAction({}, fd)).rejects.toThrow('NEXT_REDIRECT');
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

describe('submitAction — correction validation failures', () => {
  beforeEach(() => {
    mockFind.mockResolvedValue({
      docs: [
        {
          id: 7,
          title: 'Dekubitus',
          definition: JSON.parse(lexicalSample),
          praxis: JSON.parse(lexicalSample),
          risiken: JSON.parse(lexicalSample),
          quellen: JSON.parse(lexicalSample),
        },
      ],
    });
  });

  it('rejects when edited content equals original (no changes)', async () => {
    const fd = formDataFrom({
      type: 'correction',
      relatedArticleSlug: 'dekubitus',
      selectedSections: ['praxis'],
      editedPraxis: lexicalSample, // identical to original
      turnstileToken: 'ok',
    });

    const result = await submitAction({}, fd);
    expect(result.fieldErrors?.editedPraxis).toMatch(/Keine Änderungen/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects when article slug not found', async () => {
    mockFind.mockResolvedValueOnce({ docs: [] });
    const fd = formDataFrom({
      type: 'correction',
      relatedArticleSlug: 'unbekannt',
      selectedSections: ['praxis'],
      editedPraxis: editedLexical,
      turnstileToken: 'ok',
    });

    const result = await submitAction({}, fd);
    expect(result.fieldErrors?.relatedArticleSlug).toMatch(/nicht gefunden/);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('submitAction — turnstile + values preservation', () => {
  it('returns state.error when turnstile fails', async () => {
    mockVerify.mockResolvedValueOnce(false);
    const fd = formDataFrom({
      type: 'new_article',
      proposedTitle: 'Title',
      proposedDefinition: lexicalSample,
      proposedPraxis: lexicalSample,
      proposedRisiken: lexicalSample,
      proposedQuellen: lexicalSample,
      turnstileToken: 'bad',
    });

    const result = await submitAction({}, fd);
    expect(result.error).toMatch(/Captcha/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('preserves submitted values on fieldErrors', async () => {
    const fd = formDataFrom({
      type: 'new_article',
      proposedTitle: 'ab', // too short
      proposedDefinition: lexicalSample,
      proposedPraxis: lexicalSample,
      proposedRisiken: lexicalSample,
      proposedQuellen: lexicalSample,
      submitterName: 'Anna',
      turnstileToken: 'ok',
    });

    const result = await submitAction({}, fd);
    expect(result.values?.proposedTitle).toBe('ab');
    expect(result.values?.submitterName).toBe('Anna');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/integration/submission-action.test.ts
```

Expected: FAIL — old action signature doesn't match new SubmitState/types.

- [ ] **Step 3: Write the new action (replace existing file content)**

Replace the full content of `src/app/(frontend)/einreichen/actions.ts`:

```typescript
'use server';

import { redirect } from 'next/navigation';
import { SubmissionSchema, flattenZodErrors, type SubmissionSection } from '@/lib/submission-schema';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { buildSubmissionMail, type SubmissionMailInput } from '@/lib/submission-mail';
import { getPayloadClient } from '@/lib/payload';
import { sanitizeLexicalRoot } from '@/lib/lexical-sanitize';
import { isLexicalDirty } from '@/lib/lexical-normalize';

export type SubmitState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  values?: {
    type?: string;
    submitterName?: string;
    submitterEmail?: string;
    relatedArticleSlug?: string;
    proposedTitle?: string;
    proposedIntent?: string;
    proposedSummary?: string;
    proposedDefinition?: string;
    proposedPraxis?: string;
    proposedRisiken?: string;
    proposedQuellen?: string;
    editedDefinition?: string;
    editedPraxis?: string;
    editedRisiken?: string;
    editedQuellen?: string;
    selectedSections?: string[];
    correctionReason?: string;
  };
};

const SECTIONS: SubmissionSection[] = ['definition', 'praxis', 'risiken', 'quellen'];

function extractValues(raw: Record<string, string>, selectedSections: string[]): SubmitState['values'] {
  return {
    type: raw.type,
    submitterName: raw.submitterName,
    submitterEmail: raw.submitterEmail,
    relatedArticleSlug: raw.relatedArticleSlug,
    proposedTitle: raw.proposedTitle,
    proposedIntent: raw.proposedIntent,
    proposedSummary: raw.proposedSummary,
    proposedDefinition: raw.proposedDefinition,
    proposedPraxis: raw.proposedPraxis,
    proposedRisiken: raw.proposedRisiken,
    proposedQuellen: raw.proposedQuellen,
    editedDefinition: raw.editedDefinition,
    editedPraxis: raw.editedPraxis,
    editedRisiken: raw.editedRisiken,
    editedQuellen: raw.editedQuellen,
    selectedSections,
    correctionReason: raw.correctionReason,
  };
}

function sanitizeLexicalString(json: string | undefined): string | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(sanitizeLexicalRoot(parsed));
  } catch {
    return undefined;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function submitAction(
  _prevState: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).filter(([k]) => k !== 'selectedSections'),
  ) as Record<string, string>;
  const selectedSections = formData.getAll('selectedSections').map((v) => String(v));

  const parseInput = { ...raw, selectedSections };
  const parsed = SubmissionSchema.safeParse(parseInput);

  if (!parsed.success) {
    return { fieldErrors: flattenZodErrors(parsed.error), values: extractValues(raw, selectedSections) };
  }

  const verified = await verifyTurnstileToken(parsed.data.turnstileToken);
  if (!verified) {
    return {
      error: 'Captcha-Verifikation fehlgeschlagen. Bitte erneut versuchen.',
      values: extractValues(raw, selectedSections),
    };
  }

  const payload = await getPayloadClient();
  const adminUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000';

  let articleTitle: string | undefined;
  let articleId: number | undefined;
  let articleOriginals: Record<SubmissionSection, unknown> | undefined;

  if (parsed.data.type === 'correction') {
    const found = await payload.find({
      collection: 'articles',
      where: { slug: { equals: parsed.data.relatedArticleSlug } },
      limit: 1,
    });
    if (!found.docs || found.docs.length === 0) {
      return {
        fieldErrors: { relatedArticleSlug: 'Artikel nicht gefunden.' },
        values: extractValues(raw, selectedSections),
      };
    }
    const article = found.docs[0] as Record<string, unknown>;
    articleId = article.id as number;
    articleTitle = article.title as string;
    articleOriginals = {
      definition: article.definition,
      praxis: article.praxis,
      risiken: article.risiken,
      quellen: article.quellen,
    };

    // Dirty-Check pro gewählter Sektion
    const fieldErrors: Record<string, string> = {};
    for (const section of parsed.data.selectedSections) {
      const editedKey = `edited${capitalize(section)}` as keyof typeof parsed.data;
      const editedRaw = parsed.data[editedKey] as string | undefined;
      if (!editedRaw) continue;
      let editedParsed: unknown;
      try {
        editedParsed = JSON.parse(editedRaw);
      } catch {
        fieldErrors[`edited${capitalize(section)}`] = 'Ungültiger Editor-Inhalt.';
        continue;
      }
      if (!isLexicalDirty(editedParsed, articleOriginals[section])) {
        fieldErrors[`edited${capitalize(section)}`] =
          'Keine Änderungen — bitte editieren oder Sektion abwählen.';
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors, values: extractValues(raw, selectedSections) };
    }
  }

  // Sanitize all Lexical-JSON fields
  const sanitizedData: Record<string, unknown> = { type: parsed.data.type };
  if (parsed.data.type === 'new_article') {
    sanitizedData.proposedTitle = parsed.data.proposedTitle;
    if (parsed.data.proposedIntent) sanitizedData.proposedIntent = parsed.data.proposedIntent;
    if (parsed.data.proposedSummary) sanitizedData.proposedSummary = parsed.data.proposedSummary;
    for (const section of SECTIONS) {
      const key = `proposed${capitalize(section)}` as keyof typeof parsed.data;
      const sanitized = sanitizeLexicalString(parsed.data[key] as string);
      if (sanitized) sanitizedData[key] = JSON.parse(sanitized);
    }
  } else {
    sanitizedData.relatedArticle = articleId;
    sanitizedData.selectedSections = parsed.data.selectedSections;
    if (parsed.data.correctionReason) sanitizedData.correctionReason = parsed.data.correctionReason;
    for (const section of parsed.data.selectedSections) {
      const key = `edited${capitalize(section)}` as keyof typeof parsed.data;
      const sanitized = sanitizeLexicalString(parsed.data[key] as string);
      if (sanitized) sanitizedData[key] = JSON.parse(sanitized);
    }
  }
  if (parsed.data.submitterName) sanitizedData.submitterName = parsed.data.submitterName;
  if (parsed.data.submitterEmail) sanitizedData.submitterEmail = parsed.data.submitterEmail;
  sanitizedData.reviewStatus = 'pending';

  let submission;
  try {
    submission = await payload.create({
      collection: 'submissions',
      data: sanitizedData,
    });
  } catch (err) {
    console.error('Submission create failed', err);
    return {
      error: 'Es gab ein Problem beim Senden. Bitte später erneut versuchen.',
      values: extractValues(raw, selectedSections),
    };
  }

  try {
    const submissionForMail: SubmissionMailInput =
      parsed.data.type === 'new_article'
        ? {
            id: String(submission.id),
            type: 'new_article',
            proposedTitle: parsed.data.proposedTitle,
            proposedIntent: parsed.data.proposedIntent,
            proposedSummary: parsed.data.proposedSummary,
            proposedDefinition: parsed.data.proposedDefinition,
            proposedPraxis: parsed.data.proposedPraxis,
            proposedRisiken: parsed.data.proposedRisiken,
            proposedQuellen: parsed.data.proposedQuellen,
            submitterName: parsed.data.submitterName,
            submitterEmail: parsed.data.submitterEmail || undefined,
            createdAt: String(submission.createdAt),
          }
        : {
            id: String(submission.id),
            type: 'correction',
            selectedSections: parsed.data.selectedSections,
            editedDefinition: parsed.data.editedDefinition,
            editedPraxis: parsed.data.editedPraxis,
            editedRisiken: parsed.data.editedRisiken,
            editedQuellen: parsed.data.editedQuellen,
            correctionReason: parsed.data.correctionReason,
            submitterName: parsed.data.submitterName,
            submitterEmail: parsed.data.submitterEmail || undefined,
            createdAt: String(submission.createdAt),
          };

    const mail = buildSubmissionMail({
      submission: submissionForMail,
      articleTitle,
      articleId,
      adminUrl,
    });
    await payload.sendEmail(mail);
  } catch (err) {
    console.error('Submission mail failed (non-fatal)', err);
  }

  redirect('/einreichen/danke');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/integration/submission-action.test.ts
```

Expected: 7 tests passing.

- [ ] **Step 5: Full suite + lint**

```bash
pnpm test && pnpm lint
```

Expected: ~138 tests grün. SubmissionForm-Test ist noch skipped (Task 12).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(frontend\)/einreichen/actions.ts tests/integration/submission-action.test.ts
git commit -m "$(cat <<'EOF'
feat(v1.4): rewrite server action for structured submissions

- SubmitState type expanded for both paths (proposed* + edited* + selectedSections + correctionReason)
- Multi-value FormData (formData.getAll for selectedSections)
- new_article: zod-discriminatedUnion parse, sanitize, payload.create, mail
- correction: article lookup with all sections, per-section dirty-check, sanitize, payload.create with relatedArticle FK, mail
- Sanitization via sanitizeLexicalRoot before persist; dirty-check via isLexicalDirty

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: NewArticleFields + CorrectionFields-Components

**Files:**
- Create: `src/components/NewArticleFields.tsx`
- Create: `src/components/CorrectionFields.tsx`
- Create: `tests/component/NewArticleFields.test.tsx`
- Create: `tests/component/CorrectionFields.test.tsx`

**Zweck:** Field-Subkomponenten, die in `SubmissionForm` (Task 12) per type-Switch zusammengebaut werden. Beide bekommen `state`, `values` und `setters` als Props.

- [ ] **Step 1: Write the NewArticleFields tests**

Create `tests/component/NewArticleFields.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NewArticleFields } from '@/components/NewArticleFields';

vi.mock('@/components/LexicalEditor', () => ({
  LexicalEditor: ({ value, onChange, ariaLabel }: { value: string; onChange: (s: string) => void; ariaLabel?: string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
  emptyLexicalJson: () => JSON.stringify({ type: 'root', children: [] }),
}));

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ LexicalEditor: any }>) => {
    let Comp: any;
    return (props: any) => {
      if (!Comp) {
        loader().then((mod) => {
          Comp = mod.LexicalEditor;
        });
      }
      return <textarea aria-label={props.ariaLabel ?? 'mock'} value={props.value} onChange={(e: any) => props.onChange(e.target.value)} />;
    };
  },
}));

const defaultProps = {
  values: {
    proposedTitle: '',
    proposedIntent: '',
    proposedSummary: '',
    proposedDefinition: '',
    proposedPraxis: '',
    proposedRisiken: '',
    proposedQuellen: '',
  },
  setters: {
    setProposedTitle: vi.fn(),
    setProposedIntent: vi.fn(),
    setProposedSummary: vi.fn(),
    setProposedDefinition: vi.fn(),
    setProposedPraxis: vi.fn(),
    setProposedRisiken: vi.fn(),
    setProposedQuellen: vi.fn(),
  },
  fieldErrors: undefined,
};

describe('NewArticleFields', () => {
  it('renders title input', () => {
    render(<NewArticleFields {...defaultProps} />);
    expect(screen.getByLabelText(/Titel/i)).toBeInTheDocument();
  });

  it('renders intent select with default and 3 options', () => {
    render(<NewArticleFields {...defaultProps} />);
    const select = screen.getByLabelText(/Intent/i) as HTMLSelectElement;
    expect(select.options).toHaveLength(4); // default + 3
    expect(select.options[0].textContent).toMatch(/offen/i);
  });

  it('renders summary textarea with 0/280 counter', () => {
    render(<NewArticleFields {...defaultProps} />);
    expect(screen.getByLabelText(/Kurzbeschreibung/i)).toBeInTheDocument();
    expect(screen.getByText(/0\s*\/\s*280/)).toBeInTheDocument();
  });

  it('renders 4 Lexical editors with section headings', () => {
    render(<NewArticleFields {...defaultProps} />);
    expect(screen.getByText(/Definition/i)).toBeInTheDocument();
    expect(screen.getByText(/Praxis/i)).toBeInTheDocument();
    expect(screen.getByText(/Risiken/i)).toBeInTheDocument();
    expect(screen.getByText(/Quellen/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/component/NewArticleFields.test.tsx
```

Expected: FAIL with import resolution error.

- [ ] **Step 3: Write NewArticleFields component**

Create `src/components/NewArticleFields.tsx`:

```typescript
'use client';

import dynamic from 'next/dynamic';
import { emptyLexicalJson } from '@/components/LexicalEditor';

const LexicalEditor = dynamic(() => import('@/components/LexicalEditor').then((m) => m.LexicalEditor), {
  ssr: false,
  loading: () => <div className="text-ink-muted">Editor lädt…</div>,
});

export interface NewArticleValues {
  proposedTitle: string;
  proposedIntent: string;
  proposedSummary: string;
  proposedDefinition: string;
  proposedPraxis: string;
  proposedRisiken: string;
  proposedQuellen: string;
}

export interface NewArticleSetters {
  setProposedTitle: (v: string) => void;
  setProposedIntent: (v: string) => void;
  setProposedSummary: (v: string) => void;
  setProposedDefinition: (v: string) => void;
  setProposedPraxis: (v: string) => void;
  setProposedRisiken: (v: string) => void;
  setProposedQuellen: (v: string) => void;
}

interface Props {
  values: NewArticleValues;
  setters: NewArticleSetters;
  fieldErrors?: Record<string, string>;
}

function FieldError({ name, errors }: { name: string; errors?: Record<string, string> }) {
  if (!errors?.[name]) return null;
  return (
    <p id={`error-${name}`} className="mt-1 text-sm text-accent">
      {errors[name]}
    </p>
  );
}

function FieldHint({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1 text-sm text-ink-muted">
      {children}
    </p>
  );
}

const SECTIONS: Array<{ key: 'definition' | 'praxis' | 'risiken' | 'quellen'; label: string; placeholder: string }> = [
  { key: 'definition', label: '1. Definition / Kurzantwort', placeholder: 'Worum geht es kurz? Was ist die zentrale Antwort?' },
  { key: 'praxis', label: '2. Praxis (inkl. Erfahrungswissen)', placeholder: 'Wie wird das in der täglichen Pflege konkret umgesetzt?' },
  { key: 'risiken', label: '3. Risiken & Fallstricke', placeholder: 'Wo passieren Fehler? Was ist gefährlich oder oft falsch?' },
  { key: 'quellen', label: '4. Quellen & Weiterführendes', placeholder: 'Leitlinien, Studien, vertiefende Links.' },
];

export function NewArticleFields({ values, setters, fieldErrors }: Props) {
  return (
    <>
      <div>
        <label htmlFor="field-proposedTitle" className="block font-semibold">
          Titel *
        </label>
        <input
          id="field-proposedTitle"
          type="text"
          name="proposedTitle"
          required
          minLength={3}
          maxLength={200}
          value={values.proposedTitle}
          onChange={(e) => setters.setProposedTitle(e.target.value)}
          aria-describedby="hint-proposedTitle"
          className="mt-1 w-full rounded-md border border-rule bg-white p-2"
        />
        <FieldHint id="hint-proposedTitle">
          {values.proposedTitle.length} / 200 Zeichen
          {values.proposedTitle.length < 3 ? ' (min. 3)' : ''}
        </FieldHint>
        <FieldError name="proposedTitle" errors={fieldErrors} />
      </div>

      <div>
        <label htmlFor="field-proposedIntent" className="block font-semibold">
          Intent (optional)
        </label>
        <select
          id="field-proposedIntent"
          name="proposedIntent"
          value={values.proposedIntent}
          onChange={(e) => setters.setProposedIntent(e.target.value)}
          className="mt-1 w-full rounded-md border border-rule bg-white p-2"
        >
          <option value="">— offen, von Redaktion zu setzen —</option>
          <option value="bedside">Schnelle Hilfe am Bett</option>
          <option value="background">Hintergrundwissen</option>
          <option value="learning">Etwas zum Lernen</option>
        </select>
        <FieldError name="proposedIntent" errors={fieldErrors} />
      </div>

      <div>
        <label htmlFor="field-proposedSummary" className="block font-semibold">
          Kurzbeschreibung (optional, max. 280)
        </label>
        <textarea
          id="field-proposedSummary"
          name="proposedSummary"
          maxLength={280}
          rows={3}
          value={values.proposedSummary}
          onChange={(e) => setters.setProposedSummary(e.target.value)}
          aria-describedby="hint-proposedSummary"
          className="mt-1 w-full rounded-md border border-rule bg-white p-2"
        />
        <FieldHint id="hint-proposedSummary">
          {values.proposedSummary.length} / 280 Zeichen
        </FieldHint>
        <FieldError name="proposedSummary" errors={fieldErrors} />
      </div>

      {SECTIONS.map((sec) => {
        const valueKey = `proposed${sec.key.charAt(0).toUpperCase()}${sec.key.slice(1)}` as keyof NewArticleValues;
        const setterKey = `setProposed${sec.key.charAt(0).toUpperCase()}${sec.key.slice(1)}` as keyof NewArticleSetters;
        const value = values[valueKey] || emptyLexicalJson();
        return (
          <div key={sec.key}>
            <label className="block font-semibold mb-1">{sec.label} *</label>
            <LexicalEditor
              value={value}
              onChange={(json) => (setters[setterKey] as (v: string) => void)(json)}
              placeholder={sec.placeholder}
              ariaLabel={sec.label}
            />
            <input type="hidden" name={valueKey} value={values[valueKey]} readOnly />
            <FieldError name={valueKey} errors={fieldErrors} />
          </div>
        );
      })}
    </>
  );
}
```

- [ ] **Step 4: Run NewArticleFields tests**

```bash
pnpm vitest run tests/component/NewArticleFields.test.tsx
```

Expected: 4 tests passing.

- [ ] **Step 5: Write CorrectionFields tests**

Create `tests/component/CorrectionFields.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CorrectionFields } from '@/components/CorrectionFields';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/SectionCheckbox', () => ({
  SectionCheckbox: ({ sectionKey, label, checked }: any) => (
    <div data-testid={`section-${sectionKey}`}>
      <label>
        <input type="checkbox" name="selectedSections" value={sectionKey} checked={checked} onChange={() => {}} />
        {label}
      </label>
    </div>
  ),
}));

const defaultProps = {
  articles: [
    { slug: 'dekubitus', title: 'Dekubitus' },
    { slug: 'sturz', title: 'Sturzprophylaxe' },
  ],
  articleSections: {
    definition: '',
    praxis: '',
    risiken: '',
    quellen: '',
  },
  values: {
    relatedArticleSlug: '',
    correctionReason: '',
    selectedSections: [] as string[],
    editedDefinition: '',
    editedPraxis: '',
    editedRisiken: '',
    editedQuellen: '',
  },
  setters: {
    setRelatedArticleSlug: vi.fn(),
    setCorrectionReason: vi.fn(),
    setSelectedSections: vi.fn(),
    setEditedDefinition: vi.fn(),
    setEditedPraxis: vi.fn(),
    setEditedRisiken: vi.fn(),
    setEditedQuellen: vi.fn(),
  },
  fieldErrors: undefined,
};

describe('CorrectionFields', () => {
  it('renders article dropdown with options', () => {
    render(<CorrectionFields {...defaultProps} />);
    const select = screen.getByLabelText(/Bezogen auf/i) as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThanOrEqual(3); // placeholder + 2 articles
  });

  it('renders 4 section checkboxes', () => {
    render(<CorrectionFields {...defaultProps} />);
    expect(screen.getByTestId('section-definition')).toBeInTheDocument();
    expect(screen.getByTestId('section-praxis')).toBeInTheDocument();
    expect(screen.getByTestId('section-risiken')).toBeInTheDocument();
    expect(screen.getByTestId('section-quellen')).toBeInTheDocument();
  });

  it('renders correctionReason textarea', () => {
    render(<CorrectionFields {...defaultProps} />);
    expect(screen.getByLabelText(/Begründung/i)).toBeInTheDocument();
  });

  it('calls router.push when article selection changes', () => {
    render(<CorrectionFields {...defaultProps} />);
    const select = screen.getByLabelText(/Bezogen auf/i);
    fireEvent.change(select, { target: { value: 'sturz' } });
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('article=sturz'));
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
pnpm vitest run tests/component/CorrectionFields.test.tsx
```

Expected: FAIL with import resolution error.

- [ ] **Step 7: Write CorrectionFields component**

Create `src/components/CorrectionFields.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { SectionCheckbox } from '@/components/SectionCheckbox';

export interface CorrectionValues {
  relatedArticleSlug: string;
  correctionReason: string;
  selectedSections: string[];
  editedDefinition: string;
  editedPraxis: string;
  editedRisiken: string;
  editedQuellen: string;
}

export interface CorrectionSetters {
  setRelatedArticleSlug: (v: string) => void;
  setCorrectionReason: (v: string) => void;
  setSelectedSections: (v: string[]) => void;
  setEditedDefinition: (v: string) => void;
  setEditedPraxis: (v: string) => void;
  setEditedRisiken: (v: string) => void;
  setEditedQuellen: (v: string) => void;
}

interface Props {
  articles: { slug: string; title: string }[];
  articleSections: {
    definition: string;
    praxis: string;
    risiken: string;
    quellen: string;
  };
  values: CorrectionValues;
  setters: CorrectionSetters;
  fieldErrors?: Record<string, string>;
}

const SECTIONS: Array<{ key: 'definition' | 'praxis' | 'risiken' | 'quellen'; label: string }> = [
  { key: 'definition', label: '1. Definition / Kurzantwort' },
  { key: 'praxis', label: '2. Praxis' },
  { key: 'risiken', label: '3. Risiken & Fallstricke' },
  { key: 'quellen', label: '4. Quellen & Weiterführendes' },
];

function FieldError({ name, errors }: { name: string; errors?: Record<string, string> }) {
  if (!errors?.[name]) return null;
  return (
    <p id={`error-${name}`} className="mt-1 text-sm text-accent">
      {errors[name]}
    </p>
  );
}

export function CorrectionFields({ articles, articleSections, values, setters, fieldErrors }: Props) {
  const router = useRouter();

  const handleArticleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const slug = e.target.value;
    setters.setRelatedArticleSlug(slug);
    if (slug) {
      router.push(`/einreichen?type=correction&article=${encodeURIComponent(slug)}`);
    }
  };

  const handleSectionCheckedChange = (sectionKey: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...values.selectedSections, sectionKey]))
      : values.selectedSections.filter((s) => s !== sectionKey);
    setters.setSelectedSections(next);
  };

  const getSetterForSection = (sectionKey: string): ((v: string) => void) => {
    switch (sectionKey) {
      case 'definition':
        return setters.setEditedDefinition;
      case 'praxis':
        return setters.setEditedPraxis;
      case 'risiken':
        return setters.setEditedRisiken;
      case 'quellen':
        return setters.setEditedQuellen;
      default:
        return () => {};
    }
  };

  const getCurrentValueForSection = (sectionKey: string): string => {
    switch (sectionKey) {
      case 'definition':
        return values.editedDefinition;
      case 'praxis':
        return values.editedPraxis;
      case 'risiken':
        return values.editedRisiken;
      case 'quellen':
        return values.editedQuellen;
      default:
        return '';
    }
  };

  return (
    <>
      <div>
        <label htmlFor="field-relatedArticleSlug" className="block font-semibold">
          Bezogen auf *
        </label>
        <select
          id="field-relatedArticleSlug"
          name="relatedArticleSlug"
          value={values.relatedArticleSlug}
          onChange={handleArticleChange}
          className="mt-1 w-full rounded-md border border-rule bg-white p-2"
        >
          <option value="">— wählen —</option>
          {articles.map((a) => (
            <option key={a.slug} value={a.slug}>
              {a.title}
            </option>
          ))}
        </select>
        <FieldError name="relatedArticleSlug" errors={fieldErrors} />
      </div>

      {values.relatedArticleSlug && (
        <fieldset className="space-y-4 border border-rule rounded-md p-4">
          <legend className="font-semibold px-1">
            Welche Sektionen möchtest du korrigieren?
          </legend>
          {SECTIONS.map((sec) => (
            <SectionCheckbox
              key={sec.key}
              sectionKey={sec.key}
              label={sec.label}
              originalValue={articleSections[sec.key]}
              currentValue={getCurrentValueForSection(sec.key)}
              onChange={getSetterForSection(sec.key)}
              onCheckedChange={(checked) => handleSectionCheckedChange(sec.key, checked)}
              checked={values.selectedSections.includes(sec.key)}
            />
          ))}
          <FieldError name="selectedSections" errors={fieldErrors} />
        </fieldset>
      )}

      <div>
        <label htmlFor="field-correctionReason" className="block font-semibold">
          Begründung (optional)
        </label>
        <textarea
          id="field-correctionReason"
          name="correctionReason"
          maxLength={2000}
          rows={4}
          value={values.correctionReason}
          onChange={(e) => setters.setCorrectionReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-rule bg-white p-2"
        />
        <FieldError name="correctionReason" errors={fieldErrors} />
      </div>
    </>
  );
}
```

- [ ] **Step 8: Run CorrectionFields tests**

```bash
pnpm vitest run tests/component/CorrectionFields.test.tsx
```

Expected: 4 tests passing.

- [ ] **Step 9: Full suite + lint**

```bash
pnpm test && pnpm lint
```

Expected: ~146 tests grün.

- [ ] **Step 10: Commit**

```bash
git add src/components/NewArticleFields.tsx src/components/CorrectionFields.tsx tests/component/NewArticleFields.test.tsx tests/component/CorrectionFields.test.tsx
git commit -m "$(cat <<'EOF'
feat(v1.4): NewArticleFields + CorrectionFields subcomponents

NewArticleFields:
- title input with live counter
- intent select with default "— offen —"
- summary textarea with counter
- 4 Lexical editors with section placeholders

CorrectionFields:
- article dropdown with router.push on change (preload via page reload)
- 4 SectionCheckboxes inside fieldset (only when article selected)
- optional correctionReason textarea

Both consume controlled values + setters from SubmissionForm (T12).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: SubmissionForm umbauen (type-Switch)

**Files:**
- Modify: `src/components/SubmissionForm.tsx`
- Modify: `tests/component/SubmissionForm.test.tsx`

**Zweck:** Top-Level-Form: type-Switch zwischen NewArticleFields und CorrectionFields, gemeinsame Submitter-Felder + Turnstile + Submit. V1.3b-Pattern (useActionState, controlled inputs, state.values-Sync, ErrorSummary) bleibt.

- [ ] **Step 1: Write the new tests (replace existing file content)**

Replace the full content of `tests/component/SubmissionForm.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubmissionForm } from '@/components/SubmissionForm';

const { mockSubmitAction } = vi.hoisted(() => ({
  mockSubmitAction: vi.fn(async () => ({})),
}));

vi.mock('@/app/(frontend)/einreichen/actions', () => ({
  submitAction: mockSubmitAction,
}));

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (t: string) => void }) => (
    <button type="button" onClick={() => onSuccess('mock-token')}>
      Turnstile mock
    </button>
  ),
}));

vi.mock('@/components/NewArticleFields', () => ({
  NewArticleFields: () => <div data-testid="new-article-fields" />,
}));

vi.mock('@/components/CorrectionFields', () => ({
  CorrectionFields: () => <div data-testid="correction-fields" />,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseProps = {
  articles: [{ slug: 'a', title: 'A' }],
  articleSections: { definition: '', praxis: '', risiken: '', quellen: '' },
  turnstileSiteKey: 'site-key',
  initialType: 'new_article' as const,
  initialArticleSlug: '',
  initialSection: '' as '' | 'definition' | 'praxis' | 'risiken' | 'quellen',
};

describe('SubmissionForm', () => {
  it('renders NewArticleFields when type=new_article', () => {
    render(<SubmissionForm {...baseProps} initialType="new_article" />);
    expect(screen.getByTestId('new-article-fields')).toBeInTheDocument();
    expect(screen.queryByTestId('correction-fields')).not.toBeInTheDocument();
  });

  it('renders CorrectionFields when type=correction', () => {
    render(<SubmissionForm {...baseProps} initialType="correction" />);
    expect(screen.getByTestId('correction-fields')).toBeInTheDocument();
    expect(screen.queryByTestId('new-article-fields')).not.toBeInTheDocument();
  });

  it('switches between NewArticleFields and CorrectionFields via the type select', () => {
    render(<SubmissionForm {...baseProps} initialType="new_article" />);
    fireEvent.change(screen.getByLabelText(/Art/i), { target: { value: 'correction' } });
    expect(screen.getByTestId('correction-fields')).toBeInTheDocument();
  });

  it('renders submitter fields and submit button', () => {
    render(<SubmissionForm {...baseProps} />);
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/E-Mail/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /absenden/i })).toBeInTheDocument();
  });

  it('renders the Turnstile widget', () => {
    render(<SubmissionForm {...baseProps} />);
    expect(screen.getByRole('button', { name: /Turnstile mock/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/component/SubmissionForm.test.tsx
```

Expected: FAIL — old SubmissionForm signature doesn't match new SubmitState/props.

- [ ] **Step 3: Write the new SubmissionForm (replace existing file content)**

Replace the full content of `src/components/SubmissionForm.tsx`:

```typescript
'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import { ErrorSummary } from './ErrorSummary';
import { NewArticleFields, type NewArticleValues, type NewArticleSetters } from './NewArticleFields';
import { CorrectionFields, type CorrectionValues, type CorrectionSetters } from './CorrectionFields';
import { submitAction, type SubmitState } from '@/app/(frontend)/einreichen/actions';

type Type = 'new_article' | 'correction';
type Section = '' | 'definition' | 'praxis' | 'risiken' | 'quellen';

interface Props {
  articles: { slug: string; title: string }[];
  articleSections: {
    definition: string;
    praxis: string;
    risiken: string;
    quellen: string;
  };
  turnstileSiteKey: string;
  initialType?: Type;
  initialArticleSlug?: string;
  initialSection?: Section;
}

const FIELD_LABELS: Record<string, string> = {
  type: 'Art',
  proposedTitle: 'Titel',
  proposedIntent: 'Intent',
  proposedSummary: 'Kurzbeschreibung',
  proposedDefinition: 'Definition',
  proposedPraxis: 'Praxis',
  proposedRisiken: 'Risiken',
  proposedQuellen: 'Quellen',
  relatedArticleSlug: 'Bezogen auf',
  selectedSections: 'Sektionen',
  editedDefinition: 'Definition (Korrektur)',
  editedPraxis: 'Praxis (Korrektur)',
  editedRisiken: 'Risiken (Korrektur)',
  editedQuellen: 'Quellen (Korrektur)',
  correctionReason: 'Begründung',
  submitterName: 'Name',
  submitterEmail: 'E-Mail',
  turnstileToken: 'Captcha',
  _root: 'Fehler',
};

const initialState: SubmitState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand px-6 py-2 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Wird gesendet…' : 'Absenden'}
    </button>
  );
}

export function SubmissionForm({
  articles,
  articleSections,
  turnstileSiteKey,
  initialType = 'new_article',
  initialArticleSlug = '',
  initialSection = '',
}: Props) {
  const [state, formAction] = useActionState(submitAction, initialState);

  const [type, setType] = useState<Type>(initialType);
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  // new_article state
  const [proposedTitle, setProposedTitle] = useState('');
  const [proposedIntent, setProposedIntent] = useState('');
  const [proposedSummary, setProposedSummary] = useState('');
  const [proposedDefinition, setProposedDefinition] = useState('');
  const [proposedPraxis, setProposedPraxis] = useState('');
  const [proposedRisiken, setProposedRisiken] = useState('');
  const [proposedQuellen, setProposedQuellen] = useState('');

  // correction state
  const [relatedArticleSlug, setRelatedArticleSlug] = useState(initialArticleSlug);
  const [correctionReason, setCorrectionReason] = useState('');
  const [selectedSections, setSelectedSections] = useState<string[]>(
    initialSection ? [initialSection] : [],
  );
  const [editedDefinition, setEditedDefinition] = useState('');
  const [editedPraxis, setEditedPraxis] = useState('');
  const [editedRisiken, setEditedRisiken] = useState('');
  const [editedQuellen, setEditedQuellen] = useState('');

  // Render-time sync from state.values (V1.3b pattern)
  const [lastValues, setLastValues] = useState<SubmitState['values'] | undefined>(undefined);
  if (state.values !== lastValues) {
    setLastValues(state.values);
    if (state.values) {
      if (state.values.type === 'new_article' || state.values.type === 'correction') {
        setType(state.values.type);
      }
      setSubmitterName(state.values.submitterName ?? '');
      setSubmitterEmail(state.values.submitterEmail ?? '');
      setProposedTitle(state.values.proposedTitle ?? '');
      setProposedIntent(state.values.proposedIntent ?? '');
      setProposedSummary(state.values.proposedSummary ?? '');
      setProposedDefinition(state.values.proposedDefinition ?? '');
      setProposedPraxis(state.values.proposedPraxis ?? '');
      setProposedRisiken(state.values.proposedRisiken ?? '');
      setProposedQuellen(state.values.proposedQuellen ?? '');
      setRelatedArticleSlug(state.values.relatedArticleSlug ?? '');
      setCorrectionReason(state.values.correctionReason ?? '');
      if (Array.isArray(state.values.selectedSections)) {
        setSelectedSections(state.values.selectedSections);
      }
      setEditedDefinition(state.values.editedDefinition ?? '');
      setEditedPraxis(state.values.editedPraxis ?? '');
      setEditedRisiken(state.values.editedRisiken ?? '');
      setEditedQuellen(state.values.editedQuellen ?? '');
    }
  }

  const newArticleValues: NewArticleValues = {
    proposedTitle,
    proposedIntent,
    proposedSummary,
    proposedDefinition,
    proposedPraxis,
    proposedRisiken,
    proposedQuellen,
  };
  const newArticleSetters: NewArticleSetters = {
    setProposedTitle,
    setProposedIntent,
    setProposedSummary,
    setProposedDefinition,
    setProposedPraxis,
    setProposedRisiken,
    setProposedQuellen,
  };

  const correctionValues: CorrectionValues = {
    relatedArticleSlug,
    correctionReason,
    selectedSections,
    editedDefinition,
    editedPraxis,
    editedRisiken,
    editedQuellen,
  };
  const correctionSetters: CorrectionSetters = {
    setRelatedArticleSlug,
    setCorrectionReason,
    setSelectedSections,
    setEditedDefinition,
    setEditedPraxis,
    setEditedRisiken,
    setEditedQuellen,
  };

  return (
    <>
      <noscript
        dangerouslySetInnerHTML={{
          __html:
            '<p class="mb-6 rounded-lg border-l-4 border-accent bg-surface p-4 text-sm">' +
            'JavaScript ist für dieses Formular nötig. Du kannst stattdessen direkt an ' +
            '<a class="text-brand underline" href="mailto:mitmachen@pflegeatlas.org">' +
            'mitmachen@pflegeatlas.org</a> mailen.</p>',
        }}
      />
      <form action={formAction} noValidate className="space-y-6">
        {state.error && (
          <p role="alert" className="rounded-lg border-l-4 border-accent bg-surface p-4">
            {state.error}
          </p>
        )}
        {state.fieldErrors && (
          <ErrorSummary errors={state.fieldErrors} fieldLabels={FIELD_LABELS} />
        )}

        <div>
          <label htmlFor="field-type" className="block font-semibold">
            Art *
          </label>
          <select
            id="field-type"
            name="type"
            required
            value={type}
            onChange={(e) => setType(e.target.value as Type)}
            className="mt-1 w-full rounded-md border border-rule bg-white p-2"
          >
            <option value="new_article">Neuer Artikel-Vorschlag</option>
            <option value="correction">Korrektur</option>
          </select>
        </div>

        {type === 'new_article' && (
          <NewArticleFields
            values={newArticleValues}
            setters={newArticleSetters}
            fieldErrors={state.fieldErrors}
          />
        )}

        {type === 'correction' && (
          <CorrectionFields
            articles={articles}
            articleSections={articleSections}
            values={correctionValues}
            setters={correctionSetters}
            fieldErrors={state.fieldErrors}
          />
        )}

        <div>
          <label htmlFor="field-submitterName" className="block font-semibold">
            Name (optional)
          </label>
          <input
            id="field-submitterName"
            type="text"
            name="submitterName"
            maxLength={100}
            value={submitterName}
            onChange={(e) => setSubmitterName(e.target.value)}
            className="mt-1 w-full rounded-md border border-rule bg-white p-2"
          />
        </div>

        <div>
          <label htmlFor="field-submitterEmail" className="block font-semibold">
            E-Mail (optional, für Rückfragen)
          </label>
          <input
            id="field-submitterEmail"
            type="email"
            name="submitterEmail"
            value={submitterEmail}
            onChange={(e) => setSubmitterEmail(e.target.value)}
            aria-describedby="hint-submitterEmail"
            className="mt-1 w-full rounded-md border border-rule bg-white p-2"
          />
          <p id="hint-submitterEmail" className="mt-1 text-sm text-ink-muted">
            Nur für Rückfragen. Wird nicht veröffentlicht und nicht für Newsletter genutzt.
          </p>
        </div>

        <div>
          <Turnstile
            siteKey={turnstileSiteKey}
            onSuccess={(token) => setTurnstileToken(token)}
            options={{ size: 'normal' }}
          />
          <input type="hidden" name="turnstileToken" value={turnstileToken} readOnly />
        </div>

        <SubmitButton />
      </form>
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/component/SubmissionForm.test.tsx
```

Expected: 5 tests passing.

- [ ] **Step 5: Full suite + lint**

```bash
pnpm test && pnpm lint
```

Expected: ~151 tests grün, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/SubmissionForm.tsx tests/component/SubmissionForm.test.tsx
git commit -m "$(cat <<'EOF'
feat(v1.4): rebuild SubmissionForm with type switch + subcomponents

- Top-level type select switches between NewArticleFields and CorrectionFields
- All controlled state lifted into SubmissionForm; subcomponents are presentational
- V1.3b state.values render-time sync pattern preserved for both paths
- Common submitter + Turnstile + Submit unchanged

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Page erweitern + Article-Footer-Per-Section-Links

**Files:**
- Modify: `src/app/(frontend)/einreichen/page.tsx`
- Modify: `src/app/(frontend)/artikel/[slug]/page.tsx`

**Zweck:** (a) Einreichen-Page fetcht Article-Sektionen wenn `?article=` gesetzt, plus neuer `?section=` Smart-Default. (b) Article-Page bekommt pro Sektion einen „Diese Sektion ergänzen oder korrigieren →"-Link.

- [ ] **Step 1: Modify `src/app/(frontend)/einreichen/page.tsx`**

Replace the full content with:

```typescript
import type { Metadata } from 'next';
import { SectionLabel } from '@/components/SectionLabel';
import { SubmissionForm } from '@/components/SubmissionForm';
import { getPayloadClient } from '@/lib/payload';

export const metadata: Metadata = {
  title: 'Mitmachen – PflegeAtlas',
  description: 'Reiche einen neuen Artikel oder eine Korrektur ein.',
};

type SectionKey = 'definition' | 'praxis' | 'risiken' | 'quellen';
type SearchParams = {
  type?: 'correction' | 'new_article';
  article?: string;
  section?: SectionKey;
};

const VALID_SECTIONS: SectionKey[] = ['definition', 'praxis', 'risiken', 'quellen'];

export default async function EinreichenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const initialType: 'correction' | 'new_article' =
    params.type === 'correction' ? 'correction' : 'new_article';
  const initialArticleSlug = params.article || '';
  const initialSection: '' | SectionKey =
    params.section && VALID_SECTIONS.includes(params.section) ? params.section : '';

  const payload = await getPayloadClient();
  const articles = await payload.find({
    collection: 'articles',
    sort: '-updatedAt',
    limit: 50,
    select: { slug: true, title: true },
  });

  const articleOptions = articles.docs.map((a: { slug: string; title: string }) => ({
    slug: a.slug,
    title: a.title,
  }));

  let articleSections = {
    definition: '',
    praxis: '',
    risiken: '',
    quellen: '',
  };

  if (initialArticleSlug && initialType === 'correction') {
    const found = await payload.find({
      collection: 'articles',
      where: { slug: { equals: initialArticleSlug } },
      limit: 1,
    });
    const article = found.docs[0] as Record<string, unknown> | undefined;
    if (article) {
      articleSections = {
        definition: article.definition ? JSON.stringify(article.definition) : '',
        praxis: article.praxis ? JSON.stringify(article.praxis) : '',
        risiken: article.risiken ? JSON.stringify(article.risiken) : '',
        quellen: article.quellen ? JSON.stringify(article.quellen) : '',
      };
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <SectionLabel className="mb-3">Mitmachen</SectionLabel>
      <h1 className="mb-6 font-serif text-3xl font-semibold leading-tight text-ink">
        Teile dein Pflege-Wissen
      </h1>
      <p className="mb-10 text-lg text-ink-muted">
        Alle Inhalte stehen unter{' '}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
          className="text-brand underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >
          CC BY-SA 4.0
        </a>
        . Mit dem Einreichen erklärst du dich mit dieser Lizenz einverstanden.
      </p>

      <SubmissionForm
        articles={articleOptions}
        articleSections={articleSections}
        turnstileSiteKey={process.env.TURNSTILE_SITE_KEY ?? ''}
        initialType={initialType}
        initialArticleSlug={initialArticleSlug}
        initialSection={initialSection}
      />
    </div>
  );
}
```

- [ ] **Step 2: Modify `src/app/(frontend)/artikel/[slug]/page.tsx` for per-section edit links**

Read the current file:

```bash
cat 'src/app/(frontend)/artikel/[slug]/page.tsx'
```

Locate the existing 4 RichText section renders (definition, praxis, risiken, quellen) — they're typically a `<RichText data={article.definition} />` (or similar) inside a `<section>`. After each section's content (before the closing `</section>`), insert a small inline link:

```tsx
<p className="mt-3 text-sm text-ink-muted">
  <a
    href={`/einreichen?type=correction&article=${article.slug}&section=definition`}
    className="text-brand hover:underline"
  >
    Diese Sektion ergänzen oder korrigieren →
  </a>
</p>
```

Repeat per section, replacing `section=definition` with `praxis`, `risiken`, `quellen` respectively.

Concrete pattern: if the current section rendering looks like
```tsx
<section className="mt-12">
  <h2>1. Definition</h2>
  <RichText data={article.definition} />
</section>
```
change it to:
```tsx
<section className="mt-12">
  <h2>1. Definition</h2>
  <RichText data={article.definition} />
  <p className="mt-3 text-sm text-ink-muted">
    <a
      href={`/einreichen?type=correction&article=${article.slug}&section=definition`}
      className="text-brand hover:underline"
    >
      Diese Sektion ergänzen oder korrigieren →
    </a>
  </p>
</section>
```

Do this for all four sections.

- [ ] **Step 3: Update article-page tests (if they touch section rendering)**

If `tests/integration/articles.test.ts` or similar asserts on section markup, extend it to check the new edit-links. Otherwise, no test changes needed.

If you want explicit coverage, add to `tests/integration/articles.test.ts`:

```typescript
it('renders a per-section correction link for each of the 4 sections', async () => {
  // Use whichever payload-test helper articles.test.ts already uses to render
  // an article. Then assert:
  const html = /* render article page */ '';
  expect(html).toContain('section=definition');
  expect(html).toContain('section=praxis');
  expect(html).toContain('section=risiken');
  expect(html).toContain('section=quellen');
});
```

- [ ] **Step 4: Full suite + lint + build**

```bash
pnpm test && pnpm lint && pnpm build
```

Expected: all green, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/(frontend)/einreichen/page.tsx' 'src/app/(frontend)/artikel/[slug]/page.tsx'
git commit -m "$(cat <<'EOF'
feat(v1.4): wire structured submissions into pages

einreichen/page.tsx:
- Reads ?section= search param for smart default
- Fetches article sections (lexical JSON) when ?article= set
- Passes articleSections to SubmissionForm

artikel/[slug]/page.tsx:
- Per-section "Diese Sektion ergänzen oder korrigieren →" inline link
- Links to /einreichen?type=correction&article=<slug>&section=<key>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: README ergänzen + Browser-Verifikation

**Files:**
- Modify: `README.md` (kleiner Append, nicht überschreiben)
- Keine Code-Änderung sonst — reine Verifikation

- [ ] **Step 1:** `README.md` lesen, vor Anpassung.

```bash
cat README.md | head -80
```

- [ ] **Step 2:** Im V1.3b-Submission-Abschnitt einen kurzen V1.4-Hinweis appenden (nicht den ganzen Block überschreiben). Beispiel-Patch — finde den bestehenden Submission-Block und ergänze am Ende des Blocks:

```markdown

**V1.4 strukturierte Submissions:** Das Formular ist seit V1.4 typ-abhängig: ein Vorschlag für einen neuen Artikel sammelt Titel + optional Intent/Summary + 4 RichText-Sektionen analog zu Articles. Eine Korrektur lädt die Sektionen des bezogenen Artikels vor und der Einreichende wählt per Checkbox, welche Sektionen er editieren möchte.
```

- [ ] **Step 3:** Sanity-Test laufen lassen.

```bash
pnpm test && pnpm lint && pnpm build
```

Expected: alles grün.

- [ ] **Step 4:** Postgres + Dev-Server starten.

```bash
docker compose up -d
pnpm dev
```

- [ ] **Step 5: Browser-Verifikation (new_article-Flow)**

http://localhost:3000/einreichen öffnen:

- [ ] Form rendert, Type=new_article ist default
- [ ] Title-Counter zeigt 0/200, Min-Hint sichtbar
- [ ] Intent-Dropdown zeigt 4 Optionen (default „— offen —")
- [ ] Summary-Counter zeigt 0/280
- [ ] 4 Lexical-Editoren rendern mit Toolbar (B/I/•/1./🔗) + Placeholder-Text
- [ ] Bold/Italic/Bullet/Numbered klicken erzeugt Formattierung im Editor
- [ ] Link einfügen via Prompt funktioniert
- [ ] Submit ohne Pflichtfelder → ErrorSummary oben + Inline-Errors

- [ ] **Step 6: Browser-Verifikation (correction-Flow von Artikel-Footer)**

Existierenden Artikel öffnen (`/artikel/<existierender-slug>`):

- [ ] Pro Sektion ein „Diese Sektion ergänzen oder korrigieren →"-Link sichtbar
- [ ] Klick auf Praxis-Link → `/einreichen?type=correction&article=<slug>&section=praxis`
- [ ] Form öffnet mit Type=Korrektur, Article-Dropdown vorbelegt, Praxis-Checkbox angehakt, Praxis-Editor vorgeladen mit Original-Inhalt
- [ ] Editor editieren → kleine Änderung machen
- [ ] Versuche, die Praxis-Checkbox abzuwählen → wird abgewiesen, Warnung erscheint, „Verwerfen"-Button sichtbar
- [ ] „Verwerfen" klicken → Sektion abgewählt, Editor versteckt, Warnung weg
- [ ] Praxis wieder anhaken → Original wird vorgeladen
- [ ] Editieren, Submit → Redirect auf `/einreichen/danke`
- [ ] Im Payload-Admin (`/admin/collections/submissions`) prüfen: neuer Eintrag mit displayTitle „Korrektur: <ArticleTitle>", relatedArticle gesetzt, editedPraxis enthält Lexical-JSON
- [ ] Mail-Log in Server-Console: Subject „Korrektur: <Title>", Body enthält nur Praxis-Sektion + Article-Link

- [ ] **Step 7: Edge-Case-Test (Dirty-Check)**

In `/einreichen?type=correction&article=<slug>&section=praxis`:

- [ ] Praxis ist vorgeladen, **nicht** editieren, Submit → fieldError „Keine Änderungen — bitte editieren oder Sektion abwählen."

- [ ] **Step 8: Type-Switch-Test**

In `/einreichen`:

- [ ] Type von „Neuer Artikel" auf „Korrektur" wechseln → CorrectionFields erscheint, NewArticleFields-State bleibt erhalten (nicht zurückgesetzt)
- [ ] Zurück auf „Neuer Artikel" → vorher eingegebene Title/Summary noch da

Falls einer der Browser-Checks fehlschlägt: Debug-Task starten, nicht commiten.

- [ ] **Step 9:** Sync-Verifikation final.

```bash
pnpm test && pnpm lint && pnpm build
```

Expected: alles grün.

- [ ] **Step 10:** Commit (nur README).

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(v1.4): note structured submissions in README

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: PR + CI + Merge

- [ ] **Step 1:** Working tree clean check.

```bash
git status
git log --oneline main..HEAD
```

Expected: clean, ~14 V1.4-Commits + Spec + Plan sichtbar.

- [ ] **Step 2:** Final lokal-Check.

```bash
pnpm test && pnpm lint && pnpm build
```

Expected: alle Tests grün (~155 erwartet), 0 lint errors, build grün.

- [ ] **Step 3:** Push.

```bash
git push -u origin feat/v1-4-structured-submissions
```

- [ ] **Step 4:** PR erstellen.

```bash
gh pr create --title "V1.4: Strukturierte Submissions (Lexical + discriminatedUnion + Sektion-Picker)" --body "$(cat <<'EOF'
## Summary

Submissions-Collection und /einreichen-Formular von 1 Body-Feld auf typ-abhängige strukturierte Felder umgebaut, sodass Vorschläge und Korrekturen zur Articles-Struktur passen.

- **Schema:** `subject`/`body` weg, neu `proposed*` (5 required + 2 optional) für `new_article`, `edited*` + `correctionReason` + `selectedSections` für `correction`, plus `displayTitle`-Hook fürs Admin
- **Validation:** Zod discriminatedUnion mit per-Pfad Required-Set, Cross-Field-Refine prüft Section-Inhalt für gewählte selectedSections
- **Editor:** Reduzierter `@lexical/react`-Editor (5-Button-Toolbar: Bold/Italic/Bullet/Numbered/Link), lazy-loaded via `dynamic({ ssr: false })`
- **Korrektur-UX:** Multi-Select Section-Checkboxes mit Hard-Constraint — Abwählen einer dirty Sektion wird abgewiesen, „Verwerfen"-Button leert + entfernt
- **Server-Action:** Article-Lookup mit allen 4 Sektionen, per-Sektion Dirty-Check via Lexical-Normalize-Compare, Sanitize via Whitelist-Walker vor Persist
- **Mail-Template:** Plain-Text-Render via Lexical-Walker, Subject+Body je nach type strukturiert
- **Side-Quest:** Article-Page bekommt pro Sektion einen „Diese Sektion ergänzen oder korrigieren →"-Link

## Spec + Plan

- Spec: `docs/superpowers/specs/2026-06-06-pflegeatlas-structured-submissions-v1-4-design.md`
- Plan: `docs/superpowers/plans/2026-06-06-pflegeatlas-structured-submissions-v1-4.md`

## Verification

- Tests: ~155 grün (70 V1.3b-Baseline + ~85 neu)
- Lint: 0 Errors
- Build: grün
- Migration: self-contained gegen leere DB verifiziert
- Manuell verifiziert: new_article-Flow, correction-Flow von Article-Footer, Dirty-Check-Edge-Case, Type-Switch State-Preserve

## Test plan

- [ ] CI grün warten
- [ ] /einreichen Type=new_article manuell submitten
- [ ] /artikel/<slug> Per-Section-Link → Korrektur-Flow End-to-End
- [ ] Dirty-Check (Sektion ohne Edit submitten → Error)
- [ ] Hard-Constraint (Sektion abwählen mit Edits → blocked + Warnung)
- [ ] Submission im Admin sichtbar, displayTitle korrekt
- [ ] Mail an redaktion@ in Inbox prüfen

## Plan-Deviations

(während Implementation hier dokumentieren, falls Plan-Reihenfolge oder Detail abgewichen)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5:** CI pollen.

```bash
until s=$(gh pr checks --json bucket --jq '.[0].bucket' 2>/dev/null) && [ "$s" != "pending" ] && [ -n "$s" ]; do sleep 15; done; echo "CI: $s"
```

Expected: `CI: pass`.

- [ ] **Step 6:** Mergen.

```bash
gh pr merge --merge --delete-branch
```

- [ ] **Step 7:** Sync.

```bash
git checkout main && git pull && git log --oneline -3
```

- [ ] **Step 8:** Memory-Update durch Claude (V1.4 fertig, Folge-Themen: V1.5 PR-Workflow, Auth/Editorial, DSGVO-Track, Meilisearch).
