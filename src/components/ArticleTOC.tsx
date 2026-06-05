'use client';

import { useState } from 'react';

type Section = { id: string; label: string };

type Props = {
  sections: Section[];
  related?: { slug: string; title: string }[];
  reviewedAt?: string;
  reviewerName?: string;
};

export function ArticleTOC({ sections, related = [], reviewedAt, reviewerName }: Props) {
  const [open, setOpen] = useState(false);

  const inner = (
    <>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-accent">
        Auf dieser Seite
      </p>
      <ul className="mb-6 space-y-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="text-sm text-ink hover:text-brand">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
      {related.length > 0 && (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-accent">
            Verwandt
          </p>
          <ul className="mb-6 space-y-1">
            {related.map((r) => (
              <li key={r.slug}>
                <a
                  href={`/artikel/${r.slug}`}
                  className="text-sm text-ink-muted hover:text-brand"
                >
                  {r.title}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {reviewedAt && (
        <div className="text-xs text-ink-muted">
          <p className="font-semibold uppercase tracking-[0.08em] text-accent">Geprüft</p>
          <p>
            {reviewedAt}
            {reviewerName ? ` · ${reviewerName}` : ''}
          </p>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile: collapsible */}
      <div className="md:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-brand px-4 py-3 text-brand"
        >
          <span className="font-semibold">Inhalt &amp; Verwandtes</span>
          <span aria-hidden>{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <div className="mt-3 rounded-lg border border-rule bg-surface p-4">
            {inner}
          </div>
        )}
      </div>

      {/* Desktop: sticky sidebar */}
      <aside className="hidden md:block md:sticky md:top-6">{inner}</aside>
    </>
  );
}
