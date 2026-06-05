# V1.3b Submission-Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den `/einreichen`-Stub durch ein funktionales Submission-Formular mit Zod-Validation, Cloudflare Turnstile, ErrorSummary + Inline-Errors, PRG-Redirect und Submission-Notification über die V1.3a-Mail-Infrastruktur ersetzen.

**Architecture:** Drei Schichten: Client (`SubmissionForm` mit `useActionState` + Turnstile-Widget), Server Action (`safeParse` → `verifyTurnstileToken` → `payload.create` → `payload.sendEmail` → `redirect`), Daten (Payload Submissions-Collection + V1.3a Mail-Adapter, beide unverändert). Schema lebt als Zod-Source-of-Truth in `src/lib/`.

**Tech Stack:** Next.js 16, React 19 (Server Actions + `useActionState` + `useFormStatus`), Payload CMS 3.85, Zod, `@marsidev/react-turnstile`, Vitest 4.1, pnpm 10.

**Branch:** `feat/v1-3b-submission-formular` (existiert, Spec ist drauf als `9edb018`).

**Spec-Referenz:** `docs/superpowers/specs/2026-06-05-pflegeatlas-submission-form-v1-3b-design.md`

---

## File Structure

| Pfad | Typ | Zuständigkeit |
|---|---|---|
| `src/lib/submission-schema.ts` | **NEU** | Zod-Schema, exportierter `SubmissionInput`-Type, Cross-Field-Refine für correction |
| `src/lib/submission-mail.ts` | **NEU** | `buildSubmissionMail(args)` returnt `{ to, subject, html, text }` |
| `src/lib/turnstile.ts` | **NEU** | `verifyTurnstileToken(token)` mit Dev-Bypass wenn `TURNSTILE_SECRET_KEY` fehlt |
| `src/components/ErrorSummary.tsx` | **NEU** | a11y-Block mit Anker-Links, autofocus bei Mount |
| `src/components/SubmissionForm.tsx` | **NEU** | Client-Component, `useActionState`, Turnstile-Widget, Inline-Errors |
| `src/app/(frontend)/einreichen/actions.ts` | **NEU** | Server Action `submitAction(prevState, formData)` |
| `src/app/(frontend)/einreichen/page.tsx` | MODIFIZIERT | Stub raus, Form-Render mit Smart-Defaults aus `searchParams` |
| `src/app/(frontend)/einreichen/danke/page.tsx` | **NEU** | Statische Dank-Seite |
| `tests/unit/submission-schema.test.ts` | **NEU** | Zod-Edge-Cases |
| `tests/unit/submission-mail.test.ts` | **NEU** | Template-Builder |
| `tests/unit/turnstile.test.ts` | **NEU** | siteverify success/fail + Bypass |
| `tests/integration/submission-action.test.ts` | **NEU** | Action mit Mocks |
| `tests/component/SubmissionForm.test.tsx` | **NEU** | Render + Pending-State + Field-Errors |
| `.env.example` | MODIFIZIERT | Turnstile-Vars ergänzen (V1.3a-Werte **nicht** überschreiben) |
| `README.md` | MODIFIZIERT | Turnstile-Setup-Hinweis im Mail-Setup-Abschnitt oder eigener kleiner Abschnitt |
| `package.json` | MODIFIZIERT (auto) | `zod`, `@marsidev/react-turnstile` durch `pnpm add` |

---

## Setup-Track parallel

- **Pre-Task A** (manuell, Oliver+Claude): Turnstile-Site im Cloudflare-Dashboard anlegen, Site-Key + Secret-Key in 1Password. Geht parallel zum Code-Track.
- **Code-Track** (Tasks 1–9): läuft komplett ohne Turnstile-Keys, weil `verifyTurnstileToken` Dev-Bypass hat.
- **Task 10** (Sync): braucht beide.
- **Task 11**: PR + Merge.

---

## Pre-Task A: Cloudflare Turnstile-Site anlegen

**Wer:** Oliver klickt, Claude führt.

- [ ] **Schritt 1:** Cloudflare-Dashboard → ganz links unten oder über die Suche **„Turnstile"** öffnen.

- [ ] **Schritt 2:** „Add Site" / „Add Widget" drücken. Felder:
  - Sitename: `pflegeatlas-submission-form`
  - Domain hinzufügen: `pflegeatlas.org` (und auch `localhost` für Dev, falls Cloudflare das erlaubt — sonst Dev läuft eh über Bypass-Pfad)
  - Widget Mode: **„Managed"** (Cloudflare entscheidet je nach Risiko ob Challenge nötig)
  - Pre-Clearance: aus

- [ ] **Schritt 3:** Save. Cloudflare zeigt **Site Key** (public) und **Secret Key** (server-only). Beide kopieren:
  - Site Key in 1Password als „Turnstile Site Key — pflegeatlas-submission-form"
  - Secret Key in 1Password als „Turnstile Secret Key — pflegeatlas-submission-form"
  - **Secret Key nirgendwo anders ablegen, niemals ins Repo committen, niemals im Chat zeigen**

- [ ] **Schritt 4:** Für lokales Dev gibt es Test-Keys von Cloudflare die immer pass / immer fail returnen. Liste hier: https://developers.cloudflare.com/turnstile/troubleshooting/testing/ — der "always-passes" Site-Key ist `1x00000000000000000000AA`, der dazugehörige Secret `1x0000000000000000000000000000000AA`. Diese kannst du in Dev verwenden, wenn du den Bypass-Pfad nicht möchtest. Optional.

**Erfolgs-Kriterium:** Site- und Secret-Key in 1Password gespeichert, Cloudflare-Turnstile zeigt die Site als „Active".

---

## Task 1: Dependencies installieren

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (auto durch `pnpm add`)

- [ ] **Step 1:** Branch-Check.

```bash
git status
```

Expected: `On branch feat/v1-3b-submission-formular`, working tree clean außer Spec.

- [ ] **Step 2:** Zod installieren.

```bash
pnpm add zod
```

- [ ] **Step 3:** Turnstile React-Wrapper installieren.

```bash
pnpm add @marsidev/react-turnstile
```

- [ ] **Step 4:** Sanity-Check.

```bash
pnpm test
```

Expected: 36/36 grün (V1.3a-Baseline).

- [ ] **Step 5:** Commit.

```bash
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(v1.3b): add zod and @marsidev/react-turnstile

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Zod-Schema mit TDD

**Files:**
- Create: `src/lib/submission-schema.ts`
- Test: `tests/unit/submission-schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/submission-schema.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { SubmissionSchema, flattenZodErrors } from '@/lib/submission-schema';

const validBase = {
  type: 'new_article' as const,
  subject: 'Test-Betreff aus Plan',
  body: 'Test-Inhalt, mindestens zwanzig Zeichen lang um Validation zu bestehen.',
  turnstileToken: 'test-token',
};

describe('SubmissionSchema', () => {
  it('accepts a valid new_article submission with required fields only', () => {
    const result = SubmissionSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('rejects when subject is too short', () => {
    const result = SubmissionSchema.safeParse({ ...validBase, subject: 'ab' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(flat.subject).toMatch(/3 Zeichen/);
    }
  });

  it('rejects when body is too short', () => {
    const result = SubmissionSchema.safeParse({ ...validBase, body: 'kurz' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(flat.body).toMatch(/20 Zeichen/);
    }
  });

  it('rejects when turnstileToken is missing', () => {
    const { turnstileToken, ...withoutToken } = validBase;
    const result = SubmissionSchema.safeParse(withoutToken);
    expect(result.success).toBe(false);
  });

  it('accepts an optional email when correctly formatted', () => {
    const result = SubmissionSchema.safeParse({
      ...validBase,
      submitterEmail: 'oliver@example.org',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = SubmissionSchema.safeParse({
      ...validBase,
      submitterEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(flat.submitterEmail).toMatch(/gültige/);
    }
  });

  it('accepts an empty-string email (optional treatment)', () => {
    const result = SubmissionSchema.safeParse({
      ...validBase,
      submitterEmail: '',
    });
    expect(result.success).toBe(true);
  });

  it('requires relatedArticleSlug when type is correction', () => {
    const result = SubmissionSchema.safeParse({
      ...validBase,
      type: 'correction',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(flat.relatedArticleSlug).toMatch(/Korrektur/);
    }
  });

  it('accepts correction with relatedArticleSlug set', () => {
    const result = SubmissionSchema.safeParse({
      ...validBase,
      type: 'correction',
      relatedArticleSlug: 'dekubitus',
    });
    expect(result.success).toBe(true);
  });
});

describe('flattenZodErrors', () => {
  it('flattens nested errors into { fieldName: firstErrorMessage }', () => {
    const result = SubmissionSchema.safeParse({ ...validBase, subject: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = flattenZodErrors(result.error);
      expect(typeof flat.subject).toBe('string');
      expect(flat.subject.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/submission-schema.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/submission-schema.ts`:

```typescript
import { z, ZodError } from 'zod';

export const SubmissionSchema = z
  .object({
    type: z.enum(['new_article', 'correction']),
    subject: z.string().trim().min(3, 'Bitte mindestens 3 Zeichen.').max(200, 'Maximal 200 Zeichen.'),
    relatedArticleSlug: z.string().trim().optional(),
    body: z.string().trim().min(20, 'Bitte mindestens 20 Zeichen.').max(20000, 'Maximal 20000 Zeichen.'),
    submitterName: z.string().trim().max(100, 'Maximal 100 Zeichen.').optional(),
    submitterEmail: z
      .string()
      .trim()
      .email('Keine gültige E-Mail-Adresse.')
      .optional()
      .or(z.literal('')),
    turnstileToken: z.string().min(1, 'Captcha-Token fehlt.'),
  })
  .refine(
    (data) =>
      data.type !== 'correction' ||
      (typeof data.relatedArticleSlug === 'string' && data.relatedArticleSlug.length > 0),
    {
      path: ['relatedArticleSlug'],
      message: 'Bei Korrektur ist der bezogene Artikel Pflicht.',
    },
  );

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

Expected: 10 tests passing.

- [ ] **Step 5: Full suite check**

```bash
pnpm test
```

Expected: 46/46 grün (36 + 10).

- [ ] **Step 6: Lint**

```bash
pnpm lint
```

Expected: 0 errors, ≤ 24 warnings.

- [ ] **Step 7: Commit**

```bash
git add src/lib/submission-schema.ts tests/unit/submission-schema.test.ts
git commit -m "$(cat <<'EOF'
feat(v1.3b): zod schema for submissions with cross-field refine

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Mail-Template mit TDD

**Files:**
- Create: `src/lib/submission-mail.ts`
- Test: `tests/unit/submission-mail.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/submission-mail.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildSubmissionMail } from '@/lib/submission-mail';

const baseSubmission = {
  id: 'sub-abc',
  type: 'new_article' as const,
  subject: 'Vorschlag: Dekubitusprophylaxe-Update',
  body: 'Beschreibung des neuen Inhalts.',
  submitterName: 'Anna Beispiel',
  submitterEmail: 'anna@example.org',
  createdAt: '2026-06-05T12:34:56Z',
};

describe('buildSubmissionMail', () => {
  it('returns to set to redaktion@pflegeatlas.org', () => {
    const mail = buildSubmissionMail({ submission: baseSubmission });
    expect(mail.to).toBe('redaktion@pflegeatlas.org');
  });

  it('builds a subject containing the submission subject', () => {
    const mail = buildSubmissionMail({ submission: baseSubmission });
    expect(mail.subject).toContain('Vorschlag: Dekubitusprophylaxe-Update');
    expect(mail.subject).toMatch(/PflegeAtlas/i);
  });

  it('includes submission body, submitter name and email in html', () => {
    const mail = buildSubmissionMail({ submission: baseSubmission });
    expect(mail.html).toContain('Beschreibung des neuen Inhalts.');
    expect(mail.html).toContain('Anna Beispiel');
    expect(mail.html).toContain('anna@example.org');
  });

  it('shows "anonym" when no submitter name given', () => {
    const mail = buildSubmissionMail({
      submission: { ...baseSubmission, submitterName: undefined },
    });
    expect(mail.text).toMatch(/anonym/i);
  });

  it('shows "—" for related article when none passed', () => {
    const mail = buildSubmissionMail({ submission: baseSubmission });
    expect(mail.text).toMatch(/Bezogen auf:\s*—/);
  });

  it('shows article title when correction with related article', () => {
    const correction = {
      ...baseSubmission,
      type: 'correction' as const,
    };
    const mail = buildSubmissionMail({
      submission: correction,
      articleTitle: 'Dekubitusprophylaxe Basics',
    });
    expect(mail.text).toContain('Dekubitusprophylaxe Basics');
  });

  it('includes admin URL with submission id', () => {
    const mail = buildSubmissionMail({ submission: baseSubmission });
    expect(mail.html).toContain('/admin/collections/submissions/sub-abc');
    expect(mail.text).toContain('/admin/collections/submissions/sub-abc');
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm vitest run tests/unit/submission-mail.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement**

Create `src/lib/submission-mail.ts`:

```typescript
type SubmissionForMail = {
  id: string;
  type: 'new_article' | 'correction';
  subject: string;
  body: string;
  submitterName?: string;
  submitterEmail?: string;
  createdAt: string;
};

type Args = {
  submission: SubmissionForMail;
  articleTitle?: string;
  siteUrl?: string;
};

const TYPE_LABELS = {
  new_article: 'Neuer Artikel-Vorschlag',
  correction: 'Korrektur',
} as const;

export function buildSubmissionMail({
  submission,
  articleTitle,
  siteUrl = 'https://pflegeatlas.org',
}: Args) {
  const typeLabel = TYPE_LABELS[submission.type];
  const senderName = submission.submitterName || 'anonym';
  const senderEmail = submission.submitterEmail || 'keine Mailadresse';
  const articleLabel = articleTitle || '—';
  const adminUrl = `${siteUrl}/admin/collections/submissions/${submission.id}`;

  const subject = `[PflegeAtlas] Neue Submission: ${submission.subject}`;

  const text = [
    `Neue Submission auf PflegeAtlas`,
    ``,
    `Eingegangen am: ${submission.createdAt}`,
    `Typ: ${typeLabel}`,
    `Betreff: ${submission.subject}`,
    `Bezogen auf: ${articleLabel}`,
    `Eingereicht von: ${senderName} (${senderEmail})`,
    ``,
    `—— Inhalt ——`,
    submission.body,
    ``,
    `—— Verwaltung ——`,
    `Im Admin öffnen: ${adminUrl}`,
  ].join('\n');

  const html = `
<div style="font-family: sans-serif; line-height: 1.5; color: #1f2937;">
  <h2 style="margin-bottom: 0.5rem;">Neue Submission auf PflegeAtlas</h2>
  <dl style="margin: 0;">
    <dt style="font-weight: 600;">Eingegangen am</dt><dd>${escapeHtml(submission.createdAt)}</dd>
    <dt style="font-weight: 600;">Typ</dt><dd>${escapeHtml(typeLabel)}</dd>
    <dt style="font-weight: 600;">Betreff</dt><dd>${escapeHtml(submission.subject)}</dd>
    <dt style="font-weight: 600;">Bezogen auf</dt><dd>${escapeHtml(articleLabel)}</dd>
    <dt style="font-weight: 600;">Eingereicht von</dt><dd>${escapeHtml(senderName)} (${escapeHtml(senderEmail)})</dd>
  </dl>
  <h3 style="margin-top: 1.5rem;">Inhalt</h3>
  <p style="white-space: pre-wrap;">${escapeHtml(submission.body)}</p>
  <hr style="margin: 1.5rem 0;">
  <p><a href="${adminUrl}">Im Admin öffnen</a></p>
</div>`.trim();

  return {
    to: 'redaktion@pflegeatlas.org',
    subject,
    text,
    html,
  };
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
```

- [ ] **Step 4: Run tests, expect green**

```bash
pnpm vitest run tests/unit/submission-mail.test.ts
```

Expected: 7 tests passing.

- [ ] **Step 5: Full suite, lint**

```bash
pnpm test && pnpm lint
```

Expected: 53/53 grün, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/submission-mail.ts tests/unit/submission-mail.test.ts
git commit -m "$(cat <<'EOF'
feat(v1.3b): submission mail template builder

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Turnstile-Helper mit TDD

**Files:**
- Create: `src/lib/turnstile.ts`
- Test: `tests/unit/turnstile.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/turnstile.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstileToken } from '@/lib/turnstile';

describe('verifyTurnstileToken', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = originalFetch;
  });

  it('returns true via bypass when TURNSTILE_SECRET_KEY is empty', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '');
    const result = await verifyTurnstileToken('any-token');
    expect(result).toBe(true);
  });

  it('returns true when Cloudflare siteverify responds success: true', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch;
    const result = await verifyTurnstileToken('valid-token');
    expect(result).toBe(true);
  });

  it('returns false when Cloudflare siteverify responds success: false', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    }) as unknown as typeof fetch;
    const result = await verifyTurnstileToken('invalid-token');
    expect(result).toBe(false);
  });

  it('returns false when fetch throws', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
    const result = await verifyTurnstileToken('any-token');
    expect(result).toBe(false);
  });

  it('returns false when token is empty even with secret set', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret');
    const result = await verifyTurnstileToken('');
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm vitest run tests/unit/turnstile.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement**

Create `src/lib/turnstile.ts`:

```typescript
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        'TURNSTILE_SECRET_KEY is not set — bypassing Turnstile verification. ' +
          'Do not deploy without a real key.',
      );
    }
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const body = new URLSearchParams({ secret, response: token });
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verification failed', err);
    return false;
  }
}
```

- [ ] **Step 4: Run tests, expect green**

```bash
pnpm vitest run tests/unit/turnstile.test.ts
```

Expected: 5 tests passing.

- [ ] **Step 5: Sanity**

```bash
pnpm test && pnpm lint
```

Expected: 58/58 grün.

- [ ] **Step 6: Commit**

```bash
git add src/lib/turnstile.ts tests/unit/turnstile.test.ts
git commit -m "$(cat <<'EOF'
feat(v1.3b): turnstile siteverify helper with dev-bypass

verifyTurnstileToken returns true unconditionally when
TURNSTILE_SECRET_KEY is unset (dev + CI fallback).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: ErrorSummary-Komponente

**Files:**
- Create: `src/components/ErrorSummary.tsx`
- Test: included im SubmissionForm-Component-Test (Task 7), keine eigene Test-Datei nötig — kleine Component.

- [ ] **Step 1: Write component**

Create `src/components/ErrorSummary.tsx`:

```typescript
'use client';

import { useEffect, useRef } from 'react';

type Props = {
  errors: Record<string, string>;
  fieldLabels?: Record<string, string>;
};

export function ErrorSummary({ errors, fieldLabels = {} }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = Object.entries(errors);

  useEffect(() => {
    if (entries.length > 0 && ref.current) {
      ref.current.focus();
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby="error-summary-title"
      className="mb-6 rounded-lg border-l-4 border-accent bg-surface p-4 text-ink"
    >
      <h2 id="error-summary-title" className="mb-2 font-semibold text-accent">
        Bitte korrigiere folgende Eingaben:
      </h2>
      <ul className="list-disc pl-5 space-y-1 text-sm">
        {entries.map(([field, message]) => (
          <li key={field}>
            <a href={`#field-${field}`} className="text-brand underline-offset-2 hover:underline">
              {fieldLabels[field] ?? field}: {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Build sanity-check**

```bash
pnpm build
```

Expected: grün.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ErrorSummary.tsx
git commit -m "$(cat <<'EOF'
feat(v1.3b): a11y ErrorSummary component

autoFocuses on mount, lists field errors with anchor links to
"#field-<name>". Used by SubmissionForm.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: SubmissionForm-Komponente

**Files:**
- Create: `src/components/SubmissionForm.tsx`
- Test: `tests/component/SubmissionForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/component/SubmissionForm.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubmissionForm } from '@/components/SubmissionForm';

// Mock the Turnstile widget — it requires browser-only setup
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: () => <div data-testid="turnstile-mock" />,
}));

describe('SubmissionForm', () => {
  const articles = [
    { slug: 'dekubitus', title: 'Dekubitusprophylaxe' },
    { slug: 'lagerung', title: 'Lagerung' },
  ];

  it('renders all required fields', () => {
    render(
      <SubmissionForm
        articles={articles}
        turnstileSiteKey="test-key"
      />,
    );
    expect(screen.getByLabelText(/Art/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Betreff/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Inhalt/i)).toBeInTheDocument();
    expect(screen.getByTestId('turnstile-mock')).toBeInTheDocument();
  });

  it('pre-fills type from props', () => {
    render(
      <SubmissionForm
        articles={articles}
        turnstileSiteKey="test-key"
        initialType="correction"
      />,
    );
    const select = screen.getByLabelText(/Art/i) as HTMLSelectElement;
    expect(select.value).toBe('correction');
  });

  it('pre-fills relatedArticleSlug from props when correction', () => {
    render(
      <SubmissionForm
        articles={articles}
        turnstileSiteKey="test-key"
        initialType="correction"
        initialArticleSlug="dekubitus"
      />,
    );
    const select = screen.getByLabelText(/Bezogen auf/i) as HTMLSelectElement;
    expect(select.value).toBe('dekubitus');
  });

  it('renders noscript fallback with mailto link', () => {
    const { container } = render(
      <SubmissionForm articles={articles} turnstileSiteKey="test-key" />,
    );
    const noscript = container.querySelector('noscript');
    expect(noscript?.innerHTML).toMatch(/mitmachen@pflegeatlas\.org/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm vitest run tests/component/SubmissionForm.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/SubmissionForm.tsx`:

```typescript
'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import { ErrorSummary } from './ErrorSummary';
import { submitAction, type SubmitState } from '@/app/(frontend)/einreichen/actions';

type Props = {
  articles: { slug: string; title: string }[];
  turnstileSiteKey: string;
  initialType?: 'new_article' | 'correction';
  initialArticleSlug?: string;
};

const FIELD_LABELS: Record<string, string> = {
  type: 'Art',
  subject: 'Betreff',
  body: 'Inhalt',
  relatedArticleSlug: 'Bezogen auf',
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

function FieldError({ name, errors }: { name: string; errors?: Record<string, string> }) {
  if (!errors?.[name]) return null;
  return (
    <p id={`error-${name}`} className="mt-1 text-sm text-accent">
      {errors[name]}
    </p>
  );
}

export function SubmissionForm({
  articles,
  turnstileSiteKey,
  initialType = 'new_article',
  initialArticleSlug = '',
}: Props) {
  const [state, formAction] = useActionState(submitAction, initialState);
  const [type, setType] = useState(initialType);

  return (
    <>
      <noscript>
        <p className="mb-6 rounded-lg border-l-4 border-accent bg-surface p-4 text-sm">
          JavaScript ist für dieses Formular nötig. Du kannst stattdessen direkt an{' '}
          <a className="text-brand underline" href="mailto:mitmachen@pflegeatlas.org">
            mitmachen@pflegeatlas.org
          </a>{' '}
          mailen.
        </p>
      </noscript>

      <form action={formAction} noValidate className="space-y-6">
        {state.error && (
          <p role="alert" className="rounded-lg border-l-4 border-accent bg-surface p-4">
            {state.error}
          </p>
        )}
        {state.fieldErrors && <ErrorSummary errors={state.fieldErrors} fieldLabels={FIELD_LABELS} />}

        <div>
          <label htmlFor="field-type" className="block font-semibold">
            Art *
          </label>
          <select
            id="field-type"
            name="type"
            required
            defaultValue={initialType}
            onChange={(e) => setType(e.target.value as 'new_article' | 'correction')}
            className="mt-1 w-full rounded-md border border-rule bg-white p-2"
          >
            <option value="new_article">Neuer Artikel-Vorschlag</option>
            <option value="correction">Korrektur</option>
          </select>
          <FieldError name="type" errors={state.fieldErrors} />
        </div>

        {type === 'correction' && (
          <div>
            <label htmlFor="field-relatedArticleSlug" className="block font-semibold">
              Bezogen auf *
            </label>
            <select
              id="field-relatedArticleSlug"
              name="relatedArticleSlug"
              defaultValue={initialArticleSlug}
              className="mt-1 w-full rounded-md border border-rule bg-white p-2"
            >
              <option value="">— wählen —</option>
              {articles.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.title}
                </option>
              ))}
            </select>
            <FieldError name="relatedArticleSlug" errors={state.fieldErrors} />
          </div>
        )}

        <div>
          <label htmlFor="field-subject" className="block font-semibold">
            Betreff *
          </label>
          <input
            id="field-subject"
            type="text"
            name="subject"
            required
            minLength={3}
            maxLength={200}
            className="mt-1 w-full rounded-md border border-rule bg-white p-2"
          />
          <FieldError name="subject" errors={state.fieldErrors} />
        </div>

        <div>
          <label htmlFor="field-body" className="block font-semibold">
            Inhalt *
          </label>
          <textarea
            id="field-body"
            name="body"
            required
            minLength={20}
            maxLength={20000}
            rows={10}
            className="mt-1 w-full rounded-md border border-rule bg-white p-2"
          />
          <FieldError name="body" errors={state.fieldErrors} />
        </div>

        <div>
          <label htmlFor="field-submitterName" className="block font-semibold">
            Name (optional)
          </label>
          <input
            id="field-submitterName"
            type="text"
            name="submitterName"
            maxLength={100}
            className="mt-1 w-full rounded-md border border-rule bg-white p-2"
          />
          <FieldError name="submitterName" errors={state.fieldErrors} />
        </div>

        <div>
          <label htmlFor="field-submitterEmail" className="block font-semibold">
            E-Mail (optional, für Rückfragen)
          </label>
          <input
            id="field-submitterEmail"
            type="email"
            name="submitterEmail"
            className="mt-1 w-full rounded-md border border-rule bg-white p-2"
          />
          <FieldError name="submitterEmail" errors={state.fieldErrors} />
        </div>

        <div>
          <Turnstile siteKey={turnstileSiteKey} options={{ size: 'normal' }} />
          <input type="hidden" name="turnstileToken" id="field-turnstileToken" />
        </div>

        <SubmitButton />
      </form>
    </>
  );
}
```

**Hinweis Turnstile-Token-Wiring:** Das `@marsidev/react-turnstile`-Widget rendert sich und ruft `onSuccess(token)` zurück. Wir brauchen ein paar Zeilen mehr um den Token in das hidden field zu bekommen — siehe Step 4-Korrektur.

- [ ] **Step 4: Korrektur — Turnstile-Token verdrahten**

Im obigen Code ist `<Turnstile siteKey={...} />` ohne onSuccess-Handler. Tatsächlich brauchen wir:

```typescript
const [turnstileToken, setTurnstileToken] = useState('');

// ...

<Turnstile
  siteKey={turnstileSiteKey}
  onSuccess={(token) => setTurnstileToken(token)}
  options={{ size: 'normal' }}
/>
<input type="hidden" name="turnstileToken" value={turnstileToken} readOnly />
```

Diese Variante in die Implementation einbauen.

- [ ] **Step 5: Run tests, expect green**

```bash
pnpm vitest run tests/component/SubmissionForm.test.tsx
```

Expected: 4 tests passing.

- [ ] **Step 6: Build + lint + full suite**

```bash
pnpm build && pnpm lint && pnpm test
```

Expected: alles grün, 62/62 Tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/SubmissionForm.tsx tests/component/SubmissionForm.test.tsx
git commit -m "$(cat <<'EOF'
feat(v1.3b): SubmissionForm client component

Renders all fields with native HTML5 validation hints, integrates
Turnstile widget with token wired into hidden input, ErrorSummary +
inline FieldError for a11y, useFormStatus disables submit button
during action pending.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Server Action mit Integrations-Test

**Files:**
- Create: `src/app/(frontend)/einreichen/actions.ts`
- Test: `tests/integration/submission-action.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/submission-action.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks for the two external surfaces the action talks to
const createMock = vi.fn();
const sendEmailMock = vi.fn();
const findMock = vi.fn();
const redirectMock = vi.fn(() => {
  throw new Error('NEXT_REDIRECT');
});

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({
    create: createMock,
    sendEmail: sendEmailMock,
    find: findMock,
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import { submitAction } from '@/app/(frontend)/einreichen/actions';

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

const validForm = {
  type: 'new_article',
  subject: 'Testbetreff für Integration',
  body: 'Test-Inhalt mit mindestens zwanzig Zeichen Länge.',
  turnstileToken: 'token',
  submitterName: '',
  submitterEmail: '',
};

describe('submitAction', () => {
  beforeEach(() => {
    createMock.mockReset().mockResolvedValue({
      id: 'sub-1',
      type: 'new_article',
      subject: 'Testbetreff für Integration',
      body: 'Test-Inhalt mit mindestens zwanzig Zeichen Länge.',
      createdAt: '2026-06-05T00:00:00Z',
    });
    sendEmailMock.mockReset().mockResolvedValue({ id: 'mail-1' });
    findMock.mockReset().mockResolvedValue({ docs: [] });
    redirectMock.mockClear();
    vi.stubEnv('TURNSTILE_SECRET_KEY', ''); // bypass-Pfad
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns fieldErrors when schema validation fails', async () => {
    const result = await submitAction({}, fd({ ...validForm, subject: '' }));
    expect(result.fieldErrors?.subject).toBeDefined();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('calls payload.create on valid input', async () => {
    await expect(submitAction({}, fd(validForm))).rejects.toThrow('NEXT_REDIRECT');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0]).toMatchObject({
      collection: 'submissions',
      data: expect.objectContaining({
        type: 'new_article',
        subject: 'Testbetreff für Integration',
        reviewStatus: 'pending',
      }),
    });
  });

  it('sends notification email after successful create', async () => {
    await expect(submitAction({}, fd(validForm))).rejects.toThrow('NEXT_REDIRECT');
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].to).toBe('redaktion@pflegeatlas.org');
  });

  it('redirects to /einreichen/danke on success', async () => {
    await expect(submitAction({}, fd(validForm))).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/einreichen/danke');
  });

  it('returns error when related article slug not found for corrections', async () => {
    findMock.mockResolvedValue({ docs: [] });
    const result = await submitAction(
      {},
      fd({ ...validForm, type: 'correction', relatedArticleSlug: 'unknown' }),
    );
    expect(result.fieldErrors?.relatedArticleSlug).toMatch(/nicht gefunden/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('does not bounce submit if mail send fails — submission still created', async () => {
    sendEmailMock.mockRejectedValue(new Error('mail down'));
    await expect(submitAction({}, fd(validForm))).rejects.toThrow('NEXT_REDIRECT');
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect fail**

```bash
pnpm vitest run tests/integration/submission-action.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/app/(frontend)/einreichen/actions.ts`:

```typescript
'use server';

import { redirect } from 'next/navigation';
import { SubmissionSchema, flattenZodErrors } from '@/lib/submission-schema';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { buildSubmissionMail } from '@/lib/submission-mail';
import { getPayloadClient } from '@/lib/payload';

export type SubmitState = {
  fieldErrors?: Record<string, string>;
  error?: string;
};

export async function submitAction(
  _prevState: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = SubmissionSchema.safeParse(raw);

  if (!parsed.success) {
    return { fieldErrors: flattenZodErrors(parsed.error) };
  }

  const verified = await verifyTurnstileToken(parsed.data.turnstileToken);
  if (!verified) {
    return { error: 'Captcha-Verifikation fehlgeschlagen. Bitte erneut versuchen.' };
  }

  const payload = await getPayloadClient();

  let relatedArticleId: string | undefined;
  let relatedArticleTitle: string | undefined;
  if (parsed.data.type === 'correction' && parsed.data.relatedArticleSlug) {
    const found = await payload.find({
      collection: 'articles',
      where: { slug: { equals: parsed.data.relatedArticleSlug } },
      limit: 1,
    });
    if (!found.docs || found.docs.length === 0) {
      return { fieldErrors: { relatedArticleSlug: 'Artikel nicht gefunden.' } };
    }
    relatedArticleId = String(found.docs[0].id);
    relatedArticleTitle = (found.docs[0] as { title?: string }).title;
  }

  let submission;
  try {
    submission = await payload.create({
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
  } catch (err) {
    console.error('Submission create failed', err);
    return { error: 'Es gab ein Problem beim Senden. Bitte später erneut versuchen.' };
  }

  try {
    const mail = buildSubmissionMail({
      submission: {
        id: String(submission.id),
        type: parsed.data.type,
        subject: parsed.data.subject,
        body: parsed.data.body,
        submitterName: parsed.data.submitterName || undefined,
        submitterEmail: parsed.data.submitterEmail || undefined,
        createdAt: String(submission.createdAt),
      },
      articleTitle: relatedArticleTitle,
    });
    await payload.sendEmail(mail);
  } catch (err) {
    console.error('Submission mail failed (non-fatal)', err);
  }

  redirect('/einreichen/danke');
}
```

- [ ] **Step 4: Run tests, expect green**

```bash
pnpm vitest run tests/integration/submission-action.test.ts
```

Expected: 6 tests passing.

- [ ] **Step 5: Lint, build, suite**

```bash
pnpm lint && pnpm build && pnpm test
```

Expected: 68/68 grün.

- [ ] **Step 6: Commit**

```bash
git add src/app/(frontend)/einreichen/actions.ts tests/integration/submission-action.test.ts
git commit -m "$(cat <<'EOF'
feat(v1.3b): submission server action

Pipeline: zod safeParse → verifyTurnstileToken → resolve related
article → payload.create → payload.sendEmail → redirect. Mail-send
failure does not bounce the submission (logged, redaktion can still
see it in admin).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Page-Update + Danke-Page

**Files:**
- Modify: `src/app/(frontend)/einreichen/page.tsx`
- Create: `src/app/(frontend)/einreichen/danke/page.tsx`

- [ ] **Step 1: Rewrite einreichen/page.tsx**

Ersetze den Stub-Inhalt komplett:

```typescript
import type { Metadata } from 'next';
import { SectionLabel } from '@/components/SectionLabel';
import { SubmissionForm } from '@/components/SubmissionForm';
import { getPayloadClient } from '@/lib/payload';

export const metadata: Metadata = {
  title: 'Mitmachen – PflegeAtlas',
  description: 'Reiche einen neuen Artikel oder eine Korrektur ein.',
};

type SearchParams = { type?: 'correction' | 'new_article'; article?: string };

export default async function EinreichenPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const initialType: 'correction' | 'new_article' =
    params.type === 'correction' ? 'correction' : 'new_article';
  const initialArticleSlug = params.article || '';

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <SectionLabel className="mb-3">Mitmachen</SectionLabel>
      <h1 className="mb-6 font-serif text-3xl font-semibold leading-tight text-ink">
        Teile dein Pflege-Wissen
      </h1>
      <p className="mb-10 text-lg text-ink-muted">
        Alle Inhalte stehen unter <a
          href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
          className="text-brand underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >CC BY-SA 4.0</a>. Mit dem Einreichen erklärst du dich mit dieser Lizenz einverstanden.
      </p>

      <SubmissionForm
        articles={articleOptions}
        turnstileSiteKey={process.env.TURNSTILE_SITE_KEY ?? ''}
        initialType={initialType}
        initialArticleSlug={initialArticleSlug}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create danke/page.tsx**

```typescript
import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionLabel } from '@/components/SectionLabel';

export const metadata: Metadata = {
  title: 'Danke – PflegeAtlas',
  description: 'Deine Submission ist bei uns angekommen.',
};

export default function DankePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <SectionLabel className="mb-3">Mitmachen</SectionLabel>
      <h1 className="mb-6 font-serif text-4xl font-semibold leading-tight text-ink">
        Danke!
      </h1>
      <p className="mb-6 text-lg text-ink-muted">
        Deine Submission ist bei uns angekommen. Die Redaktion prüft sie in den
        nächsten Tagen und meldet sich bei Rückfragen — falls du eine
        Mail-Adresse hinterlassen hast.
      </p>

      <aside
        role="note"
        className="mb-10 border-l-[3px] border-brand bg-surface px-4 py-3 text-sm text-ink-muted"
      >
        <strong className="text-ink">Lizenz:</strong>{' '}
        Mit dem Einreichen hast du dein Material unter{' '}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/deed.de"
          className="text-brand underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >
          CC BY-SA 4.0
        </a>{' '}
        freigegeben. Danke fürs Mitmachen!
      </aside>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          href="/einreichen"
          className="rounded-md border border-rule px-4 py-2 hover:bg-surface"
        >
          Weiteres einreichen
        </Link>
        <Link
          href="/"
          className="rounded-md bg-brand px-4 py-2 font-semibold text-white"
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build sanity-check**

```bash
pnpm build
```

Expected: grün, `/einreichen` und `/einreichen/danke` sind in der Route-Liste.

- [ ] **Step 4: Dev-Server-Smoketest (optional, falls Logo-500-Issue inzwischen gefixt ist)**

```bash
pnpm dev &
sleep 5
curl -s http://localhost:3000/einreichen | grep -i "Mitmachen"
curl -s http://localhost:3000/einreichen/danke | grep -i "Danke"
kill %1 2>/dev/null
```

Expected: beide grep-Treffer (Page rendert mit erwartetem Text).

- [ ] **Step 5: Lint + tests**

```bash
pnpm lint && pnpm test
```

Expected: 68/68 grün, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/(frontend)/einreichen/page.tsx' 'src/app/(frontend)/einreichen/danke/page.tsx'
git commit -m "$(cat <<'EOF'
feat(v1.3b): wire form into /einreichen + add danke page

Page reads searchParams for smart defaults (type, article),
fetches top 50 articles for select, renders SubmissionForm.
Danke page is static, link back + CC-BY-SA reminder.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: .env.example + README

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1:** `.env.example` ergänzen — **bestehende Werte nicht überschreiben**, nur Turnstile-Section appenden.

Edit `.env.example` und füge am Ende hinzu:

```
# --- Turnstile (Spam-Schutz für Submission-Formular) ---
# Cloudflare-Dashboard → Turnstile → Site Key + Secret Key
# Ohne Secret läuft Dev/CI im Bypass-Pfad (immer accept).
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

- [ ] **Step 2:** `README.md` Mail-Setup-Abschnitt erweitern um Turnstile-Hinweis (nach dem bestehenden Mail-Abschnitt einen kleinen Block):

```markdown
### Turnstile (Spam-Schutz Submission-Formular)

Das öffentliche Submission-Formular unter `/einreichen` verwendet [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) als Spam-Schutz. Setup: Cloudflare-Dashboard → Turnstile → Site erstellen → Site Key und Secret Key in die ENV-Vars `TURNSTILE_SITE_KEY` und `TURNSTILE_SECRET_KEY` legen.

Lokal ohne diese Vars läuft Turnstile im Bypass — das Formular akzeptiert jeden Submit. Production muss die Keys gesetzt haben.
```

- [ ] **Step 3:** Lint + tests + build

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: alles grün.

- [ ] **Step 4: Commit**

```bash
git add .env.example README.md
git commit -m "$(cat <<'EOF'
docs(v1.3b): document Turnstile setup in env.example and README

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Lokale Verifikation (Sync-Punkt)

**Voraussetzung:** Pre-Task A fertig (Turnstile-Site existiert, Keys in 1Password). Code-Tasks 1–9 committed.

- [ ] **Step 1:** Postgres + Dev-Server starten.

```bash
docker compose up -d
pnpm dev
```

- [ ] **Step 2:** Im Browser http://localhost:3000/einreichen öffnen → Form sollte gerendert sein (mit Bypass läuft Turnstile-Widget transparent).

- [ ] **Step 3:** Test-Submit mit allen Pflichtfeldern (`type=new_article`, `subject`, `body` ausgefüllt). Erwartetes Verhalten: Redirect auf `/einreichen/danke`, in der Server-Console kommt eine Konsolen-Email-Ausgabe (Bypass-Pfad ohne `RESEND_API_KEY`).

- [ ] **Step 4:** Im Payload-Admin (`/admin/collections/submissions`) prüfen: neuer Eintrag mit Status `pending` sichtbar.

- [ ] **Step 5:** Validation-Test: Form leeren, „Absenden" klicken → ErrorSummary oben + Inline-Errors pro Feld.

- [ ] **Step 6:** Smart-Default-Test: `http://localhost:3000/einreichen?type=correction&article=<existierender-slug>` → Form öffnet im Korrektur-Modus mit vorausgewähltem Artikel.

- [ ] **Step 7:** End-to-End mit echtem Turnstile + Mail (optional, falls Keys gesetzt):

```bash
RESEND_API_KEY=re_xxx \
RESEND_FROM_ADDRESS=noreply@pflegeatlas.org \
TURNSTILE_SITE_KEY=<key> \
TURNSTILE_SECRET_KEY=<secret> \
pnpm dev
```

Dann Form ausfüllen, Turnstile-Widget sichtbar lösen, Submit. Resend-Dashboard zeigt Send, Mail kommt bei Redaktion an.

**Kein Commit** — reine Verifikation.

---

## Task 11: PR + CI + Merge

- [ ] **Step 1:** Working tree clean check.

```bash
git status
git log --oneline main..HEAD
```

Expected: clean, ~10 V1.3b-Commits + Spec sichtbar.

- [ ] **Step 2:** Final lokal-Check.

```bash
pnpm test && pnpm lint && pnpm build
```

Expected: ~68/68 grün, 0 errors, build grün.

- [ ] **Step 3:** Push.

```bash
git push -u origin feat/v1-3b-submission-formular
```

- [ ] **Step 4:** PR erstellen.

```bash
gh pr create --title "V1.3b: Submission-Formular (Zod + Turnstile + Mail-Notification)" --body "$(cat <<'EOF'
## Summary

Ersetzt den /einreichen-Stub durch ein voll funktionsfähiges Submission-Formular.

- **Validation:** Zod-Schema in `src/lib/submission-schema.ts`, Cross-Field-Refine für correction
- **Spam-Schutz:** Cloudflare Turnstile mit Dev-Bypass wenn `TURNSTILE_SECRET_KEY` fehlt
- **Form-UX:** gov.uk-Pattern — ErrorSummary oben + Inline-Errors pro Feld, autofocus auf Summary
- **Mechanik:** React Server Action mit `useActionState`, `useFormStatus` für Submit-Disable, PRG-Redirect auf `/einreichen/danke`
- **Notification:** Submission-Mail an `redaktion@pflegeatlas.org` via V1.3a-Adapter, Worker forwarded an Oliver + Christoph
- **Smart-Defaults:** Query-Params `?type=correction&article=<slug>` setzen Form initial vor (für Artikel-Footer-Links seit V1.1)
- **a11y:** ErrorSummary mit autofocus, Anker-Links, role="alert"; `<noscript>`-Fallback mit mailto

## Spec + Plan

- Spec: `docs/superpowers/specs/2026-06-05-pflegeatlas-submission-form-v1-3b-design.md`
- Plan: `docs/superpowers/plans/2026-06-05-pflegeatlas-submission-form-v1-3b.md`

## Verification

- Tests: ~68/68 grün (36 Baseline + ~32 neu)
- Lint: 0 Errors
- Build: grün
- Manuell verifiziert: Form-Submit, Validation-Errors, Smart-Defaults, Redirect, Submission im Admin, Mail in Resend + Inbox

## Test plan

- [ ] CI grün warten
- [ ] /einreichen + /einreichen/danke manuell testen
- [ ] Korrektur-Flow von Artikel-Footer aus testen
- [ ] Submission im Admin sichtbar prüfen
- [ ] Mail an redaktion@ in Inbox prüfen

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

- [ ] **Step 8:** Memory-Update durch Claude (V1.3b fertig, Folge-Themen Auth/Editorial + V1.4-Hygiene).

---

## Self-Review

Spec-Coverage:

- Spec §1 (Zweck + Scope) → File-Structure + Tasks 1–11 decken alle „liefert"-Punkte; Out-of-Scope-Items werden in keinem Task touchiert.
- Spec §2 (Architektur) → Task 6 (Client), Task 7 (Server Action), V1.3a + Collection unverändert.
- Spec §3 (Felder + Schema) → Task 2 (Zod-Schema mit Cross-Field-Refine).
- Spec §4 (Form-Komponente) → Tasks 5 (ErrorSummary) + 6 (SubmissionForm).
- Spec §5 (Server Action) → Task 7.
- Spec §6 (Turnstile) → Tasks 4 (Helper) + 6 (Widget) + Pre-Task A + Task 9 (env).
- Spec §7 (Mail-Template) → Task 3.
- Spec §8 (Dank-Seite) → Task 8.
- Spec §9 (Smart-Defaults) → Task 8.
- Spec §10 (Tests) → Tasks 2/3/4/6/7 enthalten jeweils ihre Tests inline.
- Spec §11 (Repo-Änderungen) → File-Structure-Tabelle deckt alle Files.
- Spec §12 (Setup-Reihenfolge) → Pre-Task A + Tasks 1–11.
- Spec §13 (Verifikations-Kriterien) → Task 10 + Task 11 checken jeden Punkt.
- Spec §14 (Out-of-Scope) → Plan berührt keine Out-of-Scope-Items.

Placeholder-Scan: Keine TBDs, alle Tests haben vollen Code, alle Commands haben Expected-Output, alle Imports und Symbol-Namen sind konsistent (`SubmissionSchema`, `flattenZodErrors`, `buildSubmissionMail`, `verifyTurnstileToken`, `SubmissionForm`, `ErrorSummary`, `submitAction`, `SubmitState`).

Type-Consistency: `SubmitState` ist in Task 7 definiert und in Task 6 importiert — passt. `Article`-Typ in Page (Task 8) ist als anonymes `{ slug, title }` strukturell genannt, passt mit dem Test in Task 6.

Plan ist ready für Execution.
