import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Sheet({ open, title, onClose, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onClose();
    };
    const overflowPrevio = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', alPresionar);

    return () => {
      document.body.style.overflow = overflowPrevio;
      document.removeEventListener('keydown', alPresionar);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="overlay-in absolute inset-0 bg-black/45"
      />

      <div className="sheet-panel relative w-full max-w-130 rounded-t-2xl border border-hairline bg-elevated shadow-2xl">
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-hairline-strong" />
        </div>

        <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-content-muted">{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="max-h-[72vh] overflow-y-auto px-4 pt-1"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
