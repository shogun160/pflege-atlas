# PflegeAtlas Password-Show-Toggle — Design

**Datum:** 2026-06-27
**Status:** Spec
**Scope:** V1.6.1-UI-Polish Item — Password-Show-Toggle für alle Auth-Formulare
**Branch:** `feat/password-toggle`

## Kontext

V1.6.1-Backlog-Item: „Password-Show-Toggle-Bug im Login-Form". Code-Inspektion zeigt: kein Toggle ist implementiert. Drei Password-Inputs existieren (LoginForm × 1, SetPasswordForm × 2) ohne Show/Hide-Funktionalität.

Scope-Entscheidung (Brainstorm 2026-06-27): Toggle in **allen drei Inputs**, nicht nur LoginForm. UX-Konsistenz, geringer Mehraufwand. Setup-Form (SetPasswordForm) ist genau der Moment, wo der User „sehen was ich tippe" am stärksten wünscht (Passwort vs. Wiederholung vergleichen).

## Ziele

1. Self-contained `<PasswordInput>`-Komponente, drop-in-Replacement für `<input type="password">`
2. Drei Caller anpassen (LoginForm, SetPasswordForm × 2 Inputs)
3. Vollständige Tastatur- und Screen-Reader-Accessibility
4. Keine neuen Dependencies (Inline-SVG für Icons)
5. Form-Submit-Verhalten unverändert (kein Caller-Code für FormData-Handling nötig)

## Non-Goals

- Auto-Hide nach Zeit-Delay (Security-Theater bei modernen Browsern, fügt nur Reibung hinzu)
- Toggle-Persistierung über Page-Loads
- Caps-Lock-Warnung (separater Polish-Track)
- Password-Strength-Meter (separater Polish-Track)
- Eingriff in `loginFormAction` / `setPasswordFormAction` (Form-Actions unverändert)

## Architektur

**Neue Datei:** `src/components/PasswordInput.tsx` (Client-Component, ~45 Zeilen).

```tsx
'use client';
import { useState, type InputHTMLAttributes } from 'react';

// Heroicons "eye" + "eye-slash" inline, kein Library-Install
const EyeIcon = () => (/* … */);
const EyeSlashIcon = () => (/* … */);

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

**Eigenschaften:**

- **Type-Sicher:** `Omit<InputHTMLAttributes, 'type'>` verbietet `type`-Override beim Caller (sonst Bypass des Sinns).
- **State-Lokalität:** Jede `<PasswordInput>`-Instanz hat eigenen Visibility-State. SetPasswordForm: zwei unabhängige Toggles (gewollt — User kann nur Wiederholung sichtbar machen, um zu vergleichen).
- **Default-Styling überschreibbar:** `props.className` gewinnt, Default als Fallback (konsistent mit bestehenden Inputs).
- **Sichtbar-Default:** `false` (password). Browser-Autofill bleibt verborgen bis User explizit klickt.

## Touch-Map

| Datei | Änderung |
|---|---|
| `src/components/PasswordInput.tsx` | **NEU** — Component-Implementierung |
| `src/components/LoginForm.tsx` (Z. 49–56) | `<input type="password" …>` → `<PasswordInput …>` |
| `src/components/SetPasswordForm.tsx` (Z. 41–49, 55–63) | Beide Password-Inputs → `<PasswordInput>` |
| `tests/component/PasswordInput.test.tsx` | **NEU** — Komponenten-Tests |

Wrapping `<div>` mit `<label>` und `htmlFor` bleibt unverändert pro Caller. Nur das innere `<input>` wird ersetzt.

## Accessibility

- `aria-label` deutsch, dynamisch je nach State (`Passwort anzeigen` ↔ `Passwort verbergen`)
- `aria-pressed={visible}` macht Toggle-State maschinenlesbar (Screen-Reader sagt „Knopf, eingedrückt/nicht eingedrückt")
- `aria-hidden` auf SVGs (Icons sind dekorativ, Label trägt Bedeutung)
- Tab-Reihenfolge: Input → Toggle-Button → nächstes Feld (DOM-Order, kein `tabindex`-Eingriff)
- Toggle ist `<button type="button">` → keine Form-Submission bei Klick

## Tests

`tests/component/PasswordInput.test.tsx` (neu, ~50 Z.):

1. **Default-Render** — `<input>` hat `type="password"`, Button-Label „Passwort anzeigen", `aria-pressed="false"`.
2. **Toggle ON** — Klick auf Button → `<input>` hat `type="text"`, Label „Passwort verbergen", `aria-pressed="true"`.
3. **Toggle OFF** — Zweiter Klick → wieder `type="password"`, Label und aria-pressed zurück.
4. **Pass-Through-Props** — `id`, `name`, `required`, `autoComplete`, `defaultValue` werden ans `<input>` propagiert.
5. **Unabhängige Instances** — Zwei PasswordInputs in einer Page haben unabhängige States.

Idiomatik wie bestehende Component-Tests (vitest + @testing-library/react, kein Mock).

**Bestehende Component-Tests** für `LoginForm` und `SetPasswordForm` müssen weiter grün bleiben. Wenn sie aktuell explizit `type="password"` asserten, muss der Selector evtl. via `getByLabelText('Passwort')` statt `getByRole('textbox')` adjustiert werden — Test-Adjustment, nicht Regression.

## Behavior-Edge-Cases

- **Form-Submit bei `type="text"`:** unverändert. `name`-Attribute bleibt, FormData enthält den Wert, Server-Action bekommt das Password normal. Browser behandelt Submit identisch.
- **Password-Manager-Detection:** `autoComplete="current-password"` / `"new-password"` via Props durchgereicht. Browser-Heuristik bleibt funktional.
- **Browser-Autofill bei `type="text"`-Wechsel:** Initial-State ist `password` → Autofill triggert wie üblich. Wechsel auf `text` durch User-Click beeinflusst Autofill-Heuristik nicht (Browser-Implementierung-spezifisch, kein Code-Eingriff).
- **Mobile-Tastatur:** `type="password"` deaktiviert Auto-Correct / Suggestions; `type="text"` aktiviert sie. Akzeptiert — User-bewusste Sichtbar-Schaltung.

## Risiken

| Risiko | Wahrscheinlichkeit | Mitigation |
|---|---|---|
| Tailwind-Klassen-Mismatch zu bestehenden Inputs | niedrig | Default-className spiegelt bestehendes Input-Styling 1:1 |
| Component-Test-Breakage in LoginForm/SetPasswordForm | niedrig | Selector-Adjustment falls nötig, in selber Phase |
| Accessibility-Regression | niedrig | aria-label + aria-pressed explizit, manueller Screenreader-Smoke vor Merge |
| Browser-Autofill-Interaktion | sehr niedrig | type-Switch ist standard-Pattern; weit verbreitet bei Login-Forms im Web |

## Out-of-Scope (für nächste Iterationen)

- Caps-Lock-Warnung
- Password-Strength-Meter im SetPasswordForm
- Auto-Hide-after-Delay
- Shared-Button-Toggle für beide Password-Felder im SetPasswordForm (aktuell unabhängig, Brainstorm-Entscheidung)

## Referenzen

- Brainstorm-Session: 2026-06-27 (diese Session)
- V1.6.1-Backlog-Quelle: Projekt-Memory + Sub-C-Track-Lessons
- Bestehende Forms: `src/components/LoginForm.tsx`, `src/components/SetPasswordForm.tsx`
