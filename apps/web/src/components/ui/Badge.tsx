import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'success' | 'neutral' | 'navy';

const TONES: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  neutral: 'bg-slate-100 text-slate-500 ring-slate-400/25',
  navy: 'bg-navy-50 text-navy-700 ring-navy-700/15',
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
}

/** Etiqueta de estado compacta, en mono (Swiss). */
export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[0.62rem] font-medium uppercase tracking-wide ring-1 ring-inset',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
