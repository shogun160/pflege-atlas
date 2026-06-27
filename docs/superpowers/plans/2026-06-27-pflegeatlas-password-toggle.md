# PflegeAtlas Password-Show-Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementiere eine self-contained `<PasswordInput>`-React-Komponente mit Show/Hide-Toggle, ersetze damit die drei `<input type="password">` in LoginForm und SetPasswordForm.

**Architecture:** Eine neue Client-Komponente `src/components/PasswordInput.tsx` mit lokalem React-State, Inline-SVG-Icons (Heroicons "eye" + "eye-slash" pattern, kein Library-Install), `aria-pressed` + dynamisches `aria-label` für Screen-Reader. Drop-in für `<input type="password">` über `Omit<InputHTMLAttributes, 'type'>`. Caller (LoginForm, SetPasswordForm) ersetzen ihr Input-Element 1:1.

**Tech Stack:** React 19 Client-Components, Tailwind v4, Vitest 4 + @testing-library/react für Tests.

**Spec:** `docs/superpowers/specs/2026-06-27-pflegeatlas-password-toggle-design.md`

**Branch:** `feat/password-toggle` (bereits angelegt, Spec auf `f54136f` committed)

---

## File Map

| Datei | Verantwortung |
|---|---|
| `src/components/PasswordInput.tsx` | **NEU** — Drop-in-Replacement für `<input type="password">` mit lokalem Show/Hide-Toggle |
| `tests/component/PasswordInput.test.tsx` | **NEU** — 5 Component-Tests für PasswordInput |
| `src/components/LoginForm.tsx` (Z. 49–56) | `<input type="password" …>` → `<PasswordInput …>` |
| `src/components/SetPasswordForm.tsx` (Z. 41–49 + 55–63) | Beide `<input type="password" …>` → `<PasswordInput …>` |

Kein Touch in `loginFormAction`, `setPasswordFormAction`, Auth-Backend.

---

## Task 1: PasswordInput Komponente + Tests (TDD)

**Files:**
- Create: `tests/component/PasswordInput.test.tsx`
- Create: `src/components/PasswordInput.tsx`

- [ ] **Step 1: Schreibe failing tests**

Erstelle `tests/component/PasswordInput.test.tsx` mit:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '@/components/PasswordInput';

describe('PasswordInput', () => {
  it('renders type="password" by default with show-label', () => {
    render(<PasswordInput aria-label="Passwort" />);
    const input = screen.getByLabelText(/passwort/i, { selector: 'input' });
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: /passwort anzeigen/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles to type="text" when toggle is clicked', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Passwort" />);
    const toggle = screen.getByRole('button', { name: /passwort anzeigen/i });
    await user.click(toggle);
    const input = screen.getByLabelText(/passwort/i, { selector: 'input' });
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /passwort verbergen/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('toggles back to type="password" on second click', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Passwort" />);
    const toggle = screen.getByRole('button', { name: /passwort anzeigen/i });
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: /passwort verbergen/i }));
    const input = screen.getByLabelText(/passwort/i, { selector: 'input' });
    expect(input).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: /passwort anzeigen/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('passes input props through (id, name, required, autoComplete, defaultValue)', () => {
    render(
      <PasswordInput
        id="password-test"
        name="password"
        required
        autoComplete="new-password"
        defaultValue="initial-value"
      />,
    );
    const input = document.getElementById('password-test') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('name', 'password');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('autoComplete', 'new-password');
    expect(input).toHaveValue('initial-value');
  });

  it('keeps independent state across multiple instances', async () => {
    const user = userEvent.setup();
    render(
      <>
        <PasswordInput id="pw-1" aria-label="Passwort 1" />
        <PasswordInput id="pw-2" aria-label="Passwort 2" />
      </>,
    );
    const toggles = screen.getAllByRole('button', { name: /passwort anzeigen/i });
    expect(toggles).toHaveLength(2);
    await user.click(toggles[0]);
    // Now toggle-1 says "verbergen", toggle-2 still says "anzeigen"
    expect(screen.getAllByRole('button', { name: /passwort anzeigen/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /passwort verbergen/i })).toHaveLength(1);
    const input1 = document.getElementById('pw-1') as HTMLInputElement;
    const input2 = document.getElementById('pw-2') as HTMLInputElement;
    expect(input1.type).toBe('text');
    expect(input2.type).toBe('password');
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `pnpm exec vitest run tests/component/PasswordInput.test.tsx`
Expected: 5 failures — `Cannot find module '@/components/PasswordInput'` (component doesn't exist yet).

- [ ] **Step 3: Implementiere PasswordInput**

Erstelle `src/components/PasswordInput.tsx`:

```tsx
'use client';

import { useState, type InputHTMLAttributes } from 'react';

// Heroicons "eye" und "eye-slash" inline, kein Library-Install
function EyeIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function EyeSlashIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        {...props}
        className={props.className ?? 'w-full rounded border border-rule px-3 py-2 pr-10'}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-500 hover:text-stone-700"
      >
        {visible ? <EyeSlashIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `pnpm exec vitest run tests/component/PasswordInput.test.tsx`
Expected: 5 passing.

- [ ] **Step 5: Lint + tsc**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean (kein neuer Error im neuen Component).

- [ ] **Step 6: Commit**

```bash
git add src/components/PasswordInput.tsx tests/component/PasswordInput.test.tsx
git commit -m "feat(ui): PasswordInput component with show/hide toggle"
```

---

## Task 2: Migrate LoginForm

**Files:**
- Modify: `src/components/LoginForm.tsx` (Z. 49–56)
- Coverage: `tests/component/LoginForm.test.tsx` (existing 4 tests müssen weiter grün bleiben)

- [ ] **Step 1: Baseline — bestehende LoginForm-Tests laufen lassen**

Run: `pnpm exec vitest run tests/component/LoginForm.test.tsx`
Expected: alle grün.

- [ ] **Step 2: Migrate LoginForm**

Ersetze in `src/components/LoginForm.tsx` Z. 49–56 (der gesamte `<input type="password" …>`-Block) durch:

```tsx
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
        />
```

Und füge oben in der Datei den Import hinzu (nach den bestehenden Imports, vor der `SubmitButton`-Definition):

```tsx
import { PasswordInput } from '@/components/PasswordInput';
```

Komplette neue Datei für Klarheit:

```tsx
'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginFormAction, type LoginFormState } from '@/app/(frontend)/login/actions';
import { PasswordInput } from '@/components/PasswordInput';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand px-6 py-2 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Anmelden …' : 'Anmelden'}
    </button>
  );
}

export function LoginForm({
  initialState = {},
  next = '',
}: {
  initialState?: LoginFormState;
  next?: string;
}) {
  const [state, formAction] = useActionState(loginFormAction, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          E-Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={state.email ?? ''}
          autoComplete="email"
          className="w-full rounded border border-rule px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Passwort
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
        />
      </div>
      {state.error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}
      <SubmitButton />
      <p className="text-sm">
        <a href="/passwort-vergessen" className="text-brand underline">
          Passwort vergessen?
        </a>
      </p>
    </form>
  );
}
```

- [ ] **Step 3: Run LoginForm tests + PasswordInput tests**

Run: `pnpm exec vitest run tests/component/LoginForm.test.tsx tests/component/PasswordInput.test.tsx`
Expected: alle grün. LoginForm-Test `'renders email + password fields + submit + forgot-link'` (Z. 14–24) nutzt `getByLabelText(/passwort/i)` — der Label-Bezug zu `id="password"` bleibt, also funktioniert der Selector weiterhin.

- [ ] **Step 4: Lint + tsc**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/LoginForm.tsx
git commit -m "feat(ui): use PasswordInput in LoginForm"
```

---

## Task 3: Migrate SetPasswordForm (beide Inputs)

**Files:**
- Modify: `src/components/SetPasswordForm.tsx` (Z. 41–49 + 55–63)
- Coverage: keine eigenständigen Component-Tests für die beiden Inputs — Form-Tests fokussieren auf Submit-Flow, nicht auf Input-Type

- [ ] **Step 1: Baseline — bestehende SetPasswordForm-Tests laufen lassen**

Run: `pnpm exec vitest run tests/component/SetPasswordForm.test.tsx`
Expected: alle grün.

- [ ] **Step 2: Migrate SetPasswordForm**

Ersetze in `src/components/SetPasswordForm.tsx`:

- Z. 41–49 (erster Password-Input, `id="password"`) durch:

```tsx
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
```

- Z. 55–63 (zweiter Password-Input, `id="passwordRepeat"`) durch:

```tsx
        <PasswordInput
          id="passwordRepeat"
          name="passwordRepeat"
          required
          minLength={8}
          autoComplete="new-password"
        />
```

Import oben hinzufügen:

```tsx
import { PasswordInput } from '@/components/PasswordInput';
```

Komplette neue Datei für Klarheit:

```tsx
'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  setPasswordFormAction,
  type SetPasswordFormState,
} from '@/app/(frontend)/passwort-setzen/actions';
import { PasswordInput } from '@/components/PasswordInput';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brand px-6 py-2 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Wird gespeichert …' : 'Passwort setzen'}
    </button>
  );
}

export function SetPasswordForm({
  token,
  mode,
  initialState = {},
}: {
  token: string;
  mode: 'invitation' | 'reset';
  initialState?: SetPasswordFormState;
}) {
  const [state, formAction] = useActionState(setPasswordFormAction, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="mode" value={mode} />
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Neues Passwort (min. 8 Zeichen)
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label htmlFor="passwordRepeat" className="mb-1 block text-sm font-medium">
          Passwort wiederholen
        </label>
        <PasswordInput
          id="passwordRepeat"
          name="passwordRepeat"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {mode === 'invitation' && (
        <label htmlFor="dsgvo" className="flex items-start gap-2 text-sm">
          <input
            id="dsgvo"
            name="dsgvo"
            type="checkbox"
            required
            className="mt-1"
          />
          <span>
            Ich habe die{' '}
            <a href="/datenschutz" target="_blank" className="text-brand underline">
              Datenschutz
            </a>
            -Hinweise gelesen und stimme der Speicherung von E-Mail und
            Anzeigename zu.
          </span>
        </label>
      )}
      {state.error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 3: Run SetPasswordForm tests + PasswordInput tests**

Run: `pnpm exec vitest run tests/component/SetPasswordForm.test.tsx tests/component/PasswordInput.test.tsx tests/component/LoginForm.test.tsx`
Expected: alle grün.

- [ ] **Step 4: Lint + tsc**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/SetPasswordForm.tsx
git commit -m "feat(ui): use PasswordInput in SetPasswordForm (both fields)"
```

---

## Task 4: Full-Suite Verification

**Files:** (keine Code-Changes, nur Verifikation)

- [ ] **Step 1: Komplette Test-Suite**

Run: `pnpm test`
Expected: alle grün, +5 Tests vs. Baseline (PasswordInput hat 5 neue Tests; bestehende Form-Tests unverändert in der Anzahl). Vorher 425 → Erwartung **430**.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: 0 Errors (pre-existing Warnings sind OK, kein neuer Warning aus den drei berührten Files).

- [ ] **Step 3: Type-Check**

Run: `pnpm exec tsc --noEmit`
Expected: 0 Errors.

- [ ] **Step 4: Branch-Status prüfen**

Run: `git log feat/password-toggle ^main --oneline`
Expected: 4 Commits (Spec + Task 1 + Task 2 + Task 3). Task 4 macht keinen Commit.

- [ ] **Step 5: Manual Smoke (optional, falls Dev-Server läuft)**

```bash
# In separater Shell, falls Dev-DB läuft:
pnpm dev
# Browser → http://localhost:3000/anmelden → Eye-Icon klicken → Passwort sichtbar/verborgen
# Browser → http://localhost:3000/passwort-setzen?token=… (irgendein Token) → beide Inputs testen
```

Visual-Check: Icon-Position rechts im Input, hover ändert Farbe von stone-500 zu stone-700, Klick toggelt sichtbar.

- [ ] **Step 6: Fertig — kein weiterer Commit. Branch ist bereit für PR.**

---

## Notes

- **Sub-C2-Lesson „Plan auf Feature-Branch":** Branch `feat/password-toggle` ist bereits aktiv, Spec committed. Plan-Commit folgt aus diesem Skill.
- **Sub-C3-Lesson „Subagent-Driven mit per-Task-Code-Review":** Plan ist explizit so dimensioniert, dass jeder Task von einem Implementer-Subagent + Review-Subagent allein ausgeführt werden kann. Für ein so kleines Feature ist Inline-Execution aber auch angemessen — Wahl beim Execution-Handoff.
- **Behaviour-Test-Idiomatik:** `getByRole('button', { name: /…/i })` für Toggle-Selection, `document.getElementById(...)` für Inputs ohne assoziiertes Label im Test (statt `getByLabelText`, weil PasswordInput selbst kein Label hat — es ist nur ein Input + Toggle). Konsistent mit `AccountActions`-Test-Pattern.
- **Keine Migration nötig** — purely UI, kein DB, keine Server-Action-Change, keine Form-Submit-Semantik geändert.
