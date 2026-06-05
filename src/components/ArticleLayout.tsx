import type { ReactNode } from 'react';

type Props = {
  toc: ReactNode;
  children: ReactNode;
};

export function ArticleLayout({ toc, children }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        <div>{toc}</div>
        <article className="prose prose-gray max-w-none">{children}</article>
      </div>
    </div>
  );
}
