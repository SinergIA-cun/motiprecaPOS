import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

// Chevron navy embebido para reemplazar la flecha nativa del select.
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231a3a8c' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, style, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'h-12 w-full cursor-pointer appearance-none rounded-lg border-[1.5px] border-slate-200 bg-white bg-[length:1em] bg-[right_0.9rem_center] bg-no-repeat px-4 pr-10 text-[0.98rem] outline-none transition-all duration-150',
          'focus:border-navy-700 focus:ring-4 focus:ring-navy-700/12',
          'aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-400/15',
          className,
        )}
        style={{ backgroundImage: CHEVRON, ...style }}
        {...props}
      />
    );
  },
);
