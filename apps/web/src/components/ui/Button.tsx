import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
}

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-12 items-center justify-center rounded-lg px-5 font-display text-sm font-bold uppercase tracking-wide transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary' &&
          'bg-navy-700 text-white hover:-translate-y-0.5 hover:bg-navy-900 active:translate-y-0',
        variant === 'ghost' && 'text-navy-700 hover:bg-navy-50',
        className,
      )}
      {...props}
    />
  );
}
