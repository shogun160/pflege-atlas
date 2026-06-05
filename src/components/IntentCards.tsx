type Intent = {
  href: string;
  title: string;
  subtitle: string;
  accent: string;
  paid?: boolean;
};

const INTENTS: Intent[] = [
  {
    href: '/intent/bedside',
    title: '…schnelle Hilfe am Bett',
    subtitle: 'Pflegetechniken, Notfälle, Checklisten',
    accent: 'border-brand',
  },
  {
    href: '/intent/background',
    title: '…Hintergrundwissen',
    subtitle: 'Krankheitsbilder, Erklärungen, Pflegeprozess',
    accent: 'border-brand',
  },
  {
    href: '/intent/learning',
    title: '…etwas zum Lernen',
    subtitle: 'Ausbildungsthemen, Quizze',
    accent: 'border-brand',
  },
  {
    href: '/qm',
    title: '…QM- & Pflegedienst-Tools 🔒',
    subtitle: 'Vorlagen, SIS, Audit-Hilfen (für Pflegedienste, kostenpflichtig)',
    accent: 'border-ink-muted',
    paid: true,
  },
];

export function IntentCards() {
  return (
    <section aria-label="Ich brauche…" className="mx-auto max-w-3xl">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-accent">
        Ich brauche…
      </p>
      <ul className="grid gap-3">
        {INTENTS.map((intent) => (
          <li key={intent.href}>
            <a
              href={intent.href}
              className={`block rounded border-l-[3px] bg-surface p-4 transition-colors hover:bg-rule/30 ${intent.accent}`}
            >
              <div className="text-base font-medium text-ink">{intent.title}</div>
              <div className="mt-1 text-sm text-ink-muted">{intent.subtitle}</div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
