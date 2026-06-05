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
  const [turnstileToken, setTurnstileToken] = useState('');

  return (
    <>
      {/* dangerouslySetInnerHTML keeps noscript innerHTML visible in jsdom tests */}
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
          <Turnstile
            siteKey={turnstileSiteKey}
            onSuccess={(token) => setTurnstileToken(token)}
            options={{ size: 'normal' }}
          />
          <input type="hidden" name="turnstileToken" id="field-turnstileToken" value={turnstileToken} readOnly />
        </div>

        <SubmitButton />
      </form>
    </>
  );
}
