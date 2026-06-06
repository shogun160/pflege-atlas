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
  // When no site key is set (local dev), the Turnstile widget never mounts.
  // Pre-fill a dev-bypass token so the server-side verifier (which also has a
  // dev-bypass path when TURNSTILE_SECRET_KEY is missing) accepts the submit.
  const turnstileEnabled = turnstileSiteKey.length > 0;
  const [turnstileToken, setTurnstileToken] = useState(turnstileEnabled ? '' : 'dev-bypass');

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
        {state.fieldErrors && <ErrorSummary errors={state.fieldErrors} fieldLabels={FIELD_LABELS} />}

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
          {turnstileEnabled ? (
            <Turnstile
              siteKey={turnstileSiteKey}
              onSuccess={(token) => setTurnstileToken(token)}
              options={{ size: 'normal' }}
            />
          ) : (
            <p className="text-sm text-ink-muted">
              Captcha im Dev-Modus übersprungen (TURNSTILE_SITE_KEY nicht gesetzt).
            </p>
          )}
          <input type="hidden" name="turnstileToken" value={turnstileToken} readOnly />
        </div>

        <SubmitButton />
      </form>
    </>
  );
}
