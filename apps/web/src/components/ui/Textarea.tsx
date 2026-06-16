import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border-[1.5px] border-slate-200 bg-white px-4 py-3 text-[0.98rem] outline-none transition-all duration-150',
        'focus:border-navy-700 focus:ring-4 focus:ring-navy-700/12',
        className,
      )}
      {...props}
    />
  );
});
