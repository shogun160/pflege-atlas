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
    accent: 'border-blue-500',
  },
  {
    href: '/intent/background',
    title: '…Hintergrundwissen',
    subtitle: 'Krankheitsbilder, Erklärungen, Pflegeprozess',
    accent: 'border-emerald-500',
  },
  {
    href: '/intent/learning',
    title: '…etwas zum Lernen',
    subtitle: 'Ausbildungsthemen, Quizze',
    accent: 'border-amber-500',
  },
  {
    href: '/qm',
    title: '…QM- & Pflegedienst-Tools 🔒',
    subtitle: 'Vorlagen, SIS, Audit-Hilfen (für Pflegedienste, kostenpflichtig)',
    accent: 'border-violet-500',
    paid: true,
  },
];

export function IntentCards() {
  return (
    <section aria-label="Ich brauche…" className="mx-auto max-w-3xl">
      <p className="mb-4 text-sm uppercase tracking-wider text-gray-500">
        Ich brauche…
      </p>
      <ul className="grid gap-3">
        {INTENTS.map((intent) => (
          <li key={intent.href}>
            <a
              href={intent.href}
              className={`block rounded border-l-4 bg-gray-50 p-4 hover:bg-gray-100 ${intent.accent}`}
            >
              <div className="font-semibold text-gray-900">{intent.title}</div>
              <div className="mt-1 text-sm text-gray-600">{intent.subtitle}</div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
