import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Modal centrado con overlay (portal). Cierra con Escape o clic fuera. */
export function Modal({ open, title, subtitle, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/40 px-4 py-10 backdrop-blur-sm [animation:fade-in_0.15s_ease-out]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-navy-950/20 [animation:modal-pop_0.18s_cubic-bezier(0.16,1,0.3,1)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-paper px-6 py-4">
          <div>
            <h2 className="font-display text-base font-bold tracking-tight text-navy-900">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1.5 grid h-8 w-8 flex-none place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy-700"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
