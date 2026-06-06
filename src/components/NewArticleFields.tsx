'use client';

import type React from 'react';
import dynamic from 'next/dynamic';
import { emptyLexicalJson } from '@/components/LexicalEditor';

const LexicalEditor = dynamic(
  () => import('@/components/LexicalEditor').then((m) => m.LexicalEditor),
  {
    ssr: false,
    loading: () => <div className="text-ink-muted">Editor lädt…</div>,
  },
);

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

const SECTIONS: Array<{
  key: 'definition' | 'praxis' | 'risiken' | 'quellen';
  label: string;
  placeholder: string;
}> = [
  {
    key: 'definition',
    label: '1. Definition / Kurzantwort',
    placeholder: 'Worum geht es kurz? Was ist die zentrale Antwort?',
  },
  {
    key: 'praxis',
    label: '2. Praxis (inkl. Erfahrungswissen)',
    placeholder: 'Wie wird das in der täglichen Pflege konkret umgesetzt?',
  },
  {
    key: 'risiken',
    label: '3. Risiken & Fallstricke',
    placeholder: 'Wo passieren Fehler? Was ist gefährlich oder oft falsch?',
  },
  {
    key: 'quellen',
    label: '4. Quellen & Weiterführendes',
    placeholder: 'Leitlinien, Studien, vertiefende Links.',
  },
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
        <FieldHint id="hint-proposedSummary">{values.proposedSummary.length} / 280 Zeichen</FieldHint>
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
