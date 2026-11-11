import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Film,
  Grid3X3,
  LayoutGrid,
  MonitorPlay,
  X,
} from 'lucide-react';
import type { LayoutPDF, StoryboardPanel, StoryboardSummary } from './types';

interface Props {
  storyboardName: string;
  panels: StoryboardPanel[];
  locutions: string[];
  storyboards?: StoryboardSummary[];
  activeStoryboardId?: number | null;
  projectColors?: { color_cliente: string; color_campana: string };
  onSwitchStoryboard?: (storyboard: Pick<StoryboardSummary, 'id' | 'name'>) => void;
  onClose: () => void;
}

const LAYOUTS: { modo: LayoutPDF; etiqueta: string; Icono: typeof MonitorPlay }[] = [
  { modo: 1, etiqueta: '1 x página', Icono: MonitorPlay },
  { modo: 4, etiqueta: '4 x página', Icono: LayoutGrid },
  { modo: 6, etiqueta: '6 x página', Icono: Grid3X3 },
  { modo: 20, etiqueta: '20 x página', Icono: Film },
];

/** Vista de rodaje / presentación a pantalla completa. */
export default function PresenterMode({
  storyboardName,
  panels,
  locutions,
  storyboards = [],
  activeStoryboardId,
  projectColors = { color_cliente: '#6ee7b7', color_campana: '#8f8f8f' },
  onSwitchStoryboard,
  onClose,
}: Props) {
  const [layoutMode, setLayoutMode] = useState<LayoutPDF>(6);
  const [slide, setSlide] = useState(0);
  const [lightbox, setLightbox] = useState<StoryboardPanel | null>(null);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        if (lightbox) setLightbox(null);
        else onClose();
      }
      if (layoutMode === 1 && evento.key === 'ArrowLeft') setSlide((prev) => Math.max(0, prev - 1));
      if (layoutMode === 1 && evento.key === 'ArrowRight') {
        setSlide((prev) => Math.min(panels.length - 1, prev + 1));
      }
    };

    document.addEventListener('keydown', alPresionar);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', alPresionar);
    };
  }, [layoutMode, lightbox, onClose, panels.length]);

  useEffect(() => {
    setSlide(0);
  }, [activeStoryboardId]);

  const activo = panels[Math.min(slide, Math.max(0, panels.length - 1))];

  return (
    <div className="fixed inset-0 z-60 flex flex-col overflow-y-auto bg-canvas text-content">
      <header
        className="sticky top-0 z-10 border-b border-hairline bg-surface/95 px-3 py-2.5 backdrop-blur"
        style={{ paddingTop: 'calc(0.625rem + env(safe-area-inset-top))' }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="min-w-0 truncate text-[13px] font-semibold text-content">{storyboardName}</h1>

            {storyboards.length > 1 && (
              <select
                value={activeStoryboardId ?? ''}
                onChange={(e) => {
                  const elegido = storyboards.find((sb) => sb.id === Number.parseInt(e.target.value, 10));
                  if (elegido) onSwitchStoryboard?.(elegido);
                }}
                aria-label="Elegir storyboard"
                className="max-w-40 cursor-pointer truncate rounded-md border border-hairline-strong bg-surface px-2 py-1 text-[11px] text-content-secondary focus:outline-hidden focus:ring-2 focus:ring-brand"
              >
                {storyboards.map((sb) => (
                  <option key={sb.id} value={sb.id}>
                    {sb.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-lg border border-hairline bg-subtle p-0.5 sm:flex">
              {LAYOUTS.map(({ modo, etiqueta, Icono }) => (
                <button
                  key={modo}
                  type="button"
                  onClick={() => {
                    setLayoutMode(modo);
                    setSlide(0);
                  }}
                  aria-pressed={layoutMode === modo}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    layoutMode === modo
                      ? 'bg-brand text-on-brand'
                      : 'text-content-muted hover:text-content'
                  }`}
                >
                  <Icono className="h-3.5 w-3.5" />
                  {etiqueta}
                </button>
              ))}
            </div>

            <div className="flex rounded-lg border border-hairline bg-subtle p-0.5 sm:hidden">
              {LAYOUTS.slice(0, 2).map(({ modo, etiqueta, Icono }) => (
                <button
                  key={modo}
                  type="button"
                  onClick={() => {
                    setLayoutMode(modo);
                    setSlide(0);
                  }}
                  aria-pressed={layoutMode === modo}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    layoutMode === modo
                      ? 'bg-brand text-on-brand'
                      : 'text-content-muted hover:text-content'
                  }`}
                >
                  <Icono className="h-3.5 w-3.5" />
                  {modo === 1 ? 'Galería' : 'Deslizable'}
                </button>
              ))}
            </div>

            <button type="button" onClick={onClose} className="btn btn-sm btn-secondary">
              <EyeOff className="h-3.5 w-3.5" />
              Salir de vista
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-3 py-4">
        {panels.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-content-muted">
            No hay viñetas disponibles para mostrar.
          </p>
        ) : layoutMode === 1 ? (
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-hairline bg-subtle shadow-lg">
              {activo?.image_url ? (
                <img
                  src={`${activo.image_url}?v=${activo.version ?? 0}`}
                  alt={activo.filename}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[12px] italic text-content-subtle">Sin dibujo disponible</span>
              )}

              <span className="absolute left-3 top-3 rounded-md border border-brand-border bg-surface/90 px-2 py-1 font-mono text-[12px] font-semibold text-brand-content backdrop-blur">
                {activo?.filename || 'Plano'}
              </span>
              <span className="absolute right-3 top-3 rounded-md border border-hairline bg-surface/90 px-2 py-1 font-mono text-[10px] text-content-muted backdrop-blur">
                {slide + 1} de {panels.length}
              </span>
            </div>

            <div className="mt-4 flex w-full items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSlide((prev) => Math.max(0, prev - 1))}
                disabled={slide === 0}
                className="btn btn-sm btn-secondary"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>

              <div className="flex max-w-52 gap-1.5 overflow-x-auto py-1">
                {panels.map((panel, idx) => (
                  <button
                    key={panel.id || idx}
                    type="button"
                    onClick={() => setSlide(idx)}
                    aria-label={`Ir a ${panel.filename || `viñeta ${idx + 1}`}`}
                    aria-current={idx === slide ? 'true' : undefined}
                    className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
                      idx === slide ? 'bg-brand' : 'bg-hairline-strong hover:bg-content-subtle'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setSlide((prev) => Math.min(panels.length - 1, prev + 1))}
                disabled={slide === panels.length - 1}
                className="btn btn-sm btn-secondary"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 w-full">
              <div className="rounded-xl border border-hairline bg-surface p-4">
                <h3
                  className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: projectColors.color_campana }}
                >
                  Locución / audio
                </h3>
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-content-secondary">
                  {locutions[slide] || <span className="italic text-content-subtle">—</span>}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-4 ${
              layoutMode === 4
                ? 'grid-cols-1 md:grid-cols-2'
                : layoutMode === 6
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
            }`}
          >
            {panels.map((panel, idx) => {
              const locucion = locutions[idx] || '';
              const compacto = layoutMode === 20;

              return (
                <div
                  key={panel.id || idx}
                  className={`flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-xs ${
                    compacto ? 'gap-1.5 p-1.5' : 'gap-3 p-3'
                  }`}
                >
                  <span
                    className={`truncate font-mono font-semibold text-brand-content ${
                      compacto ? 'text-[10px]' : 'text-[12px]'
                    }`}
                  >
                    {panel.filename || 'Plano'}
                  </span>

                  <button
                    type="button"
                    onClick={() => panel.image_url && setLightbox(panel)}
                    aria-label={`Ampliar ${panel.filename || `viñeta ${idx + 1}`}`}
                    className="relative flex aspect-video w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border border-hairline bg-subtle"
                  >
                    {panel.image_url ? (
                      <img
                        src={`${panel.image_url}?v=${panel.version ?? 0}`}
                        alt={panel.filename}
                        // La vista rodaje es el contenido: no diferimos la carga
                        // (el `lazy` no dispara dentro de un overlay `fixed`).
                        loading="eager"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] italic text-content-subtle">Sin dibujo</span>
                    )}
                  </button>

                  {!compacto && (
                    <div className="flex flex-1 flex-col">
                      <div className="flex-1 rounded-lg border border-hairline bg-subtle p-2">
                        <strong
                          className="mb-1 block text-[9px] font-semibold uppercase tracking-widest"
                          style={{ color: projectColors.color_campana }}
                        >
                          Locución  / audio
                        </strong>
                        <p className="whitespace-pre-wrap text-[11px] leading-snug text-content-secondary">
                          {locucion || <span className="italic text-content-subtle">—</span>}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-70 flex cursor-zoom-out flex-col items-center justify-center bg-black/92 p-4 md:p-8"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Cerrar imagen"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            <X className="h-4 w-4" />
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-5xl cursor-default flex-col items-center gap-3"
          >
            <img
              src={`${lightbox.image_url}?v=${lightbox.version ?? 0}`}
              alt={lightbox.filename}
              className="max-h-[78vh] max-w-full rounded-lg border border-white/10 bg-black object-contain shadow-2xl"
            />

            <div className="max-w-lg rounded-xl border border-white/10 bg-black/70 px-4 py-2.5 text-center">
              <span className="block font-mono text-[12px] font-semibold text-brand">{lightbox.filename}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
