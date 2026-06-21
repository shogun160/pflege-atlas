const STATUS_LABEL: Record<string, string> = {
  pending: 'Eingegangen',
  in_review: 'In Review',
  accepted: 'Übernommen',
  rejected: 'Abgelehnt',
};

export function MeineBeitraegeCard({
  submissions,
}: {
  submissions: Array<{
    id: number;
    displayTitle?: string;
    type?: string;
    reviewStatus?: string;
    createdAt?: string;
  }>;
}) {
  if (submissions.length === 0) {
    return (
      <section className="rounded-lg border border-rule bg-white p-6 shadow-sm">
        <h2 className="mb-2 font-serif text-xl">Meine Beiträge</h2>
        <p className="text-stone-600">
          Du hast noch keine Beiträge eingereicht.{' '}
          <a href="/einreichen" className="text-brand underline">
            Jetzt einreichen
          </a>
          .
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-rule bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-serif text-xl">Meine Beiträge</h2>
      <ul className="space-y-3">
        {submissions.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between border-b border-rule pb-2"
          >
            <div>
              <div className="font-medium">{s.displayTitle ?? 'Unbenannt'}</div>
              <div className="text-sm text-stone-600">
                {s.type === 'new_article' ? 'Neuer Artikel' : 'Korrektur'} ·{' '}
                {s.createdAt
                  ? new Date(s.createdAt).toLocaleDateString('de-DE')
                  : '–'}
              </div>
            </div>
            <span className="rounded bg-stone-100 px-2 py-1 text-sm font-medium">
              {STATUS_LABEL[s.reviewStatus ?? 'pending'] ?? s.reviewStatus}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
