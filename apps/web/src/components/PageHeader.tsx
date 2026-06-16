import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  crumb?: string;
  right?: ReactNode;
}

/** Barra superior con hairline, consistente con el dashboard (Swiss). */
export function PageHeader({ title, crumb, right }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-lg font-bold tracking-tight text-navy-900">{title}</h1>
        {crumb ? (
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-400">
            / {crumb}
          </span>
        ) : null}
      </div>
      {right}
    </header>
  );
}
