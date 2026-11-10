import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmación para acciones destructivas, con el mismo lenguaje visual del admin. */
export default function ConfirmDialog({
  titulo,
  mensaje,
  textoConfirmar = 'Eliminar',
  onConfirm,
  onCancel,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrarRef.current?.focus();

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', alPresionar);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', alPresionar);
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCancel}
        className="absolute inset-0 bg-black/50"
      />

      <div className="relative w-full max-w-sm rounded-xl border border-hairline bg-surface p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-subtle text-danger-content">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-content">{titulo}</h2>
            <p className="mt-1 text-xs leading-relaxed text-content-muted">{mensaje}</p>
          </div>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-content-subtle transition-colors hover:bg-subtle hover:text-content"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn btn-sm btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            disabled={confirmando}
            onClick={() => {
              setConfirmando(true);
              onConfirm();
            }}
            className="btn btn-sm btn-danger"
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
