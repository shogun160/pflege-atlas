import type { ReactNode } from 'react';

type SectionLabelProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

export function SectionLabel({ children, className = '', id }: SectionLabelProps) {
  return (
    <p
      id={id}
      className={`text-xs font-semibold uppercase tracking-[0.08em] text-accent ${className}`.trim()}
    >
      {children}
    </p>
  );
}
