import { ChevronLeft } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';

interface Props {
  title: string;
  /** Cuando se entrega, se muestra el botón de volver (detalle de una persona). */
  onBack?: () => void;
  /** Controles propios de la pantalla, a la izquierda del interruptor de tema. */
  acciones?: React.ReactNode;
}

export default function AppBar({ title, onBack, acciones }: Props) {
  return (
    <header
      className="sticky top-0 z-20 border-b border-hairline bg-canvas/90 backdrop-blur"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex h-11 w-full max-w-130 items-center gap-2 px-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-content transition-colors active:bg-subtle"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        <p
          className={`min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted ${
            onBack ? '' : 'pl-2'
          }`}
        >
          {title}
        </p>

        {acciones}

        <ThemeToggle />
      </div>
    </header>
  );
}
