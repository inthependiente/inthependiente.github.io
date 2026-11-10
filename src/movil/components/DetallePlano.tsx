import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, StickyNote, Users, X } from 'lucide-react';
import { formatDuracion, type TimelineRow } from '../lib/pdr';

interface Props {
  /** Planos del llamado, en el orden del cronograma. */
  planos: TimelineRow[];
  indice: number;
  onClose: () => void;
  onIndiceChange: (indice: number) => void;
}

export default function DetallePlano({ planos, indice, onClose, onIndiceChange }: Props) {
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const contenido = useRef<HTMLDivElement>(null);

  const total = planos.length;
  const row = planos[indice];
  const hayAnterior = indice > 0;
  const haySiguiente = indice < total - 1;

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    botonCerrar.current?.focus();

    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onClose();
      if (evento.key === 'ArrowLeft' && indice > 0) onIndiceChange(indice - 1);
      if (evento.key === 'ArrowRight' && indice < total - 1) onIndiceChange(indice + 1);
    };

    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [indice, total, onClose, onIndiceChange]);

  useEffect(() => {
    contenido.current?.scrollTo({ top: 0 });
  }, [indice]);

  if (!row) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Plano ${indice + 1} de ${total}`}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="overlay-in absolute inset-0 bg-black/45"
      />

      <div className="rise-in relative flex w-full max-w-130 flex-col bg-surface shadow-2xl">
        <header
          className="flex items-start justify-between gap-3 border-b border-hairline bg-surface px-3 pb-2"
          style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
        >
          <div className="min-w-0">
            <p className="pt-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-content-subtle">
              Plano {indice + 1} de {total}
            </p>
          </div>

          <button
            ref={botonCerrar}
            type="button"
            className="btn btn-ghost btn-icon shrink-0"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={contenido} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-3 px-3 py-3">
            <section className="rounded-xl border border-hairline bg-surface px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[24px] font-semibold leading-none text-content">{row.inicio}</span>
                
                {row.escena && <Badge>ESC {row.escena}</Badge>}
                {row.plano && <Badge>PLANO {row.plano}</Badge>}
              </div>

              <p className="mt-2 whitespace-pre-line text-[14px] leading-snug text-content">{row.descripcion}</p>

              {row.duracionMin > 0 && (
                <p className="mt-1.5 text-[11px] text-content-subtle">
                  Duración: {formatDuracion(row.duracionMin)}
                </p>
              )}
            </section>

            {(row.locacion || row.cast.length > 0 || row.notas) && (
              <section className="space-y-2.5 rounded-xl border border-hairline bg-surface px-3 py-3">
                {row.locacion && (
                  <Dato Icono={MapPin} etiqueta="Locación">
                    <p className="text-[13px] leading-snug text-content-secondary">{row.locacion}</p>
                  </Dato>
                )}

                {row.cast.length > 0 && (
                  <Dato Icono={Users} etiqueta="Elenco">
                    <ul className="space-y-0.5">
                      {row.cast.map((persona, posicion) => (
                        <li
                          key={`${persona.nombre}-${posicion}`}
                          className="text-[13px] leading-snug text-content-secondary"
                        >
                          {persona.nombre}
                          {persona.rol && persona.rol !== persona.nombre && (
                            <span className="text-content-subtle"> · {persona.rol}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Dato>
                )}

                {row.notas && (
                  <Dato Icono={StickyNote} etiqueta="Notas">
                    <p className="whitespace-pre-line text-[13px] leading-relaxed text-content-muted">{row.notas}</p>
                  </Dato>
                )}
              </section>
            )}

            {row.referencias.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-content-subtle">
                  {row.referencias.length === 1 ? 'Referencia' : 'Referencias'}
                </h2>

                {row.referencias.map((referencia, posicion) => (
                  <figure
                    key={`${referencia.url}-${posicion}`}
                    className="overflow-hidden rounded-xl border border-hairline bg-subtle"
                  >
                    <img
                      src={referencia.url}
                      alt={referencia.alt}
                      loading="lazy"
                      className="block max-h-[65vh] w-full object-contain"
                    />
                    {row.referencias.length > 1 && (
                      <figcaption className="border-t border-hairline px-3 py-1.5 text-[10px] text-content-subtle">
                        Referencia {posicion + 1} de {row.referencias.length}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </section>
            )}
          </div>
        </div>

        <nav
          className="flex items-center gap-2 border-t border-hairline bg-surface px-3 pt-2"
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
          aria-label="Navegación entre planos"
        >
          <button
            type="button"
            className="btn btn-secondary h-11 flex-1"
            onClick={() => onIndiceChange(indice - 1)}
            disabled={!hayAnterior}
            aria-label="Plano anterior"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>

          <span className="shrink-0 px-1 font-mono text-[11px] text-content-muted">
            {indice + 1} / {total}
          </span>

          <button
            type="button"
            className="btn btn-secondary h-11 flex-1"
            onClick={() => onIndiceChange(indice + 1)}
            disabled={!haySiguiente}
            aria-label="Plano siguiente"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded border border-hairline bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-content-muted">
      {children}
    </span>
  );
}

function Dato({
  Icono,
  etiqueta,
  children,
}: {
  Icono: React.ElementType;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icono className="mt-0.5 h-3.5 w-3.5 shrink-0 text-content-subtle" />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-content-subtle">{etiqueta}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
