import { SectionLabel } from './SectionLabel';

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
    accent: 'border-rose-500 bg-rose-50 hover:bg-rose-100',
  },
  {
    href: '/intent/background',
    title: '…Hintergrundwissen',
    subtitle: 'Krankheitsbilder, Erklärungen, Pflegeprozess',
    accent: 'border-emerald-600 bg-emerald-50 hover:bg-emerald-100',
  },
  {
    href: '/intent/learning',
    title: '…etwas zum Lernen',
    subtitle: 'Ausbildungsthemen, Quizze',
    accent: 'border-amber-500 bg-amber-50 hover:bg-amber-100',
  },
  {
    href: '/qm',
    title: '…QM- & Pflegedienst-Tools 🔒',
    subtitle: 'Vorlagen, SIS, Audit-Hilfen (für Pflegedienste, kostenpflichtig)',
    accent: 'border-indigo-500 bg-indigo-50 hover:bg-indigo-100',
    paid: true,
  },
];

export function IntentCards() {
  return (
    <section aria-label="Ich brauche…" className="mx-auto max-w-3xl">
      <SectionLabel className="mb-4">Ich brauche…</SectionLabel>
      <ul className="grid gap-3">
        {INTENTS.map((intent) => (
          <li key={intent.href}>
            <a
              href={intent.href}
              className={`block rounded-lg border p-4 transition-colors ${intent.accent}`}
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
