import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from 'lucide-react';

export interface ImagenLightbox {
  url: string;
  alt: string;
}

interface Props {
  imagenes: ImagenLightbox[];
  indice: number;
  titulo?: string;
  onClose: () => void;
  onIndiceChange: (indice: number) => void;
}

const SWIPE_MIN = 45;

export default function Lightbox({ imagenes, indice, titulo, onClose, onIndiceChange }: Props) {
  const [zoom, setZoom] = useState(false);
  const [anchoNatural, setAnchoNatural] = useState<number | null>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const inicioToque = useRef<{ x: number; y: number } | null>(null);
  // Un swipe no debe además disparar el zoom del click sobre la imagen.
  const ignoraClick = useRef(false);

  const total = imagenes.length;
  const actual = imagenes[indice];

  // Al ampliar, la imagen se muestra a tamaño 1:1 (nunca menos de 2x el ancho
  // de la pantalla) dentro de un contenedor con scroll: así el zoom es nítido
  // y se puede recorrer con el dedo.
  const anchoZoom = Math.max(anchoNatural ?? 0, Math.round(window.innerWidth * 2));

  const anterior = useCallback(() => {
    if (total < 2) return;
    setZoom(false);
    setAnchoNatural(null);
    onIndiceChange((indice - 1 + total) % total);
  }, [indice, onIndiceChange, total]);

  const siguiente = useCallback(() => {
    if (total < 2) return;
    setZoom(false);
    setAnchoNatural(null);
    onIndiceChange((indice + 1) % total);
  }, [indice, onIndiceChange, total]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    botonCerrar.current?.focus();

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onClose();
      if (evento.key === 'ArrowLeft') anterior();
      if (evento.key === 'ArrowRight') siguiente();
    };

    document.addEventListener('keydown', alPresionar);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', alPresionar);
    };
  }, [anterior, siguiente, onClose]);

  const alTocarInicio = (evento: React.PointerEvent) => {
    if (zoom) return;
    inicioToque.current = { x: evento.clientX, y: evento.clientY };
  };

  const alTocarFin = (evento: React.PointerEvent) => {
    const inicio = inicioToque.current;
    inicioToque.current = null;
    if (!inicio || zoom) return;

    const dx = evento.clientX - inicio.x;
    const dy = evento.clientY - inicio.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy)) return;

    ignoraClick.current = true;
    window.setTimeout(() => {
      ignoraClick.current = false;
    }, 250);

    if (dx < 0) siguiente();
    else anterior();
  };

  if (!actual) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Referencia ampliada">
      <div
        className="flex items-center justify-between gap-3 px-3 py-2 text-white"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
      >
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium">{titulo || 'Referencia'}</p>
          {total > 1 && (
            <p className="text-[11px] text-white/60">
              {indice + 1} de {total}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 active:bg-white/20"
            onClick={() => setZoom((valor) => !valor)}
            aria-label={zoom ? 'Ajustar a la pantalla' : 'Ampliar imagen'}
          >
            {zoom ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
          <button
            ref={botonCerrar}
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 active:bg-white/20"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className={`relative flex-1 ${zoom ? 'overflow-auto' : 'overflow-hidden'}`}
        onPointerDown={alTocarInicio}
        onPointerUp={alTocarFin}
      >
        <div
          className={`flex min-h-full items-center justify-center ${zoom ? 'w-max min-w-full p-2' : 'p-2'}`}
        >
          <img
            src={actual.url}
            alt={actual.alt}
            onClick={() => {
              if (ignoraClick.current || zoom) return;
              setZoom(true);
            }}
            onLoad={(evento) => setAnchoNatural(evento.currentTarget.naturalWidth || null)}
            className={`select-none rounded-lg object-contain ${
              zoom ? 'h-auto w-auto max-w-none' : 'max-h-full max-w-full cursor-zoom-in'
            }`}
            style={zoom ? { width: `${anchoZoom}px`, maxWidth: 'none' } : undefined}
            draggable={false}
          />
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={anterior}
              aria-label="Imagen anterior"
              className="absolute left-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/65"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={siguiente}
              aria-label="Imagen siguiente"
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/65"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      <p
        className="px-4 pt-2 text-center text-[10px] leading-relaxed text-white/50"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {zoom ? 'Arrastra para mover la imagen · toca para ajustar' : 'Toca la imagen para ampliar'}
      </p>
    </div>
  );
}
