# V1.5 Submissions als GitHub-PRs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Submissions erzeugen ab dem Triage-Klick im Admin einen Markdown-PR im Repo (`shogun160/pflege-atlas`), Article-Direkt-Edits syncen als direkter `main`-Commit. DB bleibt Source-of-Truth, keine Reverse-Sync-Logik.

**Architecture:** Fünf Schichten: (1) Lexical→Markdown-Walker; (2) Article-Markdown-Renderer (Frontmatter + Body); (3) Octokit-Client mit drei High-Level-Helpern (`createSubmissionPR`, `pushSubmissionEdit`, `mergeSubmissionPR`, `closeSubmissionPR`, `upsertArticleMarkdown`, `deleteArticleMarkdown`); (4) Mapper + Diff-Helper für Submission↔Article-Übertrag und Inline-Diff im Admin; (5) drei atomare Server-Actions (in-review/accept/reject) plus zwei Hooks (`Submissions.afterChange` für PR-Re-Push, `Articles.afterChange` für Direkt-Sync mit `skipMarkdownSync`-Context-Flag). Frontend-Adds: PII-Notice im Submission-Form, drei Admin-Buttons, Inline-Diff-Komponente, Slug-Override-Feld.

**Tech Stack:** Next.js 16, React 19 (Server Actions), Payload CMS 3.85, Postgres 16, `@octokit/auth-app` + `@octokit/rest`, `diff` (npm, MIT), `js-yaml` für Frontmatter, Vitest 4.1 + `vi.mock` für Octokit-Stubbing, pnpm 10.

**Branch:** `feat/v1-5-submissions-as-prs` (existiert, Spec ist drauf als Commit `7e62af1`).

**Spec-Referenz:** `docs/superpowers/specs/2026-06-20-pflegeatlas-submissions-as-prs-v1-5-design.md`

**Vorgänger-Lessons explizit beachten:**
1. **Vitest-TDZ-Mocks:** `vi.hoisted(...)` für `vi.mock`-Targets bei Octokit-Modulen (V1.3b-Lesson, gilt analog).
2. **Existing-File-Handling (V1.3a):** `.env.example`, README, CONTRIBUTING.md werden **appended**, nicht überschrieben.
3. **Payload-Migrate-CLI hängt (V1.4):** Falls `pnpm payload migrate:create` auf non-TTY stdin hängt, Migration manuell nach init.ts-Format schreiben + via psql applien + `payload_migrations`-Row als Batch N+1 inserten.
4. **Security (V1.3b):** Niemals den Private Key, App-IDs oder Bearer-Tokens ungefiltert printen — nicht in `ps eww`, nicht in Debug-Output, nicht in Test-Mocks-Replays.
5. **Production-Boot-Check (V1.3b-Turnstile-Pattern):** Wenn `NODE_ENV=production` UND eine kritische ENV-Var fehlt → lautes throw beim Boot, nicht stilles Skippen.
6. **Lexical-Version-Pin (V1.4):** Bei jedem Lexical-Update den Walker-Roundtrip-Test laufen lassen, JSON-Format kann driften.

---

## File Structure

| Pfad | Typ | Zuständigkeit |
|---|---|---|
| `src/lib/github-app.ts` | **NEU** | `getOctokit()` — App-Auth via `@octokit/auth-app`, lazy Singleton, gibt authentifizierten Octokit zurück oder `null` wenn ENV fehlt |
| `src/lib/github-pr.ts` | **NEU** | `createSubmissionPR()`, `pushSubmissionEdit()`, `mergeSubmissionPR()`, `closeSubmissionPR()` — High-Level Wrapper über Octokit |
| `src/lib/github-article-sync.ts` | **NEU** | `upsertArticleMarkdown()`, `deleteArticleMarkdown()` — direkter `main`-Commit für Article-Direkt-Edits |
| `src/lib/lexical-to-markdown.ts` | **NEU** | `lexicalToMarkdown(root)` — Walker analog `lexical-to-plain-text.ts`, Bold/Italic/Lists/Links |
| `src/lib/article-markdown.ts` | **NEU** | `renderArticleMarkdown(article, authorNames)` — Frontmatter (YAML) + Body (4 Headings + Lexical→Markdown), liefert komplettes File-Content + Hash |
| `src/lib/submission-to-article.ts` | **NEU** | `applySubmissionToArticle(submission, article?)` — Mapper: gibt geänderte Article-Felder zurück + finalen Slug |
| `src/lib/submission-section-diff.ts` | **NEU** | `diffSection(original, edited)` — Plain-Text-Diff via `diff`-Lib, strukturiertes Result für UI |
| `src/lib/slug-resolver.ts` | **NEU** | `resolveUniqueSlug(baseSlug, existsCheck)` — Suffix-Logik `-2`, `-3` … bis frei |
| `src/collections/Submissions.ts` | MODIFIZIERT | 4 neue Felder (`prNumber`, `prBranch`, `prState`, `proposedSlug`), `afterChange`-Hook für PR-Re-Push |
| `src/collections/Articles.ts` | MODIFIZIERT | `afterChange`-Hook für direkten Markdown-Sync (mit `skipMarkdownSync`-Context-Flag-Check) |
| `src/migrations/<ts>_v1_5_submissions_pr_fields.ts` | **NEU** | Migration für 4 neue Submission-Spalten |
| `src/app/(payload)/admin/submission-actions.ts` | **NEU** | Server-Actions `inReviewAction`, `acceptAction`, `rejectAction` — atomar, Payload-Transaction, Octokit-Wrapper mit Compensating-Action |
| `src/components/admin/SubmissionWorkflowButtons.tsx` | **NEU** | Custom UI-Field (Payload-Field-Component): 3 Buttons je nach `reviewStatus`, ruft Server-Actions |
| `src/components/admin/InlineSectionDiff.tsx` | **NEU** | Custom UI-Field pro Sektion: Plain-Text-Diff oder Read-Only-Preview je nach `submission.type` |
| `src/components/PiiNotice.tsx` | **NEU** | Datenschutz-Hinweisbox, in SubmissionForm über erstem Inhaltsfeld |
| `src/components/SubmissionForm.tsx` | MODIFIZIERT | PII-Notice einbinden |
| `src/lib/env.ts` | **NEU** | `getGithubConfig()` — strukturierter Zugriff auf 5 ENV-Vars, Production-Boot-Check |
| `src/payload.config.ts` | MODIFIZIERT | Boot-Check aufrufen, ggf. Custom-Fields registrieren |
| `.env.example` | MODIFIZIERT (Append) | GitHub-Sektion mit allen 5 Vars + Kommentar |
| `README.md` | MODIFIZIERT (Append) | Kurzer Hinweis auf V1.5-PR-Workflow im Submission-Abschnitt |
| `CONTRIBUTING.md` | MODIFIZIERT (Append) | Abschnitt „Pull-Requests" mit Inhalts-vs-Code-PR-Konvention |
| `package.json` / `pnpm-lock.yaml` | MODIFIZIERT (auto) | `@octokit/auth-app`, `@octokit/rest`, `diff`, `@types/diff`, `js-yaml`, `@types/js-yaml` via `pnpm add` |
| `tests/unit/lexical-to-markdown.test.ts` | **NEU** | Roundtrip: paragraph, bold, italic, list, ordered list, link, leere Felder |
| `tests/unit/article-markdown.test.ts` | **NEU** | Frontmatter-Felder, Body-Headings, Hash-Stabilität |
| `tests/unit/submission-to-article.test.ts` | **NEU** | new_article-Pfad, correction-Pfad (nur edited Sektionen ersetzen) |
| `tests/unit/submission-section-diff.test.ts` | **NEU** | Identische Sektion, hinzugefügte Zeilen, gelöschte Zeilen, Mix |
| `tests/unit/slug-resolver.test.ts` | **NEU** | Erst-Slug frei, mit Suffix `-2`, mit Suffix `-3` |
| `tests/unit/github-app.test.ts` | **NEU** | Lazy Singleton, returns `null` ohne ENV, mockt `createAppAuth` |
| `tests/unit/github-pr.test.ts` | **NEU** | Branch-Create, PR-Create, Push-Edit, Merge, Close — alles via Octokit-Mock |
| `tests/unit/github-article-sync.test.ts` | **NEU** | Upsert (new + update), Delete, Hash-Vergleich, kein Commit bei Idempotenz |
| `tests/unit/env-github.test.ts` | **NEU** | Production-Boot-Check throws, Dev returns null bei fehlender ENV |
| `tests/integration/submission-action-in-review.test.ts` | **NEU** | Happy path + Octokit-Fail-Rollback |
| `tests/integration/submission-action-accept.test.ts` | **NEU** | Happy path (new_article + correction), `skipMarkdownSync`-Flag wird gesetzt |
| `tests/integration/submission-action-reject.test.ts` | **NEU** | Mit und ohne existierenden PR |
| `tests/integration/article-sync-hook.test.ts` | **NEU** | Direkt-Edit → Markdown-Commit, Skip wenn `skipMarkdownSync=true`, Status-Wechsel → Delete |
| `tests/component/PiiNotice.test.tsx` | **NEU** | Rendert Text, ist sichtbar |
| `tests/component/SubmissionWorkflowButtons.test.tsx` | **NEU** | Button-Sichtbarkeit pro `reviewStatus`, Click-Handler-Wiring |
| `tests/component/InlineSectionDiff.test.tsx` | **NEU** | Correction: zeigt Diff; New-Article: zeigt Preview |
| `tests/component/SubmissionForm.test.tsx` | MODIFIZIERT | Assertion „PII-Notice ist sichtbar" |

---

## Setup-Track (parallel zum Code)

V1.5 braucht eine GitHub App. **Oliver klickt, Claude assistiert.** Diese Pre-Tasks laufen parallel zu Tasks 1–14 — der Code-Track funktioniert komplett ohne echte Creds dank Dev-Bypass.

### Pre-Task A: GitHub-App-Setup

- [ ] **A1:** Browse zu `https://github.com/settings/apps/new` (Oliver eingeloggt als `shogun160`).
- [ ] **A2:** Felder ausfüllen:
  - GitHub App name: `pflegeatlas-bot`
  - Homepage URL: `https://github.com/shogun160/pflege-atlas`
  - Webhook → **„Active" Checkbox AUSSCHALTEN** (kein Webhook nötig)
- [ ] **A3:** Permissions setzen:
  - Repository: **Contents** = Read & write
  - Repository: **Pull requests** = Read & write
  - Repository: **Metadata** = Read-only
- [ ] **A4:** „Where can this GitHub App be installed?" → **Only on this account** (= `shogun160`).
- [ ] **A5:** „Create GitHub App" klicken. Auf der nächsten Seite **App ID** notieren (oben rechts).
- [ ] **A6:** „Install App" klicken (Sidebar). Repository auswählen: `pflege-atlas`. Installieren.
- [ ] **A7:** Nach Installation: URL prüfen — am Ende steht `/installations/<INSTALLATION_ID>`. **Installation ID** notieren.
- [ ] **A8:** Zurück zu App-Settings → unten „Private keys" → „Generate a private key". `.pem`-Datei wird heruntergeladen.
- [ ] **A9:** Lokal base64-encoden (single line):
  ```bash
  base64 -i ~/Downloads/pflegeatlas-bot.*.private-key.pem | tr -d '\n' > /tmp/pk.b64
  ```
- [ ] **A10:** Alle drei Werte in 1Password ablegen (Eintrag „PflegeAtlas GitHub App"):
  - App ID
  - Installation ID
  - Private Key (base64, single line) — Inhalt von `/tmp/pk.b64`
- [ ] **A11:** `.pem` und `/tmp/pk.b64` lokal löschen.
  ```bash
  rm ~/Downloads/pflegeatlas-bot.*.private-key.pem /tmp/pk.b64
  ```

---

## Task 1: Dependencies installieren

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (auto durch `pnpm add`)

- [ ] **Step 1:** Branch-Check.
  ```bash
  git status && git branch --show-current
  ```
  Expected: `On branch feat/v1-5-submissions-as-prs`, Spec + Brainstorm-Doc bereits committed (Commit `7e62af1`).

- [ ] **Step 2:** Octokit + Diff + YAML installieren.
  ```bash
  pnpm add @octokit/auth-app @octokit/rest diff js-yaml
  pnpm add -D @types/diff @types/js-yaml
  ```
  Expected: Installation erfolgreich, keine Peer-Dependency-Warnings.

- [ ] **Step 3:** Verify Versionen passen zu Node 22.
  ```bash
  grep -E '"(@octokit/(auth-app|rest)|diff|js-yaml)"' package.json
  ```
  Expected: 4 Zeilen, alle vorhanden.

- [ ] **Step 4:** Tests + Lint laufen lassen (Baseline grün).
  ```bash
  pnpm test && pnpm lint
  ```
  Expected: alle 138 Baseline-Tests grün, 30 Warnings (unverändert).

- [ ] **Step 5:** Commit.
  ```bash
  git add package.json pnpm-lock.yaml
  git commit -m "feat(v1.5): add @octokit + diff + js-yaml deps"
  ```

---

## Task 2: Lexical→Markdown-Walker

**Files:**
- Create: `src/lib/lexical-to-markdown.ts`
- Create: `tests/unit/lexical-to-markdown.test.ts`

**Vorbild:** `src/lib/lexical-to-plain-text.ts` (Walker-Pattern: rekursiv über `node.type`).

- [ ] **Step 1:** Test-Datei schreiben mit Fixtures für alle Toolbar-Cases.
  ```typescript
  // tests/unit/lexical-to-markdown.test.ts
  import { describe, expect, it } from 'vitest';
  import { lexicalToMarkdown } from '@/lib/lexical-to-markdown';

  describe('lexicalToMarkdown', () => {
    it('returns empty string for null root', () => {
      expect(lexicalToMarkdown(null)).toBe('');
    });

    it('returns empty string for empty children', () => {
      expect(lexicalToMarkdown({ type: 'root', children: [] })).toBe('');
    });

    it('renders a plain paragraph', () => {
      const root = {
        type: 'root',
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'Hallo Welt' }] },
        ],
      };
      expect(lexicalToMarkdown(root)).toBe('Hallo Welt');
    });

    it('renders bold via format bitmask 1', () => {
      const root = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'fett', format: 1 }],
          },
        ],
      };
      expect(lexicalToMarkdown(root)).toBe('**fett**');
    });

    it('renders italic via format bitmask 2', () => {
      const root = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'kursiv', format: 2 }],
          },
        ],
      };
      expect(lexicalToMarkdown(root)).toBe('*kursiv*');
    });

    it('renders bold+italic via format bitmask 3', () => {
      const root = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'beides', format: 3 }],
          },
        ],
      };
      expect(lexicalToMarkdown(root)).toBe('***beides***');
    });

    it('renders an unordered list', () => {
      const root = {
        type: 'root',
        children: [
          {
            type: 'list',
            listType: 'bullet',
            children: [
              { type: 'listitem', children: [{ type: 'text', text: 'a' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'b' }] },
            ],
          },
        ],
      };
      expect(lexicalToMarkdown(root)).toBe('- a\n- b');
    });

    it('renders an ordered list with sequential numbers', () => {
      const root = {
        type: 'root',
        children: [
          {
            type: 'list',
            listType: 'number',
            children: [
              { type: 'listitem', children: [{ type: 'text', text: 'erste' }] },
              { type: 'listitem', children: [{ type: 'text', text: 'zweite' }] },
            ],
          },
        ],
      };
      expect(lexicalToMarkdown(root)).toBe('1. erste\n2. zweite');
    });

    it('renders a link', () => {
      const root = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                url: 'https://example.com',
                children: [{ type: 'text', text: 'Beispiel' }],
              },
            ],
          },
        ],
      };
      expect(lexicalToMarkdown(root)).toBe('[Beispiel](https://example.com)');
    });

    it('separates multiple blocks with double newline', () => {
      const root = {
        type: 'root',
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'Absatz 1' }] },
          { type: 'paragraph', children: [{ type: 'text', text: 'Absatz 2' }] },
        ],
      };
      expect(lexicalToMarkdown(root)).toBe('Absatz 1\n\nAbsatz 2');
    });

    it('accepts wrapped {root:{...}} shape from Lexical editor output', () => {
      const wrapped = {
        root: {
          type: 'root',
          children: [
            { type: 'paragraph', children: [{ type: 'text', text: 'wrapped' }] },
          ],
        },
      };
      expect(lexicalToMarkdown(wrapped)).toBe('wrapped');
    });
  });
  ```

- [ ] **Step 2:** Tests laufen, erwarten FAIL.
  ```bash
  pnpm test tests/unit/lexical-to-markdown.test.ts
  ```
  Expected: alle 11 Tests rot, Modul fehlt.

- [ ] **Step 3:** Walker-Implementation schreiben.
  ```typescript
  // src/lib/lexical-to-markdown.ts
  type Node = {
    type?: string;
    children?: Node[];
    text?: string;
    url?: string;
    listType?: string;
    format?: number;
  };

  type RootInput = Node | { root: Node } | null | undefined;

  const FORMAT_BOLD = 1;
  const FORMAT_ITALIC = 2;

  function unwrap(input: RootInput): Node | null {
    if (!input) return null;
    if ('root' in input && input.root) return input.root as Node;
    return input as Node;
  }

  function applyTextFormat(text: string, format: number | undefined): string {
    if (!format || !text) return text;
    let result = text;
    if (format & FORMAT_BOLD && format & FORMAT_ITALIC) {
      result = `***${result}***`;
    } else if (format & FORMAT_BOLD) {
      result = `**${result}**`;
    } else if (format & FORMAT_ITALIC) {
      result = `*${result}*`;
    }
    return result;
  }

  function renderInline(nodes: Node[] | undefined): string {
    if (!Array.isArray(nodes)) return '';
    return nodes.map((n) => renderInlineNode(n)).join('');
  }

  function renderInlineNode(node: Node): string {
    switch (node.type) {
      case 'text':
        return applyTextFormat(typeof node.text === 'string' ? node.text : '', node.format);
      case 'linebreak':
        return '\n';
      case 'link': {
        const inner = renderInline(node.children);
        return node.url ? `[${inner}](${node.url})` : inner;
      }
      default:
        return renderInline(node.children);
    }
  }

  function renderBlock(node: Node): string {
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
    return renderInline(node.children);
  }

  export function lexicalToMarkdown(input: RootInput): string {
    const root = unwrap(input);
    if (!root || !Array.isArray(root.children) || root.children.length === 0) return '';
    const blocks = root.children.map((child) => renderBlock(child));
    return blocks.filter((b) => b.length > 0).join('\n\n');
  }
  ```

- [ ] **Step 4:** Tests laufen, erwarten PASS.
  ```bash
  pnpm test tests/unit/lexical-to-markdown.test.ts
  ```
  Expected: 11/11 grün.

- [ ] **Step 5:** Commit.
  ```bash
  git add src/lib/lexical-to-markdown.ts tests/unit/lexical-to-markdown.test.ts
  git commit -m "feat(v1.5): lexical-to-markdown walker"
  ```

---

## Task 3: Article-Markdown-Renderer

**Files:**
- Create: `src/lib/article-markdown.ts`
- Create: `tests/unit/article-markdown.test.ts`

- [ ] **Step 1:** Test-Datei schreiben.
  ```typescript
  // tests/unit/article-markdown.test.ts
  import { describe, expect, it } from 'vitest';
  import { renderArticleMarkdown, hashContent } from '@/lib/article-markdown';

  const SAMPLE_LEXICAL = {
    root: {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Hallo' }] },
      ],
    },
  };

  const SAMPLE_ARTICLE = {
    id: 42,
    title: 'Dekubitusprophylaxe',
    slug: 'dekubitusprophylaxe',
    intent: 'bedside',
    summary: 'Vorbeugung von Druckgeschwüren',
    status: 'published',
    lastReviewedAt: '2026-06-20',
    standardsBound: true,
    definition: SAMPLE_LEXICAL,
    praxis: SAMPLE_LEXICAL,
    risiken: SAMPLE_LEXICAL,
    quellen: SAMPLE_LEXICAL,
  };

  describe('renderArticleMarkdown', () => {
    it('emits frontmatter with all expected fields', () => {
      const md = renderArticleMarkdown(SAMPLE_ARTICLE, ['Christoph Brück']);
      expect(md).toContain('---\n');
      expect(md).toContain('payloadId: 42');
      expect(md).toContain('slug: dekubitusprophylaxe');
      expect(md).toContain('title: Dekubitusprophylaxe');
      expect(md).toContain('intent: bedside');
      expect(md).toContain('summary: Vorbeugung von Druckgeschwüren');
      expect(md).toContain('status: published');
      expect(md).toContain('lastReviewedAt: 2026-06-20');
      expect(md).toContain('standardsBound: true');
      expect(md).toContain('authors:\n  - Christoph Brück');
    });

    it('emits the four section headings in fixed order', () => {
      const md = renderArticleMarkdown(SAMPLE_ARTICLE, []);
      const defIdx = md.indexOf('## Definition');
      const prxIdx = md.indexOf('## Praxis');
      const rskIdx = md.indexOf('## Risiken & Fallstricke');
      const qulIdx = md.indexOf('## Quellen & Weiterführendes');
      expect(defIdx).toBeGreaterThan(0);
      expect(prxIdx).toBeGreaterThan(defIdx);
      expect(rskIdx).toBeGreaterThan(prxIdx);
      expect(qulIdx).toBeGreaterThan(rskIdx);
    });

    it('falls back to empty authors list when none provided', () => {
      const md = renderArticleMarkdown(SAMPLE_ARTICLE, []);
      expect(md).toContain('authors: []');
    });

    it('omits lastReviewedAt when not set', () => {
      const article = { ...SAMPLE_ARTICLE, lastReviewedAt: undefined };
      const md = renderArticleMarkdown(article, []);
      expect(md).not.toContain('lastReviewedAt');
    });

    it('quotes title and summary if they contain special chars', () => {
      const article = { ...SAMPLE_ARTICLE, title: 'Mit: Doppelpunkt', summary: 'Hat # Hash' };
      const md = renderArticleMarkdown(article, []);
      expect(md).toContain("title: 'Mit: Doppelpunkt'");
      expect(md).toContain("summary: 'Hat # Hash'");
    });
  });

  describe('hashContent', () => {
    it('returns same hash for identical content', () => {
      expect(hashContent('abc')).toBe(hashContent('abc'));
    });

    it('returns different hash for different content', () => {
      expect(hashContent('abc')).not.toBe(hashContent('abd'));
    });
  });
  ```

- [ ] **Step 2:** Tests laufen, erwarten FAIL.
  ```bash
  pnpm test tests/unit/article-markdown.test.ts
  ```
  Expected: 7/7 rot, Modul fehlt.

- [ ] **Step 3:** Implementation schreiben.
  ```typescript
  // src/lib/article-markdown.ts
  import { createHash } from 'crypto';
  import yaml from 'js-yaml';
  import { lexicalToMarkdown } from './lexical-to-markdown';

  type ArticleInput = {
    id: number;
    title: string;
    slug: string;
    intent: string;
    summary: string;
    status: string;
    lastReviewedAt?: string | Date | null;
    standardsBound?: boolean;
    definition: unknown;
    praxis: unknown;
    risiken: unknown;
    quellen: unknown;
  };

  function isoDate(value: string | Date | null | undefined): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'string') return value.slice(0, 10);
    return undefined;
  }

  export function renderArticleMarkdown(article: ArticleInput, authorNames: string[]): string {
    const frontmatter: Record<string, unknown> = {
      payloadId: article.id,
      slug: article.slug,
      title: article.title,
      intent: article.intent,
      summary: article.summary,
      status: article.status,
      authors: authorNames,
    };

    const reviewed = isoDate(article.lastReviewedAt);
    if (reviewed) frontmatter.lastReviewedAt = reviewed;
    if (typeof article.standardsBound === 'boolean') {
      frontmatter.standardsBound = article.standardsBound;
    }

    const yamlBlock = yaml.dump(frontmatter, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });

    const sections = [
      `## Definition\n\n${lexicalToMarkdown(article.definition as never)}`,
      `## Praxis\n\n${lexicalToMarkdown(article.praxis as never)}`,
      `## Risiken & Fallstricke\n\n${lexicalToMarkdown(article.risiken as never)}`,
      `## Quellen & Weiterführendes\n\n${lexicalToMarkdown(article.quellen as never)}`,
    ];

    return `---\n${yamlBlock}---\n\n${sections.join('\n\n')}\n`;
  }

  export function hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
  ```

- [ ] **Step 4:** Tests laufen, erwarten PASS.
  ```bash
  pnpm test tests/unit/article-markdown.test.ts
  ```
  Expected: 7/7 grün.

- [ ] **Step 5:** Commit.
  ```bash
  git add src/lib/article-markdown.ts tests/unit/article-markdown.test.ts
  git commit -m "feat(v1.5): article-markdown renderer + content hash"
  ```

---

## Task 4: Slug-Resolver

**Files:**
- Create: `src/lib/slug-resolver.ts`
- Create: `tests/unit/slug-resolver.test.ts`

- [ ] **Step 1:** Test-Datei schreiben.
  ```typescript
  // tests/unit/slug-resolver.test.ts
  import { describe, expect, it } from 'vitest';
  import { resolveUniqueSlug } from '@/lib/slug-resolver';

  describe('resolveUniqueSlug', () => {
    it('returns base slug if not taken', async () => {
      const exists = async (s: string) => s === 'taken';
      expect(await resolveUniqueSlug('frei', exists)).toBe('frei');
    });

    it('appends -2 if base taken', async () => {
      const exists = async (s: string) => s === 'taken';
      expect(await resolveUniqueSlug('taken', exists)).toBe('taken-2');
    });

    it('appends -3 if base and -2 taken', async () => {
      const taken = new Set(['x', 'x-2']);
      const exists = async (s: string) => taken.has(s);
      expect(await resolveUniqueSlug('x', exists)).toBe('x-3');
    });

    it('gives up after 100 attempts', async () => {
      const exists = async () => true;
      await expect(resolveUniqueSlug('any', exists)).rejects.toThrow(/no unique slug/i);
    });
  });
  ```

- [ ] **Step 2:** Tests laufen, erwarten FAIL.
  ```bash
  pnpm test tests/unit/slug-resolver.test.ts
  ```

- [ ] **Step 3:** Implementation schreiben.
  ```typescript
  // src/lib/slug-resolver.ts
  export async function resolveUniqueSlug(
    base: string,
    exists: (slug: string) => Promise<boolean>,
  ): Promise<string> {
    if (!(await exists(base))) return base;
    for (let i = 2; i <= 100; i++) {
      const candidate = `${base}-${i}`;
      if (!(await exists(candidate))) return candidate;
    }
    throw new Error(`No unique slug found after 100 attempts (base="${base}")`);
  }
  ```

- [ ] **Step 4:** Tests laufen, erwarten PASS.
  ```bash
  pnpm test tests/unit/slug-resolver.test.ts
  ```

- [ ] **Step 5:** Commit.
  ```bash
  git add src/lib/slug-resolver.ts tests/unit/slug-resolver.test.ts
  git commit -m "feat(v1.5): slug-resolver with suffix fallback"
  ```

---

## Task 5: ENV-Config + Production-Boot-Check

**Files:**
- Create: `src/lib/env.ts`
- Create: `tests/unit/env-github.test.ts`

- [ ] **Step 1:** Test-Datei schreiben.
  ```typescript
  // tests/unit/env-github.test.ts
  import { describe, expect, it, beforeEach, afterEach } from 'vitest';
  import { getGithubConfig, assertGithubConfigInProduction } from '@/lib/env';

  const VARS = [
    'GITHUB_APP_ID',
    'GITHUB_APP_INSTALLATION_ID',
    'GITHUB_APP_PRIVATE_KEY',
    'GITHUB_REPO_OWNER',
    'GITHUB_REPO_NAME',
    'NODE_ENV',
  ];

  describe('getGithubConfig', () => {
    const saved: Record<string, string | undefined> = {};
    beforeEach(() => {
      VARS.forEach((k) => {
        saved[k] = process.env[k];
        delete process.env[k];
      });
    });
    afterEach(() => {
      VARS.forEach((k) => {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      });
    });

    it('returns null when private key is missing', () => {
      expect(getGithubConfig()).toBeNull();
    });

    it('returns config with defaults when all vars are set', () => {
      process.env.GITHUB_APP_ID = '12345';
      process.env.GITHUB_APP_INSTALLATION_ID = '67890';
      process.env.GITHUB_APP_PRIVATE_KEY = 'aGVsbG8=';
      const cfg = getGithubConfig();
      expect(cfg).toEqual({
        appId: '12345',
        installationId: '67890',
        privateKey: 'aGVsbG8=',
        owner: 'shogun160',
        repo: 'pflege-atlas',
      });
    });

    it('honours custom owner/repo overrides', () => {
      process.env.GITHUB_APP_ID = '1';
      process.env.GITHUB_APP_INSTALLATION_ID = '2';
      process.env.GITHUB_APP_PRIVATE_KEY = 'x';
      process.env.GITHUB_REPO_OWNER = 'sandbox-owner';
      process.env.GITHUB_REPO_NAME = 'sandbox-repo';
      expect(getGithubConfig()?.owner).toBe('sandbox-owner');
      expect(getGithubConfig()?.repo).toBe('sandbox-repo');
    });
  });

  describe('assertGithubConfigInProduction', () => {
    const saved: Record<string, string | undefined> = {};
    beforeEach(() => {
      VARS.forEach((k) => {
        saved[k] = process.env[k];
        delete process.env[k];
      });
    });
    afterEach(() => {
      VARS.forEach((k) => {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      });
    });

    it('does nothing in development', () => {
      process.env.NODE_ENV = 'development';
      expect(() => assertGithubConfigInProduction()).not.toThrow();
    });

    it('throws in production when private key missing', () => {
      process.env.NODE_ENV = 'production';
      expect(() => assertGithubConfigInProduction()).toThrow(/GITHUB_APP_PRIVATE_KEY/);
    });

    it('passes in production when all vars set', () => {
      process.env.NODE_ENV = 'production';
      process.env.GITHUB_APP_ID = '1';
      process.env.GITHUB_APP_INSTALLATION_ID = '2';
      process.env.GITHUB_APP_PRIVATE_KEY = 'x';
      expect(() => assertGithubConfigInProduction()).not.toThrow();
    });
  });
  ```

- [ ] **Step 2:** Tests laufen, erwarten FAIL.
  ```bash
  pnpm test tests/unit/env-github.test.ts
  ```

- [ ] **Step 3:** Implementation schreiben.
  ```typescript
  // src/lib/env.ts
  export type GithubConfig = {
    appId: string;
    installationId: string;
    privateKey: string;
    owner: string;
    repo: string;
  };

  export function getGithubConfig(): GithubConfig | null {
    const appId = process.env.GITHUB_APP_ID;
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    if (!appId || !installationId || !privateKey) return null;
    return {
      appId,
      installationId,
      privateKey,
      owner: process.env.GITHUB_REPO_OWNER || 'shogun160',
      repo: process.env.GITHUB_REPO_NAME || 'pflege-atlas',
    };
  }

  export function assertGithubConfigInProduction(): void {
    if (process.env.NODE_ENV !== 'production') return;
    const missing: string[] = [];
    if (!process.env.GITHUB_APP_ID) missing.push('GITHUB_APP_ID');
    if (!process.env.GITHUB_APP_INSTALLATION_ID) missing.push('GITHUB_APP_INSTALLATION_ID');
    if (!process.env.GITHUB_APP_PRIVATE_KEY) missing.push('GITHUB_APP_PRIVATE_KEY');
    if (missing.length === 0) return;
    throw new Error(
      `[V1.5 GitHub Sync] Missing required env vars in production: ${missing.join(', ')}. ` +
        `Set them in your deployment environment (values are in 1Password under "PflegeAtlas GitHub App").`,
    );
  }
  ```

- [ ] **Step 4:** Tests laufen, erwarten PASS.
  ```bash
  pnpm test tests/unit/env-github.test.ts
  ```

- [ ] **Step 5:** Boot-Check in `payload.config.ts` aufrufen.
  ```typescript
  // src/payload.config.ts — am Datei-Anfang, vor anderen Imports falls möglich
  import { assertGithubConfigInProduction } from '@/lib/env';
  assertGithubConfigInProduction();
  ```

- [ ] **Step 6:** Tests + Lint.
  ```bash
  pnpm test && pnpm lint
  ```
  Expected: alle grün, keine neuen Warnings.

- [ ] **Step 7:** Commit.
  ```bash
  git add src/lib/env.ts src/payload.config.ts tests/unit/env-github.test.ts
  git commit -m "feat(v1.5): github env config + production boot check"
  ```

---

## Task 6: Octokit-App-Auth-Singleton

**Files:**
- Create: `src/lib/github-app.ts`
- Create: `tests/unit/github-app.test.ts`

- [ ] **Step 1:** Test-Datei schreiben (Mock von `@octokit/auth-app` und `@octokit/rest` via `vi.hoisted`).
  ```typescript
  // tests/unit/github-app.test.ts
  import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

  const mocks = vi.hoisted(() => ({
    createAppAuth: vi.fn(),
    OctokitMock: vi.fn(),
  }));

  vi.mock('@octokit/auth-app', () => ({ createAppAuth: mocks.createAppAuth }));
  vi.mock('@octokit/rest', () => ({ Octokit: mocks.OctokitMock }));

  const ENV_KEYS = [
    'GITHUB_APP_ID',
    'GITHUB_APP_INSTALLATION_ID',
    'GITHUB_APP_PRIVATE_KEY',
  ];

  describe('getOctokit', () => {
    const saved: Record<string, string | undefined> = {};
    beforeEach(() => {
      vi.resetModules();
      mocks.createAppAuth.mockReset();
      mocks.OctokitMock.mockReset();
      ENV_KEYS.forEach((k) => {
        saved[k] = process.env[k];
        delete process.env[k];
      });
    });
    afterEach(() => {
      ENV_KEYS.forEach((k) => {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      });
    });

    it('returns null when env vars are missing', async () => {
      const { getOctokit } = await import('@/lib/github-app');
      expect(getOctokit()).toBeNull();
      expect(mocks.OctokitMock).not.toHaveBeenCalled();
    });

    it('decodes base64 private key and constructs Octokit with auth strategy', async () => {
      process.env.GITHUB_APP_ID = '12345';
      process.env.GITHUB_APP_INSTALLATION_ID = '67890';
      // base64('---PEM---') → 'LS0tUEVNLS0t'
      process.env.GITHUB_APP_PRIVATE_KEY = 'LS0tUEVNLS0t';
      mocks.OctokitMock.mockImplementation(() => ({ rest: {} }));
      const { getOctokit } = await import('@/lib/github-app');
      const client = getOctokit();
      expect(client).not.toBeNull();
      expect(mocks.OctokitMock).toHaveBeenCalledTimes(1);
      const call = mocks.OctokitMock.mock.calls[0][0];
      expect(call.authStrategy).toBe(mocks.createAppAuth);
      expect(call.auth.appId).toBe('12345');
      expect(call.auth.installationId).toBe('67890');
      expect(call.auth.privateKey).toBe('---PEM---');
    });

    it('returns cached instance on second call', async () => {
      process.env.GITHUB_APP_ID = '1';
      process.env.GITHUB_APP_INSTALLATION_ID = '2';
      process.env.GITHUB_APP_PRIVATE_KEY = 'LS0tUEVNLS0t';
      mocks.OctokitMock.mockImplementation(() => ({ rest: {} }));
      const { getOctokit } = await import('@/lib/github-app');
      const first = getOctokit();
      const second = getOctokit();
      expect(first).toBe(second);
      expect(mocks.OctokitMock).toHaveBeenCalledTimes(1);
    });
  });
  ```

- [ ] **Step 2:** Tests laufen, erwarten FAIL.
  ```bash
  pnpm test tests/unit/github-app.test.ts
  ```

- [ ] **Step 3:** Implementation schreiben.
  ```typescript
  // src/lib/github-app.ts
  import 'server-only';
  import { Octokit } from '@octokit/rest';
  import { createAppAuth } from '@octokit/auth-app';
  import { getGithubConfig } from './env';

  let cached: Octokit | null = null;

  export function getOctokit(): Octokit | null {
    if (cached) return cached;
    const cfg = getGithubConfig();
    if (!cfg) return null;
    const privateKeyPem = Buffer.from(cfg.privateKey, 'base64').toString('utf8');
    cached = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: cfg.appId,
        installationId: cfg.installationId,
        privateKey: privateKeyPem,
      },
    });
    return cached;
  }

  /** Test-only: reset singleton cache between test cases. */
  export function __resetOctokitCacheForTests(): void {
    cached = null;
  }
  ```

- [ ] **Step 4:** Tests laufen, erwarten PASS.
  ```bash
  pnpm test tests/unit/github-app.test.ts
  ```

- [ ] **Step 5:** Commit.
  ```bash
  git add src/lib/github-app.ts tests/unit/github-app.test.ts
  git commit -m "feat(v1.5): octokit app-auth singleton with lazy init"
  ```

---

## Task 7: DB-Schema-Migration für 4 neue Submission-Spalten

**Files:**
- Create: `src/migrations/<timestamp>_v1_5_submissions_pr_fields.ts`
- Modify: `src/collections/Submissions.ts` (Feld-Definitionen, noch kein Hook)

**V1.4-Lesson:** Falls `pnpm payload migrate:create` auf non-TTY-stdin hängt, Migration manuell schreiben (siehe Step 4).

- [ ] **Step 1:** Submissions-Collection um 4 Felder erweitern (vor dem `reviewStatus`-Feld einfügen).
  ```typescript
  // src/collections/Submissions.ts — in die fields-Array vor reviewStatus einfügen
  {
    name: 'proposedSlug',
    type: 'text',
    label: 'Slug (URL-Pfad nach Annahme)',
    admin: {
      condition: conditionNewArticle,
      description: 'Wird beim "In Review nehmen" automatisch befüllt, kann hier angepasst werden.',
    },
  },
  {
    name: 'prNumber',
    type: 'number',
    label: 'PR-Nummer',
    admin: { readOnly: true, position: 'sidebar' },
  },
  {
    name: 'prBranch',
    type: 'text',
    label: 'PR-Branch',
    admin: { readOnly: true, position: 'sidebar' },
  },
  {
    name: 'prState',
    type: 'select',
    label: 'PR-Status',
    options: [
      { label: 'Offen', value: 'open' },
      { label: 'Gemerged', value: 'merged' },
      { label: 'Geschlossen', value: 'closed' },
    ],
    admin: { readOnly: true, position: 'sidebar' },
  },
  ```

- [ ] **Step 2:** Versuch, Migration via CLI zu erzeugen.
  ```bash
  pnpm payload migrate:create v1_5_submissions_pr_fields
  ```
  - Wenn das durchläuft → mit Step 5 weiter.
  - Wenn es auf stdin hängt → Strg-C, weiter mit Step 3 (manuelle Migration).

- [ ] **Step 3:** Manuelle Migration anlegen (Fallback). Timestamp aus dem aktuellen Moment ableiten.
  ```bash
  TS=$(date -u +%Y%m%d_%H%M%S)
  touch src/migrations/${TS}_v1_5_submissions_pr_fields.ts
  ```

- [ ] **Step 4:** Migration-Inhalt schreiben (Pfad aus Step 3 verwenden).
  ```typescript
  // src/migrations/<TS>_v1_5_submissions_pr_fields.ts
  import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

  /**
   * V1.5 — adds PR-tracking columns to submissions:
   *   - proposed_slug (text, nullable, new_article only)
   *   - pr_number (integer, nullable)
   *   - pr_branch (text, nullable)
   *   - pr_state (enum 'open'/'merged'/'closed', nullable)
   *
   * Hand-written because `pnpm payload migrate:create` hangs on non-TTY stdin
   * in this shell (V1.4-lesson).
   */
  export async function up({ db }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE "enum_submissions_pr_state" AS ENUM ('open', 'merged', 'closed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.execute(sql`
      ALTER TABLE "submissions"
        ADD COLUMN IF NOT EXISTS "proposed_slug" varchar,
        ADD COLUMN IF NOT EXISTS "pr_number" numeric,
        ADD COLUMN IF NOT EXISTS "pr_branch" varchar,
        ADD COLUMN IF NOT EXISTS "pr_state" "enum_submissions_pr_state";
    `);
  }

  export async function down({ db }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`
      ALTER TABLE "submissions"
        DROP COLUMN IF EXISTS "proposed_slug",
        DROP COLUMN IF EXISTS "pr_number",
        DROP COLUMN IF EXISTS "pr_branch",
        DROP COLUMN IF EXISTS "pr_state";
    `);
    await db.execute(sql`DROP TYPE IF EXISTS "enum_submissions_pr_state";`);
  }
  ```

- [ ] **Step 5:** Migration applien (auto-detect: wenn `pnpm payload migrate` hängt, manuell via psql).
  ```bash
  # Versuch 1 — CLI
  pnpm payload migrate
  # Wenn hängt: Strg-C, dann manuell:
  TS=<aus Step 3>
  docker exec -i pflegecommons-postgres psql -U pflege -d pflegecommons <<SQL
  CREATE TYPE "enum_submissions_pr_state" AS ENUM ('open', 'merged', 'closed');
  ALTER TABLE "submissions"
    ADD COLUMN IF NOT EXISTS "proposed_slug" varchar,
    ADD COLUMN IF NOT EXISTS "pr_number" numeric,
    ADD COLUMN IF NOT EXISTS "pr_branch" varchar,
    ADD COLUMN IF NOT EXISTS "pr_state" "enum_submissions_pr_state";
  INSERT INTO payload_migrations (name, batch, created_at, updated_at)
    VALUES ('${TS}_v1_5_submissions_pr_fields', 2, NOW(), NOW());
  SQL
  ```

- [ ] **Step 6:** Schema-Sanity.
  ```bash
  docker exec pflegecommons-postgres psql -U pflege -d pflegecommons -c "\d submissions" | grep -E "proposed_slug|pr_(number|branch|state)"
  ```
  Expected: 4 neue Zeilen.

- [ ] **Step 7:** Tests + Lint + Build.
  ```bash
  pnpm test && pnpm lint && pnpm build
  ```
  Expected: alle grün.

- [ ] **Step 8:** Commit.
  ```bash
  git add src/migrations src/collections/Submissions.ts
  git commit -m "feat(v1.5): schema migration for PR tracking + slug override fields"
  ```

---


## Task 8: github-pr.ts Octokit-Wrapper

**Files:**
- Create: `src/lib/github-pr.ts`
- Create: `tests/unit/github-pr.test.ts`

Vier High-Level-Funktionen: `createSubmissionPR`, `pushSubmissionEdit`, `mergeSubmissionPR`, `closeSubmissionPR`. Alle nehmen einen `Octokit` als Parameter (Dependency-Injection für Testbarkeit). Wenn der Caller `null` übergibt (= Dev-Bypass), returnen sie ein No-Op-Result.

- [ ] **Step 1:** Test-Datei schreiben.
  ```typescript
  // tests/unit/github-pr.test.ts
  import { describe, expect, it, vi } from 'vitest';
  import {
    createSubmissionPR,
    pushSubmissionEdit,
    mergeSubmissionPR,
    closeSubmissionPR,
  } from '@/lib/github-pr';

  function mockOctokit() {
    return {
      rest: {
        git: {
          getRef: vi.fn().mockResolvedValue({ data: { object: { sha: 'main-sha' } } }),
          createRef: vi.fn().mockResolvedValue({}),
          deleteRef: vi.fn().mockResolvedValue({}),
        },
        repos: {
          getContent: vi.fn(),
          createOrUpdateFileContents: vi
            .fn()
            .mockResolvedValue({ data: { commit: { sha: 'commit-sha' } } }),
        },
        pulls: {
          create: vi.fn().mockResolvedValue({ data: { number: 42 } }),
          merge: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
        },
      },
    } as never;
  }

  const owner = 'shogun160';
  const repo = 'pflege-atlas';

  describe('createSubmissionPR', () => {
    it('returns no-op result when octokit is null (dev bypass)', async () => {
      const result = await createSubmissionPR(null, {
        owner,
        repo,
        submissionId: 7,
        slug: 'x',
        markdown: 'data',
        title: 'T',
        body: 'B',
      });
      expect(result).toEqual({ prNumber: null, prBranch: null, prState: 'skipped' });
    });

    it('creates branch, writes file, opens PR', async () => {
      const oct = mockOctokit();
      // Existing file lookup throws 404 → it's a new file
      (oct as never as { rest: { repos: { getContent: { mockRejectedValueOnce: (e: unknown) => void } } } })
        .rest.repos.getContent.mockRejectedValueOnce({ status: 404 });
      const result = await createSubmissionPR(oct, {
        owner,
        repo,
        submissionId: 7,
        slug: 'dekubitus',
        markdown: '---\nslug: dekubitus\n---\n## Definition\n\nhi\n',
        title: '[Vorschlag] Dekubitus',
        body: '**Typ:** Neuer Artikelvorschlag\n',
      });
      expect(oct.rest.git.createRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'refs/heads/submission/7', sha: 'main-sha' }),
      );
      expect(oct.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'content/articles/dekubitus.md',
          branch: 'submission/7',
        }),
      );
      expect(oct.rest.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          head: 'submission/7',
          base: 'main',
          title: '[Vorschlag] Dekubitus',
        }),
      );
      expect(result).toEqual({ prNumber: 42, prBranch: 'submission/7', prState: 'open' });
    });
  });

  describe('pushSubmissionEdit', () => {
    it('returns skipped when octokit is null', async () => {
      const result = await pushSubmissionEdit(null, {
        owner,
        repo,
        branch: 'submission/7',
        path: 'content/articles/x.md',
        markdown: 'new',
        message: 'edit',
      });
      expect(result.prState).toBe('skipped');
    });

    it('updates file with existing sha', async () => {
      const oct = mockOctokit();
      oct.rest.repos.getContent = vi.fn().mockResolvedValueOnce({
        data: { sha: 'old-sha' },
      });
      await pushSubmissionEdit(oct, {
        owner,
        repo,
        branch: 'submission/7',
        path: 'content/articles/x.md',
        markdown: 'new content',
        message: 'editorial revision',
      });
      expect(oct.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          sha: 'old-sha',
          message: 'editorial revision',
        }),
      );
    });

    it('replaces file at new path when slug changed (delete old, create new)', async () => {
      const oct = mockOctokit();
      // Old path lookup: found
      oct.rest.repos.getContent = vi
        .fn()
        .mockResolvedValueOnce({ data: { sha: 'old-sha' } })
        // New path lookup: 404
        .mockRejectedValueOnce({ status: 404 });
      oct.rest.repos.deleteFile = vi.fn().mockResolvedValue({});
      await pushSubmissionEdit(oct, {
        owner,
        repo,
        branch: 'submission/7',
        path: 'content/articles/new-slug.md',
        oldPath: 'content/articles/old-slug.md',
        markdown: 'new content',
        message: 'slug change',
      });
      expect(oct.rest.repos.deleteFile).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'content/articles/old-slug.md', sha: 'old-sha' }),
      );
      expect(oct.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'content/articles/new-slug.md' }),
      );
    });
  });

  describe('mergeSubmissionPR', () => {
    it('returns skipped when octokit is null', async () => {
      const result = await mergeSubmissionPR(null, { owner, repo, prNumber: 42, branch: 'submission/7' });
      expect(result.prState).toBe('skipped');
    });

    it('squash-merges and deletes the branch', async () => {
      const oct = mockOctokit();
      await mergeSubmissionPR(oct, { owner, repo, prNumber: 42, branch: 'submission/7' });
      expect(oct.rest.pulls.merge).toHaveBeenCalledWith(
        expect.objectContaining({ pull_number: 42, merge_method: 'squash' }),
      );
      expect(oct.rest.git.deleteRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'heads/submission/7' }),
      );
    });
  });

  describe('closeSubmissionPR', () => {
    it('returns skipped when octokit is null', async () => {
      const result = await closeSubmissionPR(null, { owner, repo, prNumber: 42, branch: 'submission/7' });
      expect(result.prState).toBe('skipped');
    });

    it('updates PR state to closed and deletes branch', async () => {
      const oct = mockOctokit();
      await closeSubmissionPR(oct, { owner, repo, prNumber: 42, branch: 'submission/7' });
      expect(oct.rest.pulls.update).toHaveBeenCalledWith(
        expect.objectContaining({ pull_number: 42, state: 'closed' }),
      );
      expect(oct.rest.git.deleteRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'heads/submission/7' }),
      );
    });
  });
  ```

- [ ] **Step 2:** Tests laufen, erwarten FAIL.
  ```bash
  pnpm test tests/unit/github-pr.test.ts
  ```

- [ ] **Step 3:** Implementation schreiben.
  ```typescript
  // src/lib/github-pr.ts
  import 'server-only';
  import type { Octokit } from '@octokit/rest';

  export type SyncResult = {
    prNumber: number | null;
    prBranch: string | null;
    prState: 'open' | 'merged' | 'closed' | 'skipped';
  };

  const NO_OP: SyncResult = { prNumber: null, prBranch: null, prState: 'skipped' };

  type RepoRef = { owner: string; repo: string };

  type CreateArgs = RepoRef & {
    submissionId: number;
    slug: string;
    markdown: string;
    title: string;
    body: string;
  };

  type PushArgs = RepoRef & {
    branch: string;
    path: string;
    oldPath?: string;
    markdown: string;
    message: string;
  };

  type MergeArgs = RepoRef & { prNumber: number; branch: string };
  type CloseArgs = MergeArgs;

  async function getFileSha(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string,
    ref: string,
  ): Promise<string | null> {
    try {
      const res = await octokit.rest.repos.getContent({ owner, repo, path, ref });
      const data = res.data as { sha?: string };
      return data.sha ?? null;
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
  }

  function toBase64(content: string): string {
    return Buffer.from(content, 'utf8').toString('base64');
  }

  export async function createSubmissionPR(
    octokit: Octokit | null,
    args: CreateArgs,
  ): Promise<SyncResult> {
    if (!octokit) return NO_OP;
    const { owner, repo, submissionId, slug, markdown, title, body } = args;
    const branch = `submission/${submissionId}`;

    const main = await octokit.rest.git.getRef({ owner, repo, ref: 'heads/main' });
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: main.data.object.sha,
    });

    const path = `content/articles/${slug}.md`;
    const existingSha = await getFileSha(octokit, owner, repo, path, branch);

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      branch,
      message: `submission(${submissionId}): initial proposal`,
      content: toBase64(markdown),
      ...(existingSha ? { sha: existingSha } : {}),
    });

    const pr = await octokit.rest.pulls.create({
      owner,
      repo,
      head: branch,
      base: 'main',
      title,
      body,
    });

    return { prNumber: pr.data.number, prBranch: branch, prState: 'open' };
  }

  export async function pushSubmissionEdit(
    octokit: Octokit | null,
    args: PushArgs,
  ): Promise<SyncResult> {
    if (!octokit) return NO_OP;
    const { owner, repo, branch, path, oldPath, markdown, message } = args;

    if (oldPath && oldPath !== path) {
      const oldSha = await getFileSha(octokit, owner, repo, oldPath, branch);
      if (oldSha) {
        await octokit.rest.repos.deleteFile({
          owner,
          repo,
          path: oldPath,
          branch,
          message: `${message} (move from ${oldPath})`,
          sha: oldSha,
        });
      }
    }

    const sha = await getFileSha(octokit, owner, repo, path, branch);
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      branch,
      message,
      content: toBase64(markdown),
      ...(sha ? { sha } : {}),
    });

    return { prNumber: null, prBranch: branch, prState: 'open' };
  }

  export async function mergeSubmissionPR(
    octokit: Octokit | null,
    args: MergeArgs,
  ): Promise<SyncResult> {
    if (!octokit) return NO_OP;
    const { owner, repo, prNumber, branch } = args;
    await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
      merge_method: 'squash',
      commit_title: `submission(${prNumber}): accepted, merging to main`,
    });
    await octokit.rest.git
      .deleteRef({ owner, repo, ref: `heads/${branch}` })
      .catch(() => undefined);
    return { prNumber, prBranch: branch, prState: 'merged' };
  }

  export async function closeSubmissionPR(
    octokit: Octokit | null,
    args: CloseArgs,
  ): Promise<SyncResult> {
    if (!octokit) return NO_OP;
    const { owner, repo, prNumber, branch } = args;
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      state: 'closed',
    });
    await octokit.rest.git
      .deleteRef({ owner, repo, ref: `heads/${branch}` })
      .catch(() => undefined);
    return { prNumber, prBranch: branch, prState: 'closed' };
  }
  ```

- [ ] **Step 4:** Tests laufen, erwarten PASS.
  ```bash
  pnpm test tests/unit/github-pr.test.ts
  ```
  Expected: alle Tests grün.

- [ ] **Step 5:** Commit.
  ```bash
  git add src/lib/github-pr.ts tests/unit/github-pr.test.ts
  git commit -m "feat(v1.5): octokit github-pr wrapper (create/push/merge/close)"
  ```

---

## Task 9: github-article-sync.ts (Direkt-Commit-Helper)

**Files:**
- Create: `src/lib/github-article-sync.ts`
- Create: `tests/unit/github-article-sync.test.ts`

- [ ] **Step 1:** Test-Datei schreiben.
  ```typescript
  // tests/unit/github-article-sync.test.ts
  import { describe, expect, it, vi } from 'vitest';
  import {
    upsertArticleMarkdown,
    deleteArticleMarkdown,
  } from '@/lib/github-article-sync';

  function mockOctokit() {
    return {
      rest: {
        repos: {
          getContent: vi.fn(),
          createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
          deleteFile: vi.fn().mockResolvedValue({}),
        },
      },
    } as never;
  }

  const ref = { owner: 'shogun160', repo: 'pflege-atlas' };

  describe('upsertArticleMarkdown', () => {
    it('no-ops when octokit is null', async () => {
      const result = await upsertArticleMarkdown(null, { ...ref, slug: 'x', markdown: 'hi' });
      expect(result.committed).toBe(false);
    });

    it('creates new file when path missing', async () => {
      const oct = mockOctokit();
      oct.rest.repos.getContent.mockRejectedValueOnce({ status: 404 });
      const result = await upsertArticleMarkdown(oct, {
        ...ref,
        slug: 'demo',
        markdown: 'hello',
      });
      expect(oct.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'content/articles/demo.md', branch: 'main' }),
      );
      expect(result.committed).toBe(true);
    });

    it('skips commit when content hash unchanged', async () => {
      const oct = mockOctokit();
      const existingB64 = Buffer.from('same', 'utf8').toString('base64');
      oct.rest.repos.getContent.mockResolvedValueOnce({
        data: { sha: 'sha-1', content: existingB64, encoding: 'base64' },
      });
      const result = await upsertArticleMarkdown(oct, {
        ...ref,
        slug: 'demo',
        markdown: 'same',
      });
      expect(oct.rest.repos.createOrUpdateFileContents).not.toHaveBeenCalled();
      expect(result.committed).toBe(false);
    });

    it('updates with existing sha when content changed', async () => {
      const oct = mockOctokit();
      const existingB64 = Buffer.from('old', 'utf8').toString('base64');
      oct.rest.repos.getContent.mockResolvedValueOnce({
        data: { sha: 'sha-1', content: existingB64, encoding: 'base64' },
      });
      await upsertArticleMarkdown(oct, { ...ref, slug: 'demo', markdown: 'new' });
      expect(oct.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({ sha: 'sha-1' }),
      );
    });
  });

  describe('deleteArticleMarkdown', () => {
    it('no-ops when file does not exist', async () => {
      const oct = mockOctokit();
      oct.rest.repos.getContent.mockRejectedValueOnce({ status: 404 });
      const result = await deleteArticleMarkdown(oct, { ...ref, slug: 'gone' });
      expect(oct.rest.repos.deleteFile).not.toHaveBeenCalled();
      expect(result.committed).toBe(false);
    });

    it('deletes existing file', async () => {
      const oct = mockOctokit();
      oct.rest.repos.getContent.mockResolvedValueOnce({ data: { sha: 'sha-x' } });
      const result = await deleteArticleMarkdown(oct, { ...ref, slug: 'gone' });
      expect(oct.rest.repos.deleteFile).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'content/articles/gone.md', sha: 'sha-x' }),
      );
      expect(result.committed).toBe(true);
    });
  });
  ```

- [ ] **Step 2:** Tests laufen, erwarten FAIL.
  ```bash
  pnpm test tests/unit/github-article-sync.test.ts
  ```

- [ ] **Step 3:** Implementation schreiben.
  ```typescript
  // src/lib/github-article-sync.ts
  import 'server-only';
  import type { Octokit } from '@octokit/rest';

  type RepoRef = { owner: string; repo: string };
  type UpsertArgs = RepoRef & { slug: string; markdown: string };
  type DeleteArgs = RepoRef & { slug: string };

  export type ArticleSyncResult = { committed: boolean };

  function pathFor(slug: string): string {
    return `content/articles/${slug}.md`;
  }

  function toBase64(content: string): string {
    return Buffer.from(content, 'utf8').toString('base64');
  }

  function fromBase64(content: string): string {
    return Buffer.from(content, 'base64').toString('utf8');
  }

  type ExistingFile = { sha: string; content: string } | null;

  async function fetchExisting(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string,
  ): Promise<ExistingFile> {
    try {
      const res = await octokit.rest.repos.getContent({ owner, repo, path, ref: 'main' });
      const data = res.data as { sha?: string; content?: string; encoding?: string };
      if (!data.sha || !data.content) return null;
      const decoded = data.encoding === 'base64' ? fromBase64(data.content) : data.content;
      return { sha: data.sha, content: decoded };
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
  }

  export async function upsertArticleMarkdown(
    octokit: Octokit | null,
    args: UpsertArgs,
  ): Promise<ArticleSyncResult> {
    if (!octokit) return { committed: false };
    const { owner, repo, slug, markdown } = args;
    const path = pathFor(slug);
    const existing = await fetchExisting(octokit, owner, repo, path);
    if (existing && existing.content === markdown) {
      return { committed: false };
    }
    const message = existing
      ? `article(${slug}): update from admin`
      : `article(${slug}): publish`;
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      branch: 'main',
      message,
      content: toBase64(markdown),
      ...(existing ? { sha: existing.sha } : {}),
    });
    return { committed: true };
  }

  export async function deleteArticleMarkdown(
    octokit: Octokit | null,
    args: DeleteArgs,
  ): Promise<ArticleSyncResult> {
    if (!octokit) return { committed: false };
    const { owner, repo, slug } = args;
    const path = pathFor(slug);
    const existing = await fetchExisting(octokit, owner, repo, path);
    if (!existing) return { committed: false };
    await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path,
      branch: 'main',
      message: `article(${slug}): archive`,
      sha: existing.sha,
    });
    return { committed: true };
  }
  ```

- [ ] **Step 4:** Tests laufen, erwarten PASS.
  ```bash
  pnpm test tests/unit/github-article-sync.test.ts
  ```

- [ ] **Step 5:** Commit.
  ```bash
  git add src/lib/github-article-sync.ts tests/unit/github-article-sync.test.ts
  git commit -m "feat(v1.5): direct main-commit helper for article markdown sync"
  ```

---

## Task 10: Submission→Article-Mapper

**Files:**
- Create: `src/lib/submission-to-article.ts`
- Create: `tests/unit/submission-to-article.test.ts`

- [ ] **Step 1:** Test-Datei schreiben.
  ```typescript
  // tests/unit/submission-to-article.test.ts
  import { describe, expect, it } from 'vitest';
  import { applySubmissionToArticle } from '@/lib/submission-to-article';

  const LEX = (text: string) => ({
    root: {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', text }] }],
    },
  });

  describe('applySubmissionToArticle (new_article)', () => {
    it('maps proposed fields to a fresh article patch', () => {
      const sub = {
        type: 'new_article',
        proposedTitle: 'Mein Titel',
        proposedIntent: 'bedside',
        proposedSummary: 'Kurz',
        proposedSlug: 'mein-titel',
        proposedDefinition: LEX('def'),
        proposedPraxis: LEX('prx'),
        proposedRisiken: LEX('rsk'),
        proposedQuellen: LEX('qul'),
      };
      const result = applySubmissionToArticle(sub, null);
      expect(result.mode).toBe('create');
      expect(result.slug).toBe('mein-titel');
      expect(result.patch.title).toBe('Mein Titel');
      expect(result.patch.intent).toBe('bedside');
      expect(result.patch.summary).toBe('Kurz');
      expect(result.patch.definition).toEqual(LEX('def'));
      expect(result.patch.status).toBe('published');
    });

    it('falls back to "background" intent when not proposed', () => {
      const sub = {
        type: 'new_article',
        proposedTitle: 'X',
        proposedSummary: '',
        proposedSlug: 'x',
        proposedDefinition: LEX('a'),
        proposedPraxis: LEX('a'),
        proposedRisiken: LEX('a'),
        proposedQuellen: LEX('a'),
      };
      const result = applySubmissionToArticle(sub, null);
      expect(result.patch.intent).toBe('background');
    });
  });

  describe('applySubmissionToArticle (correction)', () => {
    const article = {
      id: 5,
      slug: 'demo',
      title: 'Demo',
      intent: 'background',
      summary: 's',
      definition: LEX('old-def'),
      praxis: LEX('old-prx'),
      risiken: LEX('old-rsk'),
      quellen: LEX('old-qul'),
    };

    it('only replaces sections that have edited content', () => {
      const sub = {
        type: 'correction',
        editedPraxis: LEX('new-prx'),
      };
      const result = applySubmissionToArticle(sub, article);
      expect(result.mode).toBe('update');
      expect(result.patch.definition).toBeUndefined();
      expect(result.patch.praxis).toEqual(LEX('new-prx'));
      expect(result.patch.risiken).toBeUndefined();
      expect(result.patch.quellen).toBeUndefined();
    });

    it('returns slug from existing article (no override)', () => {
      const sub = { type: 'correction', editedDefinition: LEX('x') };
      const result = applySubmissionToArticle(sub, article);
      expect(result.slug).toBe('demo');
    });
  });
  ```

- [ ] **Step 2:** Tests laufen, erwarten FAIL.
  ```bash
  pnpm test tests/unit/submission-to-article.test.ts
  ```

- [ ] **Step 3:** Implementation schreiben.
  ```typescript
  // src/lib/submission-to-article.ts
  type Lexical = unknown;

  type NewArticleSub = {
    type: 'new_article';
    proposedTitle: string;
    proposedIntent?: 'bedside' | 'background' | 'learning';
    proposedSummary?: string;
    proposedSlug: string;
    proposedDefinition: Lexical;
    proposedPraxis: Lexical;
    proposedRisiken: Lexical;
    proposedQuellen: Lexical;
  };

  type CorrectionSub = {
    type: 'correction';
    editedDefinition?: Lexical;
    editedPraxis?: Lexical;
    editedRisiken?: Lexical;
    editedQuellen?: Lexical;
  };

  type ArticleInput = {
    id: number;
    slug: string;
    title: string;
    intent: string;
    summary: string;
    definition: Lexical;
    praxis: Lexical;
    risiken: Lexical;
    quellen: Lexical;
  };

  export type ApplyResult = {
    mode: 'create' | 'update';
    slug: string;
    patch: Record<string, unknown>;
  };

  function isEmpty(value: Lexical): boolean {
    if (!value) return true;
    if (typeof value === 'string') return value.trim() === '';
    return false;
  }

  export function applySubmissionToArticle(
    sub: NewArticleSub | CorrectionSub,
    article: ArticleInput | null,
  ): ApplyResult {
    if (sub.type === 'new_article') {
      return {
        mode: 'create',
        slug: sub.proposedSlug,
        patch: {
          title: sub.proposedTitle,
          slug: sub.proposedSlug,
          intent: sub.proposedIntent ?? 'background',
          summary: sub.proposedSummary ?? '',
          definition: sub.proposedDefinition,
          praxis: sub.proposedPraxis,
          risiken: sub.proposedRisiken,
          quellen: sub.proposedQuellen,
          status: 'published',
        },
      };
    }

    if (!article) {
      throw new Error('Correction submission requires an existing article');
    }

    const patch: Record<string, unknown> = {};
    if (!isEmpty(sub.editedDefinition)) patch.definition = sub.editedDefinition;
    if (!isEmpty(sub.editedPraxis)) patch.praxis = sub.editedPraxis;
    if (!isEmpty(sub.editedRisiken)) patch.risiken = sub.editedRisiken;
    if (!isEmpty(sub.editedQuellen)) patch.quellen = sub.editedQuellen;

    return { mode: 'update', slug: article.slug, patch };
  }
  ```

- [ ] **Step 4:** Tests laufen, erwarten PASS.
  ```bash
  pnpm test tests/unit/submission-to-article.test.ts
  ```

- [ ] **Step 5:** Commit.
  ```bash
  git add src/lib/submission-to-article.ts tests/unit/submission-to-article.test.ts
  git commit -m "feat(v1.5): submission-to-article mapper"
  ```

---

## Task 11: Inline-Section-Diff-Helper

**Files:**
- Create: `src/lib/submission-section-diff.ts`
- Create: `tests/unit/submission-section-diff.test.ts`

- [ ] **Step 1:** Test-Datei schreiben.
  ```typescript
  // tests/unit/submission-section-diff.test.ts
  import { describe, expect, it } from 'vitest';
  import { diffSection } from '@/lib/submission-section-diff';

  describe('diffSection', () => {
    it('returns empty changeset for identical content', () => {
      const result = diffSection('Hallo Welt\nZeile zwei', 'Hallo Welt\nZeile zwei');
      expect(result.changed).toBe(false);
      expect(result.parts.every((p) => p.kind === 'equal')).toBe(true);
    });

    it('marks added lines as additions', () => {
      const result = diffSection('a\nb', 'a\nb\nc');
      expect(result.changed).toBe(true);
      const added = result.parts.filter((p) => p.kind === 'add');
      expect(added.length).toBeGreaterThan(0);
      expect(added.some((p) => p.text.includes('c'))).toBe(true);
    });

    it('marks removed lines as removals', () => {
      const result = diffSection('a\nb\nc', 'a\nc');
      expect(result.changed).toBe(true);
      const removed = result.parts.filter((p) => p.kind === 'remove');
      expect(removed.length).toBeGreaterThan(0);
      expect(removed.some((p) => p.text.includes('b'))).toBe(true);
    });

    it('handles empty original (pure addition)', () => {
      const result = diffSection('', 'neuer Text');
      expect(result.changed).toBe(true);
      expect(result.parts[0].kind).toBe('add');
    });
  });
  ```

- [ ] **Step 2:** Tests laufen, erwarten FAIL.
  ```bash
  pnpm test tests/unit/submission-section-diff.test.ts
  ```

- [ ] **Step 3:** Implementation schreiben.
  ```typescript
  // src/lib/submission-section-diff.ts
  import { diffLines } from 'diff';

  export type DiffPart = { kind: 'equal' | 'add' | 'remove'; text: string };
  export type DiffResult = { changed: boolean; parts: DiffPart[] };

  export function diffSection(original: string, edited: string): DiffResult {
    const parts = diffLines(original, edited).map<DiffPart>((change) => {
      if (change.added) return { kind: 'add', text: change.value };
      if (change.removed) return { kind: 'remove', text: change.value };
      return { kind: 'equal', text: change.value };
    });
    const changed = parts.some((p) => p.kind !== 'equal');
    return { changed, parts };
  }
  ```

- [ ] **Step 4:** Tests laufen, erwarten PASS.
  ```bash
  pnpm test tests/unit/submission-section-diff.test.ts
  ```

- [ ] **Step 5:** Commit.
  ```bash
  git add src/lib/submission-section-diff.ts tests/unit/submission-section-diff.test.ts
  git commit -m "feat(v1.5): plain-text diff helper for inline section preview"
  ```

---

## Task 12: Server-Actions (in-review / accept / reject)

**Files:**
- Create: `src/app/(payload)/admin/submission-actions.ts`
- Create: `tests/integration/submission-action-in-review.test.ts`
- Create: `tests/integration/submission-action-accept.test.ts`
- Create: `tests/integration/submission-action-reject.test.ts`

Größter Task im Plan. Drei Server-Actions, jeweils atomar via Payload-Transaction.

- [ ] **Step 1:** Test für `inReviewAction` schreiben (Happy + Rollback).
  ```typescript
  // tests/integration/submission-action-in-review.test.ts
  import { describe, expect, it, vi, beforeEach } from 'vitest';

  const mocks = vi.hoisted(() => ({
    getOctokit: vi.fn(),
    createSubmissionPR: vi.fn(),
    getPayloadClient: vi.fn(),
    resolveUniqueSlug: vi.fn(),
  }));

  vi.mock('@/lib/github-app', () => ({ getOctokit: mocks.getOctokit }));
  vi.mock('@/lib/github-pr', () => ({
    createSubmissionPR: mocks.createSubmissionPR,
    pushSubmissionEdit: vi.fn(),
    mergeSubmissionPR: vi.fn(),
    closeSubmissionPR: vi.fn(),
  }));
  vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }));
  vi.mock('@/lib/slug-resolver', () => ({ resolveUniqueSlug: mocks.resolveUniqueSlug }));

  function makePayload() {
    const findByID = vi.fn();
    const update = vi.fn();
    const find = vi.fn().mockResolvedValue({ docs: [] });
    return {
      findByID,
      update,
      find,
      db: {
        beginTransaction: vi.fn().mockResolvedValue('txn-1'),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      },
    };
  }

  describe('inReviewAction', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates PR and updates submission atomically', async () => {
      const payload = makePayload();
      payload.findByID.mockResolvedValue({
        id: 7,
        type: 'new_article',
        proposedTitle: 'Demo',
        proposedSlug: null,
        proposedIntent: 'bedside',
        proposedDefinition: { root: { type: 'root', children: [] } },
        proposedPraxis: { root: { type: 'root', children: [] } },
        proposedRisiken: { root: { type: 'root', children: [] } },
        proposedQuellen: { root: { type: 'root', children: [] } },
      });
      mocks.getPayloadClient.mockResolvedValue(payload);
      mocks.getOctokit.mockReturnValue({} as never);
      mocks.resolveUniqueSlug.mockResolvedValue('demo');
      mocks.createSubmissionPR.mockResolvedValue({
        prNumber: 42,
        prBranch: 'submission/7',
        prState: 'open',
      });

      const { inReviewAction } = await import('@/app/(payload)/admin/submission-actions');
      const result = await inReviewAction(7);

      expect(result.ok).toBe(true);
      expect(mocks.createSubmissionPR).toHaveBeenCalled();
      expect(payload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'submissions',
          id: 7,
          data: expect.objectContaining({
            reviewStatus: 'in_review',
            prNumber: 42,
            prBranch: 'submission/7',
            prState: 'open',
            proposedSlug: 'demo',
          }),
        }),
      );
      expect(payload.db.commitTransaction).toHaveBeenCalled();
      expect(payload.db.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('rolls back DB transaction when octokit throws', async () => {
      const payload = makePayload();
      payload.findByID.mockResolvedValue({
        id: 7,
        type: 'new_article',
        proposedTitle: 'Demo',
        proposedSlug: null,
        proposedDefinition: { root: { type: 'root', children: [] } },
        proposedPraxis: { root: { type: 'root', children: [] } },
        proposedRisiken: { root: { type: 'root', children: [] } },
        proposedQuellen: { root: { type: 'root', children: [] } },
      });
      mocks.getPayloadClient.mockResolvedValue(payload);
      mocks.getOctokit.mockReturnValue({} as never);
      mocks.resolveUniqueSlug.mockResolvedValue('demo');
      mocks.createSubmissionPR.mockRejectedValue(new Error('GitHub API down'));

      const { inReviewAction } = await import('@/app/(payload)/admin/submission-actions');
      const result = await inReviewAction(7);

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/GitHub API down/);
      expect(payload.db.rollbackTransaction).toHaveBeenCalled();
      expect(payload.db.commitTransaction).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2:** Test für `acceptAction` schreiben.
  ```typescript
  // tests/integration/submission-action-accept.test.ts
  import { describe, expect, it, vi, beforeEach } from 'vitest';

  const mocks = vi.hoisted(() => ({
    getOctokit: vi.fn(),
    mergeSubmissionPR: vi.fn(),
    getPayloadClient: vi.fn(),
  }));

  vi.mock('@/lib/github-app', () => ({ getOctokit: mocks.getOctokit }));
  vi.mock('@/lib/github-pr', () => ({
    createSubmissionPR: vi.fn(),
    pushSubmissionEdit: vi.fn(),
    mergeSubmissionPR: mocks.mergeSubmissionPR,
    closeSubmissionPR: vi.fn(),
  }));
  vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }));

  function makePayload() {
    return {
      findByID: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 100 }),
      update: vi.fn().mockResolvedValue({}),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      sendEmail: vi.fn().mockResolvedValue({}),
      db: {
        beginTransaction: vi.fn().mockResolvedValue('txn'),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      },
    };
  }

  describe('acceptAction', () => {
    beforeEach(() => vi.clearAllMocks());

    it('creates article and merges PR for new_article submission', async () => {
      const payload = makePayload();
      payload.findByID.mockResolvedValue({
        id: 7,
        type: 'new_article',
        proposedTitle: 'Demo',
        proposedIntent: 'bedside',
        proposedSummary: 'sum',
        proposedSlug: 'demo',
        proposedDefinition: { root: { type: 'root', children: [] } },
        proposedPraxis: { root: { type: 'root', children: [] } },
        proposedRisiken: { root: { type: 'root', children: [] } },
        proposedQuellen: { root: { type: 'root', children: [] } },
        prNumber: 42,
        prBranch: 'submission/7',
        submitterEmail: 'maria@example.org',
      });
      mocks.getPayloadClient.mockResolvedValue(payload);
      mocks.getOctokit.mockReturnValue({} as never);
      mocks.mergeSubmissionPR.mockResolvedValue({
        prNumber: 42,
        prBranch: 'submission/7',
        prState: 'merged',
      });

      const { acceptAction } = await import('@/app/(payload)/admin/submission-actions');
      const result = await acceptAction(7);

      expect(result.ok).toBe(true);
      expect(payload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'articles',
          context: expect.objectContaining({ skipMarkdownSync: true }),
        }),
      );
      expect(mocks.mergeSubmissionPR).toHaveBeenCalled();
      expect(payload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 7,
          data: expect.objectContaining({ reviewStatus: 'accepted', prState: 'merged' }),
        }),
      );
      expect(payload.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'maria@example.org' }),
      );
    });

    it('updates existing article for correction (no email when no submitter email)', async () => {
      const payload = makePayload();
      payload.findByID
        .mockResolvedValueOnce({
          id: 7,
          type: 'correction',
          relatedArticle: 5,
          editedPraxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'new' }] }] } },
          prNumber: 42,
          prBranch: 'submission/7',
        })
        .mockResolvedValueOnce({
          id: 5,
          slug: 'demo',
          title: 'Demo',
          intent: 'background',
          summary: 's',
          definition: { root: { type: 'root', children: [] } },
          praxis: { root: { type: 'root', children: [] } },
          risiken: { root: { type: 'root', children: [] } },
          quellen: { root: { type: 'root', children: [] } },
        });
      mocks.getPayloadClient.mockResolvedValue(payload);
      mocks.getOctokit.mockReturnValue({} as never);
      mocks.mergeSubmissionPR.mockResolvedValue({
        prNumber: 42,
        prBranch: 'submission/7',
        prState: 'merged',
      });

      const { acceptAction } = await import('@/app/(payload)/admin/submission-actions');
      await acceptAction(7);

      expect(payload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'articles',
          id: 5,
          context: expect.objectContaining({ skipMarkdownSync: true }),
        }),
      );
      expect(payload.sendEmail).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 3:** Test für `rejectAction` schreiben.
  ```typescript
  // tests/integration/submission-action-reject.test.ts
  import { describe, expect, it, vi, beforeEach } from 'vitest';

  const mocks = vi.hoisted(() => ({
    getOctokit: vi.fn(),
    closeSubmissionPR: vi.fn(),
    getPayloadClient: vi.fn(),
  }));

  vi.mock('@/lib/github-app', () => ({ getOctokit: mocks.getOctokit }));
  vi.mock('@/lib/github-pr', () => ({
    createSubmissionPR: vi.fn(),
    pushSubmissionEdit: vi.fn(),
    mergeSubmissionPR: vi.fn(),
    closeSubmissionPR: mocks.closeSubmissionPR,
  }));
  vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }));

  function makePayload() {
    return {
      findByID: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      db: {
        beginTransaction: vi.fn().mockResolvedValue('txn'),
        commitTransaction: vi.fn().mockResolvedValue(undefined),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      },
    };
  }

  describe('rejectAction', () => {
    beforeEach(() => vi.clearAllMocks());

    it('closes PR and updates status when PR exists', async () => {
      const payload = makePayload();
      payload.findByID.mockResolvedValue({
        id: 7,
        prNumber: 42,
        prBranch: 'submission/7',
      });
      mocks.getPayloadClient.mockResolvedValue(payload);
      mocks.getOctokit.mockReturnValue({} as never);
      mocks.closeSubmissionPR.mockResolvedValue({
        prNumber: 42,
        prBranch: 'submission/7',
        prState: 'closed',
      });

      const { rejectAction } = await import('@/app/(payload)/admin/submission-actions');
      const result = await rejectAction(7);

      expect(result.ok).toBe(true);
      expect(mocks.closeSubmissionPR).toHaveBeenCalled();
      expect(payload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reviewStatus: 'rejected', prState: 'closed' }),
        }),
      );
    });

    it('skips PR close when no PR exists, just updates status', async () => {
      const payload = makePayload();
      payload.findByID.mockResolvedValue({ id: 7 });
      mocks.getPayloadClient.mockResolvedValue(payload);

      const { rejectAction } = await import('@/app/(payload)/admin/submission-actions');
      await rejectAction(7);

      expect(mocks.closeSubmissionPR).not.toHaveBeenCalled();
      expect(payload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reviewStatus: 'rejected' }),
        }),
      );
    });
  });
  ```

- [ ] **Step 4:** Tests laufen, erwarten FAIL.
  ```bash
  pnpm test tests/integration/submission-action-
  ```

- [ ] **Step 5:** Implementation schreiben.
  ```typescript
  // src/app/(payload)/admin/submission-actions.ts
  'use server';

  import 'server-only';
  import { getPayloadClient } from '@/lib/payload';
  import { getOctokit } from '@/lib/github-app';
  import { getGithubConfig } from '@/lib/env';
  import { slugify } from '@/lib/slugify';
  import { resolveUniqueSlug } from '@/lib/slug-resolver';
  import { renderArticleMarkdown } from '@/lib/article-markdown';
  import { applySubmissionToArticle } from '@/lib/submission-to-article';
  import {
    createSubmissionPR,
    pushSubmissionEdit,
    mergeSubmissionPR,
    closeSubmissionPR,
  } from '@/lib/github-pr';

  export type ActionResult = { ok: true } | { ok: false; error: string };

  function repoCfg() {
    const cfg = getGithubConfig();
    return {
      owner: cfg?.owner ?? 'shogun160',
      repo: cfg?.repo ?? 'pflege-atlas',
    };
  }

  function buildPRBody(args: {
    submissionId: number;
    type: 'new_article' | 'correction';
    sections?: string[];
    proposedSlug?: string;
    correctionReason?: string;
  }): string {
    const typeLabel = args.type === 'new_article' ? 'Neuer Artikelvorschlag' : 'Korrektur';
    const lines: string[] = [];
    lines.push(`**Typ:** ${typeLabel}`);
    if (args.type === 'correction' && args.sections?.length) {
      lines.push(`**Betroffene Sektionen:** ${args.sections.join(', ')}`);
    }
    if (args.type === 'new_article' && args.proposedSlug) {
      lines.push(`**Slug-Vorschlag:** \`${args.proposedSlug}\``);
    }
    lines.push(
      `**Admin-Link:** https://pflegeatlas.org/admin/collections/submissions/${args.submissionId}`,
    );
    if (args.correctionReason) {
      lines.push('', '**Begründung der/des Einreichenden:**');
      lines.push(...args.correctionReason.split('\n').map((l) => `> ${l}`));
    }
    lines.push('', '---', '');
    lines.push(
      '*Submitter-Daten (Name/E-Mail) bleiben in der Datenbank und werden nicht hier veröffentlicht.*',
    );
    return lines.join('\n');
  }

  export async function inReviewAction(submissionId: number): Promise<ActionResult> {
    const payload = await getPayloadClient();
    const sub = await payload.findByID({ collection: 'submissions', id: submissionId, depth: 0 });
    if (!sub) return { ok: false, error: 'Submission not found' };

    const txn = await payload.db.beginTransaction();
    try {
      let slug = (sub as { proposedSlug?: string }).proposedSlug ?? '';
      let articleSnapshot: Record<string, unknown> | null = null;
      const sections: string[] = [];

      if (sub.type === 'new_article') {
        if (!slug) {
          const base = slugify((sub as { proposedTitle?: string }).proposedTitle ?? '');
          slug = await resolveUniqueSlug(base, async (candidate) => {
            const res = await payload.find({
              collection: 'articles',
              where: { slug: { equals: candidate } },
              limit: 1,
            });
            return res.docs.length > 0;
          });
        }
        articleSnapshot = applySubmissionToArticle(sub as never, null).patch;
      } else {
        const related = (sub as { relatedArticle?: number }).relatedArticle;
        if (!related) return { ok: false, error: 'Correction submission missing relatedArticle' };
        const article = await payload.findByID({ collection: 'articles', id: related, depth: 0 });
        const apply = applySubmissionToArticle(sub as never, article as never);
        slug = apply.slug;
        articleSnapshot = { ...article, ...apply.patch };
        ['definition', 'praxis', 'risiken', 'quellen'].forEach((s) => {
          if (apply.patch[s] !== undefined) sections.push(s);
        });
      }

      const markdown = renderArticleMarkdown(
        { id: 0, slug, ...articleSnapshot, status: 'published' } as never,
        [],
      );
      const title =
        sub.type === 'new_article'
          ? `[Vorschlag] ${(sub as { proposedTitle?: string }).proposedTitle ?? slug}`
          : `[Korrektur] ${(articleSnapshot as { title?: string }).title ?? slug}`;
      const body = buildPRBody({
        submissionId,
        type: sub.type as 'new_article' | 'correction',
        sections,
        proposedSlug: sub.type === 'new_article' ? slug : undefined,
        correctionReason: (sub as { correctionReason?: string }).correctionReason,
      });

      const octokit = getOctokit();
      const { owner, repo } = repoCfg();
      const prResult = await createSubmissionPR(octokit, {
        owner,
        repo,
        submissionId,
        slug,
        markdown,
        title,
        body,
      });

      await payload.update({
        collection: 'submissions',
        id: submissionId,
        req: { transactionID: txn } as never,
        data: {
          reviewStatus: 'in_review',
          prNumber: prResult.prNumber,
          prBranch: prResult.prBranch,
          prState: prResult.prState === 'skipped' ? null : prResult.prState,
          proposedSlug: sub.type === 'new_article' ? slug : undefined,
        },
      });

      await payload.db.commitTransaction(txn);
      return { ok: true };
    } catch (err) {
      await payload.db.rollbackTransaction(txn);
      return { ok: false, error: (err as Error).message };
    }
  }

  export async function acceptAction(submissionId: number): Promise<ActionResult> {
    const payload = await getPayloadClient();
    const sub = await payload.findByID({ collection: 'submissions', id: submissionId, depth: 0 });
    if (!sub) return { ok: false, error: 'Submission not found' };

    const txn = await payload.db.beginTransaction();
    try {
      let articleId: number;
      if (sub.type === 'new_article') {
        const apply = applySubmissionToArticle(sub as never, null);
        const created = await payload.create({
          collection: 'articles',
          req: { transactionID: txn } as never,
          context: { skipMarkdownSync: true },
          data: {
            ...apply.patch,
            authors: [],
            lastReviewedAt: new Date().toISOString(),
          } as never,
        });
        articleId = (created as { id: number }).id;
      } else {
        const related = (sub as { relatedArticle?: number }).relatedArticle;
        if (!related) return { ok: false, error: 'Correction missing relatedArticle' };
        const article = await payload.findByID({ collection: 'articles', id: related, depth: 0 });
        const apply = applySubmissionToArticle(sub as never, article as never);
        await payload.update({
          collection: 'articles',
          id: related,
          req: { transactionID: txn } as never,
          context: { skipMarkdownSync: true },
          data: { ...apply.patch, lastReviewedAt: new Date().toISOString() } as never,
        });
        articleId = related;
      }

      const octokit = getOctokit();
      const { owner, repo } = repoCfg();
      const prNumber = (sub as { prNumber?: number | null }).prNumber;
      const prBranch = (sub as { prBranch?: string | null }).prBranch;
      if (prNumber && prBranch) {
        await mergeSubmissionPR(octokit, { owner, repo, prNumber, branch: prBranch });
      }

      await payload.update({
        collection: 'submissions',
        id: submissionId,
        req: { transactionID: txn } as never,
        data: { reviewStatus: 'accepted', prState: 'merged' },
      });

      await payload.db.commitTransaction(txn);

      const email = (sub as { submitterEmail?: string }).submitterEmail;
      if (email) {
        await payload.sendEmail({
          to: email,
          subject: 'Dein Beitrag zu PflegeAtlas wurde übernommen',
          text:
            `Hallo,\n\n` +
            `dein Vorschlag wurde von der Redaktion geprüft und übernommen. ` +
            `Vielen Dank für deinen Beitrag!\n\n` +
            `Du findest den Artikel jetzt online auf pflegeatlas.org.\n\n` +
            `Liebe Grüße,\ndas PflegeAtlas-Team`,
        });
      }
      void articleId;
      return { ok: true };
    } catch (err) {
      await payload.db.rollbackTransaction(txn);
      return { ok: false, error: (err as Error).message };
    }
  }

  export async function rejectAction(submissionId: number): Promise<ActionResult> {
    const payload = await getPayloadClient();
    const sub = await payload.findByID({ collection: 'submissions', id: submissionId, depth: 0 });
    if (!sub) return { ok: false, error: 'Submission not found' };

    const txn = await payload.db.beginTransaction();
    try {
      const prNumber = (sub as { prNumber?: number | null }).prNumber;
      const prBranch = (sub as { prBranch?: string | null }).prBranch;
      if (prNumber && prBranch) {
        const octokit = getOctokit();
        const { owner, repo } = repoCfg();
        await closeSubmissionPR(octokit, { owner, repo, prNumber, branch: prBranch });
      }

      await payload.update({
        collection: 'submissions',
        id: submissionId,
        req: { transactionID: txn } as never,
        data: { reviewStatus: 'rejected', prState: prNumber ? 'closed' : null },
      });

      await payload.db.commitTransaction(txn);
      return { ok: true };
    } catch (err) {
      await payload.db.rollbackTransaction(txn);
      return { ok: false, error: (err as Error).message };
    }
  }
  ```

- [ ] **Step 6:** Tests laufen, erwarten PASS.
  ```bash
  pnpm test tests/integration/submission-action-
  ```

- [ ] **Step 7:** Commit.
  ```bash
  git add src/app/\(payload\)/admin/submission-actions.ts tests/integration/submission-action-*.test.ts
  git commit -m "feat(v1.5): atomic server-actions for in-review/accept/reject"
  ```

---


## Task 13: Hooks für PR-Re-Push und Article-Direkt-Sync

**Files:**
- Modify: `src/collections/Submissions.ts` (afterChange-Hook für PR-Re-Push)
- Modify: `src/collections/Articles.ts` (afterChange-Hook für Markdown-Sync)
- Create: `tests/integration/submission-edit-repush.test.ts`
- Create: `tests/integration/article-sync-hook.test.ts`

- [ ] **Step 1:** Test für Submission-Edit-Re-Push schreiben.
  ```typescript
  // tests/integration/submission-edit-repush.test.ts
  import { describe, expect, it, vi, beforeEach } from 'vitest';

  const mocks = vi.hoisted(() => ({
    getOctokit: vi.fn(),
    pushSubmissionEdit: vi.fn(),
  }));

  vi.mock('@/lib/github-app', () => ({ getOctokit: mocks.getOctokit }));
  vi.mock('@/lib/github-pr', () => ({
    createSubmissionPR: vi.fn(),
    pushSubmissionEdit: mocks.pushSubmissionEdit,
    mergeSubmissionPR: vi.fn(),
    closeSubmissionPR: vi.fn(),
  }));

  describe('Submissions.afterChange (PR re-push)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('re-pushes edit when reviewStatus=in_review and prBranch exists', async () => {
      mocks.getOctokit.mockReturnValue({} as never);
      mocks.pushSubmissionEdit.mockResolvedValue({
        prNumber: 42,
        prBranch: 'submission/7',
        prState: 'open',
      });

      const { afterSubmissionChangeHook } = await import('@/collections/Submissions');
      await afterSubmissionChangeHook({
        operation: 'update',
        doc: {
          id: 7,
          type: 'correction',
          relatedArticle: 5,
          reviewStatus: 'in_review',
          prNumber: 42,
          prBranch: 'submission/7',
          proposedSlug: null,
          editedPraxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'updated' }] }] } },
        },
        previousDoc: {
          id: 7,
          type: 'correction',
          relatedArticle: 5,
          reviewStatus: 'in_review',
          prNumber: 42,
          prBranch: 'submission/7',
          editedPraxis: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'old' }] }] } },
        },
        req: {
          payload: {
            findByID: vi.fn().mockResolvedValue({
              id: 5,
              slug: 'demo',
              title: 'Demo',
              intent: 'background',
              summary: 's',
              definition: { root: { type: 'root', children: [] } },
              praxis: { root: { type: 'root', children: [] } },
              risiken: { root: { type: 'root', children: [] } },
              quellen: { root: { type: 'root', children: [] } },
            }),
          },
        } as never,
      });

      expect(mocks.pushSubmissionEdit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ branch: 'submission/7', path: 'content/articles/demo.md' }),
      );
    });

    it('skips re-push when reviewStatus is not in_review', async () => {
      const { afterSubmissionChangeHook } = await import('@/collections/Submissions');
      await afterSubmissionChangeHook({
        operation: 'update',
        doc: { id: 7, reviewStatus: 'pending', prBranch: null } as never,
        previousDoc: {} as never,
        req: { payload: { findByID: vi.fn() } } as never,
      });
      expect(mocks.pushSubmissionEdit).not.toHaveBeenCalled();
    });

    it('skips re-push when prBranch is null', async () => {
      const { afterSubmissionChangeHook } = await import('@/collections/Submissions');
      await afterSubmissionChangeHook({
        operation: 'update',
        doc: { id: 7, reviewStatus: 'in_review', prBranch: null } as never,
        previousDoc: {} as never,
        req: { payload: { findByID: vi.fn() } } as never,
      });
      expect(mocks.pushSubmissionEdit).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2:** Test für Article-Sync-Hook schreiben.
  ```typescript
  // tests/integration/article-sync-hook.test.ts
  import { describe, expect, it, vi, beforeEach } from 'vitest';

  const mocks = vi.hoisted(() => ({
    getOctokit: vi.fn(),
    upsertArticleMarkdown: vi.fn(),
    deleteArticleMarkdown: vi.fn(),
  }));

  vi.mock('@/lib/github-app', () => ({ getOctokit: mocks.getOctokit }));
  vi.mock('@/lib/github-article-sync', () => ({
    upsertArticleMarkdown: mocks.upsertArticleMarkdown,
    deleteArticleMarkdown: mocks.deleteArticleMarkdown,
  }));

  describe('Articles.afterChange (markdown sync)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('upserts markdown when status=published', async () => {
      mocks.getOctokit.mockReturnValue({} as never);
      mocks.upsertArticleMarkdown.mockResolvedValue({ committed: true });
      const { afterArticleChangeHook } = await import('@/collections/Articles');
      await afterArticleChangeHook({
        operation: 'update',
        doc: {
          id: 1,
          slug: 'demo',
          title: 'Demo',
          intent: 'background',
          summary: 's',
          status: 'published',
          definition: { root: { type: 'root', children: [] } },
          praxis: { root: { type: 'root', children: [] } },
          risiken: { root: { type: 'root', children: [] } },
          quellen: { root: { type: 'root', children: [] } },
        },
        previousDoc: { status: 'draft' } as never,
        req: { context: {}, payload: { find: vi.fn().mockResolvedValue({ docs: [] }) } } as never,
      });
      expect(mocks.upsertArticleMarkdown).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ slug: 'demo' }),
      );
    });

    it('skips sync when req.context.skipMarkdownSync is true', async () => {
      const { afterArticleChangeHook } = await import('@/collections/Articles');
      await afterArticleChangeHook({
        operation: 'update',
        doc: { id: 1, status: 'published', slug: 'demo' } as never,
        previousDoc: {} as never,
        req: { context: { skipMarkdownSync: true }, payload: { find: vi.fn() } } as never,
      });
      expect(mocks.upsertArticleMarkdown).not.toHaveBeenCalled();
      expect(mocks.deleteArticleMarkdown).not.toHaveBeenCalled();
    });

    it('deletes markdown when status transitions away from published', async () => {
      mocks.getOctokit.mockReturnValue({} as never);
      mocks.deleteArticleMarkdown.mockResolvedValue({ committed: true });
      const { afterArticleChangeHook } = await import('@/collections/Articles');
      await afterArticleChangeHook({
        operation: 'update',
        doc: { id: 1, slug: 'demo', status: 'archived' } as never,
        previousDoc: { status: 'published' } as never,
        req: { context: {}, payload: { find: vi.fn() } } as never,
      });
      expect(mocks.deleteArticleMarkdown).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ slug: 'demo' }),
      );
    });

    it('does nothing when status remains draft', async () => {
      const { afterArticleChangeHook } = await import('@/collections/Articles');
      await afterArticleChangeHook({
        operation: 'update',
        doc: { id: 1, slug: 'demo', status: 'draft' } as never,
        previousDoc: { status: 'draft' } as never,
        req: { context: {}, payload: { find: vi.fn() } } as never,
      });
      expect(mocks.upsertArticleMarkdown).not.toHaveBeenCalled();
      expect(mocks.deleteArticleMarkdown).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 3:** Tests laufen, erwarten FAIL.
  ```bash
  pnpm test tests/integration/submission-edit-repush.test.ts tests/integration/article-sync-hook.test.ts
  ```

- [ ] **Step 4:** Submissions-Hook implementieren. In `src/collections/Submissions.ts` einen neuen exportierten Hook anlegen und ans Collection-Hooks-Config hängen.
  ```typescript
  // src/collections/Submissions.ts — am Datei-Ende, vor `export const Submissions`:
  import { getOctokit } from '@/lib/github-app';
  import { getGithubConfig } from '@/lib/env';
  import { pushSubmissionEdit } from '@/lib/github-pr';
  import { applySubmissionToArticle } from '@/lib/submission-to-article';
  import { renderArticleMarkdown } from '@/lib/article-markdown';

  export async function afterSubmissionChangeHook(args: {
    operation: 'create' | 'update' | string;
    doc: Record<string, unknown>;
    previousDoc: Record<string, unknown>;
    req: { payload: { findByID: (a: unknown) => Promise<unknown> } };
  }): Promise<void> {
    if (args.operation !== 'update') return;
    const doc = args.doc as {
      id: number;
      type?: string;
      reviewStatus?: string;
      prBranch?: string | null;
      proposedSlug?: string | null;
      relatedArticle?: number | null;
    };
    if (doc.reviewStatus !== 'in_review' || !doc.prBranch) return;

    let article: unknown = null;
    if (doc.type === 'correction' && doc.relatedArticle) {
      article = await args.req.payload.findByID({
        collection: 'articles',
        id: doc.relatedArticle,
        depth: 0,
      });
    }

    const apply = applySubmissionToArticle(doc as never, article as never);
    const snapshot = { ...(article as object), ...apply.patch, slug: apply.slug, status: 'published' };
    const markdown = renderArticleMarkdown({ id: 0, ...snapshot } as never, []);

    const cfg = getGithubConfig();
    const owner = cfg?.owner ?? 'shogun160';
    const repo = cfg?.repo ?? 'pflege-atlas';
    const octokit = getOctokit();

    const newPath = `content/articles/${apply.slug}.md`;
    const oldPath =
      doc.type === 'new_article' &&
      (args.previousDoc as { proposedSlug?: string }).proposedSlug &&
      (args.previousDoc as { proposedSlug?: string }).proposedSlug !== apply.slug
        ? `content/articles/${(args.previousDoc as { proposedSlug?: string }).proposedSlug}.md`
        : undefined;

    await pushSubmissionEdit(octokit, {
      owner,
      repo,
      branch: doc.prBranch,
      path: newPath,
      oldPath,
      markdown,
      message: `submission(${doc.id}): editorial revision`,
    });
  }
  ```

- [ ] **Step 5:** Hook in Submissions-Collection registrieren. `hooks.afterChange` Array (neu) hinzufügen:
  ```typescript
  // src/collections/Submissions.ts — im Collection-Config-Block, hooks.beforeChange existiert schon:
  hooks: {
    beforeChange: [ /* unverändert */ ],
    afterChange: [
      async (args) => {
        await afterSubmissionChangeHook(args as never);
      },
    ],
  },
  ```

- [ ] **Step 6:** Articles-Hook implementieren.
  ```typescript
  // src/collections/Articles.ts — am Datei-Ende, vor `export const Articles`:
  import { getOctokit } from '@/lib/github-app';
  import { getGithubConfig } from '@/lib/env';
  import {
    upsertArticleMarkdown,
    deleteArticleMarkdown,
  } from '@/lib/github-article-sync';
  import { renderArticleMarkdown } from '@/lib/article-markdown';

  export async function afterArticleChangeHook(args: {
    operation: 'create' | 'update' | string;
    doc: Record<string, unknown>;
    previousDoc: Record<string, unknown>;
    req: {
      context?: { skipMarkdownSync?: boolean };
      payload: { find: (a: unknown) => Promise<{ docs: { name?: string }[] }> };
    };
  }): Promise<void> {
    if (args.req?.context?.skipMarkdownSync) return;

    const doc = args.doc as { id: number; slug?: string; status?: string };
    const prev = args.previousDoc as { status?: string };

    const wasPublished = prev.status === 'published';
    const isPublished = doc.status === 'published';

    const cfg = getGithubConfig();
    const owner = cfg?.owner ?? 'shogun160';
    const repo = cfg?.repo ?? 'pflege-atlas';
    const octokit = getOctokit();

    if (!isPublished && wasPublished && doc.slug) {
      await deleteArticleMarkdown(octokit, { owner, repo, slug: doc.slug });
      return;
    }

    if (isPublished && doc.slug) {
      const markdown = renderArticleMarkdown(doc as never, []);
      await upsertArticleMarkdown(octokit, { owner, repo, slug: doc.slug, markdown });
    }
  }
  ```

- [ ] **Step 7:** Hook in Articles-Collection registrieren.
  ```typescript
  // src/collections/Articles.ts — im Collection-Config:
  hooks: {
    afterChange: [
      async (args) => {
        await afterArticleChangeHook(args as never);
      },
    ],
  },
  ```

- [ ] **Step 8:** Tests laufen, erwarten PASS.
  ```bash
  pnpm test tests/integration/submission-edit-repush.test.ts tests/integration/article-sync-hook.test.ts
  ```

- [ ] **Step 9:** Commit.
  ```bash
  git add src/collections/Submissions.ts src/collections/Articles.ts tests/integration/submission-edit-repush.test.ts tests/integration/article-sync-hook.test.ts
  git commit -m "feat(v1.5): afterChange hooks for PR re-push + article markdown sync"
  ```

---

## Task 14: Admin-UI — Workflow-Buttons + Inline-Diff-Komponente

**Files:**
- Create: `src/components/admin/SubmissionWorkflowButtons.tsx`
- Create: `src/components/admin/InlineSectionDiff.tsx`
- Create: `tests/component/SubmissionWorkflowButtons.test.tsx`
- Create: `tests/component/InlineSectionDiff.test.tsx`
- Modify: `src/collections/Submissions.ts` (Felder mit `admin.components.Field` ergänzen)

- [ ] **Step 1:** Test für SubmissionWorkflowButtons schreiben.
  ```typescript
  // tests/component/SubmissionWorkflowButtons.test.tsx
  import { describe, expect, it, vi } from 'vitest';
  import { render, screen, fireEvent } from '@testing-library/react';
  import { SubmissionWorkflowButtons } from '@/components/admin/SubmissionWorkflowButtons';

  const mocks = vi.hoisted(() => ({
    inReviewAction: vi.fn().mockResolvedValue({ ok: true }),
    acceptAction: vi.fn().mockResolvedValue({ ok: true }),
    rejectAction: vi.fn().mockResolvedValue({ ok: true }),
  }));

  vi.mock('@/app/(payload)/admin/submission-actions', () => mocks);

  describe('SubmissionWorkflowButtons', () => {
    it('shows "In Review nehmen" when status=pending', () => {
      render(<SubmissionWorkflowButtons submissionId={7} reviewStatus="pending" />);
      expect(screen.getByText(/In Review nehmen/)).toBeInTheDocument();
      expect(screen.queryByText(/^Annehmen$/)).not.toBeInTheDocument();
    });

    it('shows "Annehmen" and "Ablehnen" when status=in_review', () => {
      render(<SubmissionWorkflowButtons submissionId={7} reviewStatus="in_review" />);
      expect(screen.getByText(/Annehmen/)).toBeInTheDocument();
      expect(screen.getByText(/Ablehnen/)).toBeInTheDocument();
    });

    it('shows nothing when status=accepted', () => {
      const { container } = render(
        <SubmissionWorkflowButtons submissionId={7} reviewStatus="accepted" />,
      );
      expect(container.textContent).toMatch(/Übernommen/);
    });

    it('calls inReviewAction when "In Review nehmen" clicked', async () => {
      render(<SubmissionWorkflowButtons submissionId={7} reviewStatus="pending" />);
      fireEvent.click(screen.getByText(/In Review nehmen/));
      expect(mocks.inReviewAction).toHaveBeenCalledWith(7);
    });
  });
  ```

- [ ] **Step 2:** Test für InlineSectionDiff schreiben.
  ```typescript
  // tests/component/InlineSectionDiff.test.tsx
  import { describe, expect, it } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import { InlineSectionDiff } from '@/components/admin/InlineSectionDiff';

  describe('InlineSectionDiff', () => {
    it('renders "Keine Änderung" when content unchanged', () => {
      render(
        <InlineSectionDiff
          mode="correction"
          original="Hallo"
          edited="Hallo"
          sectionLabel="Praxis"
        />,
      );
      expect(screen.getByText(/Keine Änderung/)).toBeInTheDocument();
    });

    it('renders additions and removals for correction mode', () => {
      render(
        <InlineSectionDiff
          mode="correction"
          original="alt"
          edited="neu"
          sectionLabel="Praxis"
        />,
      );
      expect(screen.getByText(/^- alt/m, { exact: false })).toBeInTheDocument();
      expect(screen.getByText(/^\+ neu/m, { exact: false })).toBeInTheDocument();
    });

    it('renders read-only preview for new_article mode', () => {
      render(
        <InlineSectionDiff
          mode="new_article"
          edited="Vorschlag-Text"
          sectionLabel="Definition"
        />,
      );
      expect(screen.getByText(/Vorschlag-Text/)).toBeInTheDocument();
    });

    it('shows empty-state hint when edited is empty in correction mode', () => {
      render(
        <InlineSectionDiff
          mode="correction"
          original="alt"
          edited=""
          sectionLabel="Praxis"
        />,
      );
      expect(screen.getByText(/Nicht editiert/)).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 3:** Tests laufen, erwarten FAIL.
  ```bash
  pnpm test tests/component/SubmissionWorkflowButtons.test.tsx tests/component/InlineSectionDiff.test.tsx
  ```

- [ ] **Step 4:** SubmissionWorkflowButtons implementieren.
  ```typescript
  // src/components/admin/SubmissionWorkflowButtons.tsx
  'use client';

  import { useState, useTransition } from 'react';
  import {
    inReviewAction,
    acceptAction,
    rejectAction,
  } from '@/app/(payload)/admin/submission-actions';

  type Props = { submissionId: number; reviewStatus: string };

  export function SubmissionWorkflowButtons({ submissionId, reviewStatus }: Props) {
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);

    function run(fn: (id: number) => Promise<{ ok: boolean; error?: string }>) {
      setMessage(null);
      startTransition(async () => {
        const res = await fn(submissionId);
        if (res.ok) setMessage('OK — bitte Seite neu laden, um neuen Status zu sehen.');
        else setMessage(`Fehler: ${res.error ?? 'unbekannt'}`);
      });
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
        {reviewStatus === 'pending' && (
          <button type="button" disabled={pending} onClick={() => run(inReviewAction)}>
            In Review nehmen
          </button>
        )}
        {reviewStatus === 'in_review' && (
          <>
            <button type="button" disabled={pending} onClick={() => run(acceptAction)}>
              Annehmen
            </button>
            <button type="button" disabled={pending} onClick={() => run(rejectAction)}>
              Ablehnen
            </button>
          </>
        )}
        {reviewStatus === 'accepted' && (
          <p style={{ margin: 0, fontStyle: 'italic' }}>Übernommen.</p>
        )}
        {reviewStatus === 'rejected' && (
          <p style={{ margin: 0, fontStyle: 'italic' }}>Abgelehnt.</p>
        )}
        {message && <p style={{ margin: 0, fontSize: 12 }}>{message}</p>}
      </div>
    );
  }
  ```

- [ ] **Step 5:** InlineSectionDiff implementieren.
  ```typescript
  // src/components/admin/InlineSectionDiff.tsx
  'use client';

  import { useMemo } from 'react';
  import { diffSection } from '@/lib/submission-section-diff';

  type Props =
    | { mode: 'correction'; original: string; edited: string; sectionLabel: string }
    | { mode: 'new_article'; edited: string; sectionLabel: string; original?: undefined };

  export function InlineSectionDiff(props: Props) {
    const { mode, edited, sectionLabel } = props;

    if (mode === 'new_article') {
      return (
        <div style={{ padding: 8, background: '#f8f8f8', borderRadius: 4 }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Vorschlag: {sectionLabel}</h4>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
            {edited || '(leer)'}
          </pre>
        </div>
      );
    }

    const { original } = props;
    if (!edited) {
      return (
        <div style={{ padding: 8, fontStyle: 'italic', color: '#666' }}>
          {sectionLabel}: Nicht editiert.
        </div>
      );
    }

    const result = useMemo(() => diffSection(original, edited), [original, edited]);

    if (!result.changed) {
      return (
        <div style={{ padding: 8, fontStyle: 'italic', color: '#666' }}>
          {sectionLabel}: Keine Änderung gegenüber dem Original.
        </div>
      );
    }

    return (
      <div style={{ padding: 8, background: '#f8f8f8', borderRadius: 4 }}>
        <h4 style={{ margin: '0 0 8px 0' }}>{sectionLabel} — Änderungen</h4>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13 }}>
          {result.parts.map((p, i) => {
            const prefix = p.kind === 'add' ? '+ ' : p.kind === 'remove' ? '- ' : '  ';
            const color =
              p.kind === 'add' ? '#0a7d2c' : p.kind === 'remove' ? '#b8553d' : '#333';
            return (
              <span key={i} style={{ color, display: 'block' }}>
                {p.text
                  .split('\n')
                  .filter((l, idx, arr) => idx < arr.length - 1 || l.length > 0)
                  .map((line) => `${prefix}${line}`)
                  .join('\n')}
              </span>
            );
          })}
        </pre>
      </div>
    );
  }
  ```

- [ ] **Step 6:** Tests laufen, erwarten PASS.
  ```bash
  pnpm test tests/component/SubmissionWorkflowButtons.test.tsx tests/component/InlineSectionDiff.test.tsx
  ```

- [ ] **Step 7:** Custom Components in Submissions-Collection für `prState`-Sidebar verdrahten (Workflow-Buttons als UI-Field).
  ```typescript
  // src/collections/Submissions.ts — neues UI-Field in der fields-Array, am Anfang (vor type):
  {
    name: 'workflowButtons',
    type: 'ui',
    admin: {
      components: {
        Field: 'src/components/admin/SubmissionWorkflowButtons.tsx#SubmissionWorkflowButtons',
      },
    },
  },
  ```
  (Payload 3.x: `type: 'ui'` mit dem Pfad-String als `components.Field`. Der Wrapper liest `reviewStatus` und `id` aus dem Form-Context via Payload-Hooks; alternative Wrap-Komponente mit Field-Helper falls Props nicht direkt durchgeschleift werden — siehe Payload-Doku.)

- [ ] **Step 8:** Lint + Tests.
  ```bash
  pnpm test && pnpm lint
  ```
  Expected: alle grün.

- [ ] **Step 9:** Commit.
  ```bash
  git add src/components/admin src/collections/Submissions.ts tests/component/SubmissionWorkflowButtons.test.tsx tests/component/InlineSectionDiff.test.tsx
  git commit -m "feat(v1.5): admin workflow buttons + inline section diff component"
  ```

---

## Task 15: PII-Notice im Submission-Form

**Files:**
- Create: `src/components/PiiNotice.tsx`
- Create: `tests/component/PiiNotice.test.tsx`
- Modify: `src/components/SubmissionForm.tsx` (PiiNotice einbinden)
- Modify: `tests/component/SubmissionForm.test.tsx` (Assertion neu)

- [ ] **Step 1:** Test schreiben.
  ```typescript
  // tests/component/PiiNotice.test.tsx
  import { describe, expect, it } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import { PiiNotice } from '@/components/PiiNotice';

  describe('PiiNotice', () => {
    it('renders the privacy hint text', () => {
      render(<PiiNotice />);
      expect(screen.getByText(/Datenschutz/i)).toBeInTheDocument();
      expect(screen.getByText(/keine Namen/i)).toBeInTheDocument();
      expect(screen.getByText(/öffentlich auf GitHub/i)).toBeInTheDocument();
    });

    it('uses semantic role=note', () => {
      render(<PiiNotice />);
      expect(screen.getByRole('note')).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2:** Test laufen lassen, erwarte FAIL.
  ```bash
  pnpm test tests/component/PiiNotice.test.tsx
  ```

- [ ] **Step 3:** Komponente implementieren.
  ```typescript
  // src/components/PiiNotice.tsx
  export function PiiNotice() {
    return (
      <div
        role="note"
        style={{
          padding: '12px 16px',
          marginBottom: 16,
          background: 'var(--color-petrol-light, #e7f0f2)',
          borderLeft: '4px solid var(--color-petrol, #1f5e6d)',
          borderRadius: 4,
          fontSize: 14,
        }}
      >
        <strong>Datenschutz:</strong> Bitte schreib generisch — keine Namen,
        Initialen oder Personen-Bezüge (auch nicht von Bewohner:innen,
        Kolleg:innen oder Arbeitgebern). Wenn dein Beitrag angenommen wird,
        landet er öffentlich auf GitHub.
      </div>
    );
  }
  ```

- [ ] **Step 4:** Test laufen lassen, erwarte PASS.
  ```bash
  pnpm test tests/component/PiiNotice.test.tsx
  ```

- [ ] **Step 5:** PiiNotice in SubmissionForm einbinden — direkt nach dem `<form>`-Open, vor dem type-Switch.
  ```typescript
  // src/components/SubmissionForm.tsx — Edit innerhalb des JSX-Returns:
  import { PiiNotice } from './PiiNotice';
  // ... bestehender Code ...
  return (
    <form action={formAction}>
      <PiiNotice />
      {/* bestehender type-Switch + Fields */}
    </form>
  );
  ```

- [ ] **Step 6:** SubmissionForm-Test um Assertion erweitern.
  ```typescript
  // tests/component/SubmissionForm.test.tsx — innerhalb existing describe:
  it('renders the PII notice above the form fields', () => {
    render(<SubmissionForm articles={[]} {/* bestehende Props */} />);
    expect(screen.getByText(/keine Namen, Initialen/i)).toBeInTheDocument();
  });
  ```

- [ ] **Step 7:** Tests + Lint.
  ```bash
  pnpm test && pnpm lint
  ```

- [ ] **Step 8:** Commit.
  ```bash
  git add src/components/PiiNotice.tsx src/components/SubmissionForm.tsx tests/component/PiiNotice.test.tsx tests/component/SubmissionForm.test.tsx
  git commit -m "feat(v1.5): pii notice in submission form"
  ```

---

## Task 16: ENV / README / CONTRIBUTING-Dokumentation

**Files:**
- Modify (Append): `.env.example`
- Modify (Append): `README.md`
- Modify (Append): `CONTRIBUTING.md`

**V1.3a-Lesson:** Niemals überschreiben, immer appenden — existing keys lesen bevor man neue Sektionen anfügt.

- [ ] **Step 1:** `.env.example` lesen, dann GitHub-Sektion appenden.
  ```bash
  tail -30 .env.example
  ```
  Inhalt anfügen:
  ```
  # ---------------------------------------------------------------
  # V1.5 — GitHub-Sync (Submissions als PRs)
  # Wird nur aktiv, wenn GITHUB_APP_PRIVATE_KEY gesetzt ist.
  # In Production (NODE_ENV=production) sind alle drei Pflicht.
  # Werte im 1Password-Eintrag "PflegeAtlas GitHub App".
  # ---------------------------------------------------------------
  GITHUB_APP_ID=
  GITHUB_APP_INSTALLATION_ID=
  # Base64-encoded private key (single line, ohne newlines)
  GITHUB_APP_PRIVATE_KEY=
  # Optional: Repo-Override (Default: shogun160 / pflege-atlas)
  # GITHUB_REPO_OWNER=
  # GITHUB_REPO_NAME=
  ```

- [ ] **Step 2:** README.md — kurzen V1.5-Hinweis im Submission-Abschnitt anfügen.
  ```bash
  grep -n "einreichen\|Submission" README.md | head -5
  ```
  Im passenden Abschnitt anfügen:
  ```markdown

  Seit V1.5: Angenommene Beiträge werden zusätzlich als PRs im Repo gespiegelt
  (`content/articles/<slug>.md`). Dafür wird eine GitHub App benötigt —
  Setup-Schritte siehe `.env.example`.
  ```

- [ ] **Step 3:** CONTRIBUTING.md — neuen Abschnitt „Pull-Requests" anfügen.
  ```markdown

  ## Pull-Requests

  - **Inhalts-PRs** (Branch-Name beginnt mit `submission/`) werden von
    **Christoph** (`@primus-homeassistant`) gemerged. Sie entstehen automatisch
    beim „In Review nehmen"-Klick im Payload-Admin und enthalten den
    Markdown-Diff des betroffenen Artikels.
  - **Code-PRs** (alles andere) werden von **Oliver** (`@shogun160`) gemerged.
  - Beide können einspringen — keine harte CODEOWNERS-Enforcement.
  - Die Admin-Aktionen „Annehmen" / „Ablehnen" mergen / schließen die PRs
    programmatisch; manuelles Merge im GitHub-UI ist nicht der vorgesehene Weg
    für Submission-PRs.
  ```

- [ ] **Step 4:** Diff sichten.
  ```bash
  git diff .env.example README.md CONTRIBUTING.md
  ```
  Expected: nur die neuen Sektionen, keine alten Zeilen entfernt.

- [ ] **Step 5:** Commit.
  ```bash
  git add .env.example README.md CONTRIBUTING.md
  git commit -m "docs(v1.5): env example + README note + CONTRIBUTING PR convention"
  ```

---

## Task 17: Manueller Smoke-Test, PR und Merge

**Files:**
- None (Verifikation + PR-Workflow)

- [ ] **Step 1:** Alle Tests + Build grün.
  ```bash
  pnpm test && pnpm lint && pnpm build
  ```
  Expected: 138+ Baseline-Tests + alle V1.5-Tests grün, 0 Lint-Errors, Build sauber.

- [ ] **Step 2:** Lokale `.env` mit echten App-Credentials befüllen (Werte aus 1Password „PflegeAtlas GitHub App").
  ```bash
  # In .env (NICHT committen):
  echo 'GITHUB_APP_ID=<aus 1Password>' >> .env
  echo 'GITHUB_APP_INSTALLATION_ID=<aus 1Password>' >> .env
  echo 'GITHUB_APP_PRIVATE_KEY=<base64-single-line aus 1Password>' >> .env
  ```

- [ ] **Step 3:** Postgres + Dev-Server starten.
  ```bash
  docker compose up -d
  pnpm dev
  ```

- [ ] **Step 4:** **Smoke-Test 1 — new_article-Flow.**
  1. `/einreichen?type=new_article` aufrufen, Vorschlag mit Test-Inhalt einreichen
  2. Im Admin `/admin/collections/submissions`: Submission öffnen
  3. „In Review nehmen" klicken → PR im echten Repo prüfen (sollte unter `https://github.com/shogun160/pflege-atlas/pulls` erscheinen)
  4. Submission im Admin editieren (z.B. Praxis-Sektion ändern) → speichern → PR-Diff sollte zweiten Commit zeigen
  5. „Annehmen" klicken → Article in `/admin/collections/articles` prüfen, PR-State `merged`
  6. Im Repo `content/articles/<slug>.md` lesen, ob Inhalt stimmt

- [ ] **Step 5:** **Smoke-Test 2 — correction-Flow.**
  1. `/einreichen?type=correction&article=<slug>` aufrufen, eine Sektion korrigieren
  2. Im Admin Submission öffnen → Inline-Diff für die geänderte Sektion sollte sichtbar sein
  3. „In Review nehmen" → PR sollte Markdown-Diff nur in der geänderten Sektion zeigen
  4. „Annehmen" → Article geupdatet, PR `merged`

- [ ] **Step 6:** **Smoke-Test 3 — Reject-Flow.**
  1. Neue Submission anlegen, „In Review nehmen", dann „Ablehnen"
  2. PR sollte `closed` sein, Branch gelöscht

- [ ] **Step 7:** **Smoke-Test 4 — Article-Direkt-Edit.**
  1. Im Admin einen bestehenden published Article editieren (z.B. Titel ändern), speichern
  2. Im Repo: Markdown-Datei sollte direkt auf `main` einen neuen Commit haben (kein PR)

- [ ] **Step 8:** Smoke-Test-Ergebnisse als Checkliste mit Screenshots (mindestens 1 pro Flow) sammeln — vorbereitet für PR-Body.

- [ ] **Step 9:** Final-Check + Push.
  ```bash
  git status
  git log --oneline main..HEAD | wc -l
  git push -u origin feat/v1-5-submissions-as-prs
  ```

- [ ] **Step 10:** PR via `gh pr create` erstellen.
  ```bash
  gh pr create \
    --base main \
    --head feat/v1-5-submissions-as-prs \
    --title "V1.5: Submissions als GitHub-PRs" \
    --body "$(cat <<'EOF'
  ## Summary
  - Submissions erzeugen ab "In Review"-Klick einen Markdown-PR im Repo
  - Article-Direkt-Edits syncen als direkter main-Commit (kein PR)
  - Atomare Server-Actions mit Compensating-Action bei Octokit-Fehlern
  - Inline-Diff im Admin (Plain-Text via diff-Library)
  - PII-Notice im Submission-Formular
  - Mock-only Tests + manueller Smoke-Test

  ## Spec
  - `docs/superpowers/specs/2026-06-20-pflegeatlas-submissions-as-prs-v1-5-design.md`

  ## Plan-Deviations
  (hier auflisten, falls während der Umsetzung Abweichungen entstanden)

  ## Manueller Smoke-Test (Pflicht vor Merge)
  - [x] **new_article:** Submission → In Review → PR sichtbar → editieren → PR-Diff aktualisiert → Annehmen → Article published + PR merged
  - [x] **correction:** Submission mit Sektion-Korrektur → Inline-Diff im Admin → PR-Diff korrekt → Annehmen → Article updated
  - [x] **reject:** PR wird geschlossen, Branch gelöscht
  - [x] **article-direct-edit:** Title-Änderung in published Article → direkter main-Commit, kein PR
  - [x] Screenshots im PR-Kommentar angehängt

  ## Tests
  - +50–70 neue Tests, 138 Baseline grün
  - 0 Lint-Errors
  - Build sauber

  ## DSGVO
  - Submitter-Name/-Email NICHT im PR-Body
  - correctionReason landet im PR (fachliche Begründung; PII-Hygiene durch Form-Notice + Triage)

  🤖 Generated with Claude Code
  EOF
  )"
  ```

- [ ] **Step 11:** Christoph (oder Oliver) reviewt im GitHub-UI und merged via Admin-Bypass (Branch-Ruleset).

- [ ] **Step 12:** Nach Merge: lokal main aktualisieren, Branch löschen.
  ```bash
  git checkout main
  git pull
  git branch -D feat/v1-5-submissions-as-prs
  ```

---

## Self-Review (durchgeführt nach Plan-Schreiben)

**Spec-Coverage:**
- [x] B' Architektur (DB Source-of-Truth, kein Reverse-Parser) → Tasks 8-13
- [x] PR ab "In Review"-Klick → Task 12 (inReviewAction)
- [x] Article-Direkt-Edits via main-Commit → Task 9 + Task 13 Articles-Hook
- [x] Atomar mit Compensating-Action → Task 12 (try/catch + Rollback)
- [x] PII-Notice → Task 15
- [x] Mock-only Tests + manueller Smoke → Task 17
- [x] GitHub-App-Setup → Pre-Task A
- [x] Slug-Konflikt-Auflösung → Task 4 + Task 12 Inkorporation
- [x] `skipMarkdownSync`-Flag gegen Doppel-Sync → Task 12 acceptAction + Task 13 Articles-Hook
- [x] Frontmatter-Felder (payloadId, slug, title, intent, summary, status, authors, lastReviewedAt, standardsBound) → Task 3
- [x] 4 neue Submission-Felder (proposedSlug, prNumber, prBranch, prState) → Task 7
- [x] PR-Body ohne Submitter-PII → Task 12 (`buildPRBody`)
- [x] Production-Boot-Check → Task 5
- [x] CONTRIBUTING.md-Konvention → Task 16

**Placeholder-Check:** Keine TBD/TODO; alle Steps haben konkrete Code-/Bash-Blöcke.

**Type-Konsistenz:** `SyncResult` aus Task 8 wird in Task 12 konsumiert (gleiche Property-Namen `prNumber`/`prBranch`/`prState`); `ArticleSyncResult` aus Task 9 wird in Task 13 Articles-Hook nur intern verwendet; `ApplyResult` aus Task 10 wird in Tasks 12 + 13 konsumiert.

**Bekannte Untiefen:**
- Step 7 von Task 14 (Custom Field-Wiring in Payload-Admin) lehnt sich an Payload 3.x `type: 'ui'` + `admin.components.Field`-Pattern an. Falls Payload-Version-Drift den Pfad-String-Modus geändert hat: Subagent prüft Payload-Doku zur Sub-Task-Zeit und passt an. Workaround: Custom-Komponente als Wrapper mit `useFormFields` Hook holen, IDs aus dem Form-State lesen.
- Slug-Resolver wird beim `inReviewAction` für new_article aufgerufen (Task 12 Step 5), nutzt `payload.find` mit `where: { slug: { equals: candidate } }`. Im edge case Article wurde inzwischen mit dem Slug angelegt: zweiter "In Review"-Versuch findet einen anderen freien Slug.

**Plan ist bereit zur Ausführung.**

---

## Execution Handoff

Plan komplett und gespeichert. Zwei Ausführungs-Optionen:

1. **Subagent-Driven (empfohlen):** Fresh Subagent pro Task, Review zwischen Tasks, schnelle Iteration. Nutzt `superpowers:subagent-driven-development`.
2. **Inline Execution:** Tasks in der aktuellen Session ausführen mit `superpowers:executing-plans`, Batch-Execution mit Checkpoints.

Welcher Ansatz?
