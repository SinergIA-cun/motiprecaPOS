import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-12 w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-4 text-[0.98rem] outline-none transition-all duration-150',
          'focus:border-navy-700 focus:ring-4 focus:ring-navy-700/12',
          'aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-400/15',
          className,
        )}
        {...props}
      />
    );
  },
);
