import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Clapperboard, MapPin, StickyNote, Users } from 'lucide-react';
import AppBar from '../components/AppBar';
import DetallePlano from '../components/DetallePlano';
import LiveStatusBanner from '../components/LiveStatusBanner';
import { useLivePlan } from '../data/useLivePlan';
import { useOnline } from '../lib/online';
import type { LlamadoData } from '../types';
import { buildTimeline, formatDuracion, type TimelineRow } from '../lib/pdr';

/** Estado de cada fila del plan cuando el modo en vivo está activo. */
type EstadoPlano = 'terminado' | 'enCurso' | 'pendiente';

/** Cada cuánto se vuelve a leer el llamado mientras el modo en vivo está activo. */
const REFRESCO_MS = 30_000;
/** Aire entre el banner fijo y el plano al que saltamos. */
const MARGEN_SCROLL_PX = 20;

export default function PlanRodajeScreen({ data, recargar }: { data: LlamadoData; recargar: () => void }) {
  const [detalle, setDetalle] = useState<number | null>(null);
  const [enVivo, setEnVivo] = useState(false);

  const online = useOnline();
  const bannerRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLOListElement>(null);
  // Solo se hace scroll al encender el modo; apagarlo deja al usuario donde está.
  const scrollPendiente = useRef(false);

  const timeline = useMemo(
    () => buildTimeline(data.pdr ?? [], data.talento ?? [], data.llamado.llamado_hora),
    [data.pdr, data.talento, data.llamado.llamado_hora],
  );

  // El temporizador solo corre con el modo activo: apagado, la sección se
  // comporta como siempre.
  const { plan, now } = useLivePlan(data, enVivo);

  const planos = useMemo(() => timeline.rows.filter((row) => !row.especial), [timeline.rows]);

  const estados = useMemo(() => {
    const mapa = new Map<number, EstadoPlano>();
    for (const fila of plan.rows) {
      mapa.set(Number(fila.id), fila.isActive ? 'enCurso' : fila.isCompleted ? 'terminado' : 'pendiente');
    }
    return mapa;
  }, [plan.rows]);

  const proximoInicio = useMemo(() => {
    const indice = plan.rows.findIndex((fila) => fila.isActive);
    return indice === -1 ? null : (plan.rows[indice + 1]?.projectedStart ?? null);
  }, [plan.rows]);

  // Sincroniza con la base mientras el modo está activo, para que los cierres
  // que registra la app de rodaje lleguen sin recargar a mano.
  useEffect(() => {
    if (!enVivo || !online) return;

    recargar();
    const id = window.setInterval(recargar, REFRESCO_MS);
    const alVolver = () => {
      if (document.visibilityState === 'visible') recargar();
    };

    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [enVivo, online, recargar]);

  // Al encender el modo, saltamos al plano que se está rodando. Se espera al
  // primer tick del reloj (`now` fresco) para no calcular sobre el estado
  // congelado que tenía la sección antes de activarse.
  useEffect(() => {
    if (!enVivo) {
      scrollPendiente.current = false;
      return;
    }
    if (!scrollPendiente.current || Date.now() - now > 2000) return;

    scrollPendiente.current = false;
    const objetivo = listaRef.current?.querySelector<HTMLElement>('[data-plano-activo="true"]');
    if (!objetivo) return;

    const bannerAbajo = bannerRef.current?.getBoundingClientRect().bottom ?? 0;
    const destino = objetivo.getBoundingClientRect().top + window.scrollY - bannerAbajo - MARGEN_SCROLL_PX;
    const menosMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    window.scrollTo({ top: Math.max(0, destino), behavior: menosMovimiento ? 'auto' : 'smooth' });
  }, [enVivo, now]);

  const alternarEnVivo = () => {
    if (!enVivo) scrollPendiente.current = true;
    setEnVivo(!enVivo);
  };

  const abrirPlano = (row: TimelineRow) => {
    const indice = planos.findIndex((plano) => plano.id === row.id);
    if (indice >= 0) setDetalle(indice);
  };

  return (
    <>
      <AppBar
        title="Plan de rodaje"
        acciones={
          <button
            type="button"
            role="switch"
            aria-checked={enVivo}
            onClick={alternarEnVivo}
            className={`flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              enVivo
                ? 'border-brand bg-brand-subtle text-brand-content'
                : 'border-hairline text-content-muted active:bg-subtle'
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${enVivo ? 'bg-brand' : 'bg-content-subtle'}`}
            />
            Ver en vivo
          </button>
        }
      />

      <div className="px-3 pt-3">
        {enVivo && (
          <div
            ref={bannerRef}
            className="sticky z-10 -mx-3 border-b border-hairline bg-canvas/95 px-3 pb-2 backdrop-blur"
            style={{ top: 'calc(env(safe-area-inset-top) + 2.75rem)' }}
          >
            <LiveStatusBanner plan={plan} now={now} proximoInicio={proximoInicio} />
          </div>
        )}

        {timeline.rows.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <Resumen
              inicio={timeline.inicio}
              fin={timeline.fin}
              totalMin={timeline.totalMin}
              totalPlanos={timeline.totalPlanos}
              locaciones={timeline.locaciones}
            />
            <ol ref={listaRef} className="mt-3 space-y-2">
              {timeline.rows.map((row) => {
                const estado = enVivo ? estados.get(row.id) : undefined;
                const enCurso = estado === 'enCurso';

                return row.especial ? (
                  <li key={row.id} data-plano-id={row.id} data-plano-activo={enCurso ? 'true' : undefined}>
                    <FilaEspecial row={row} estado={estado} />
                  </li>
                ) : (
                  <li key={row.id} data-plano-id={row.id} data-plano-activo={enCurso ? 'true' : undefined}>
                    <TarjetaPlano row={row} estado={estado} onAbrir={() => abrirPlano(row)} />
                  </li>
                );
              })}
            </ol>

            <p className="mt-4 pb-2 text-center text-[10px] text-content-subtle">
              Fin de jornada previsto: {timeline.cierre ?? timeline.fin} hrs
            </p>
          </>
        )}
      </div>

      {detalle !== null && planos[detalle] && (
        <DetallePlano
          planos={planos}
          indice={detalle}
          onClose={() => setDetalle(null)}
          onIndiceChange={setDetalle}
        />
      )}
    </>
  );
}

/* ─────────────────────────── Resumen ─────────────────────────── */

function Resumen({
  inicio,
  fin,
  totalMin,
  totalPlanos,
  locaciones,
}: {
  inicio: string | null;
  fin: string | null;
  totalMin: number;
  totalPlanos: number;
  locaciones: string[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="grid grid-cols-3 divide-x divide-hairline">
        <Dato etiqueta="Inicio" valor={inicio ?? '—'} />
        <Dato etiqueta="Término" valor={fin ?? '—'} />
        <Dato etiqueta="Jornada" valor={formatDuracion(totalMin)} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-content-muted">
          <Clapperboard className="h-3.5 w-3.5" />
          {totalPlanos} {totalPlanos === 1 ? 'plano' : 'planos'}
        </span>
        {locaciones.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-content-muted">
            <MapPin className="h-3.5 w-3.5" />
            {locaciones.length} {locaciones.length === 1 ? 'locación' : 'locaciones'}
          </span>
        )}
      </div>
    </section>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-content-subtle">{etiqueta}</p>
      <p className="mt-0.5 truncate font-mono text-[13px] font-semibold text-content">{valor}</p>
    </div>
  );
}

/* ─────────────────────────── Filas ─────────────────────────── */

function FilaEspecial({ row, estado }: { row: TimelineRow; estado?: EstadoPlano }) {
  const enCurso = estado === 'enCurso';

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-subtle px-3 py-2.5 ${
        enCurso ? 'border-brand ring-1 ring-brand' : 'border-hairline-strong'
      } ${estado === 'terminado' ? 'opacity-60' : ''}`}
    >
      <span className="shrink-0 font-mono text-[11px] font-semibold text-content-secondary">
        {row.inicio}
      </span>
      <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-content-secondary">
        {row.descripcion}
      </p>
      {enCurso && <ChipEnCurso />}
    </div>
  );
}

function TarjetaPlano({
  row,
  estado,
  onAbrir,
}: {
  row: TimelineRow;
  estado?: EstadoPlano;
  onAbrir: () => void;
}) {
  const enCurso = estado === 'enCurso';
  const tieneMeta = Boolean(row.locacion || row.cast.length || row.notas);
  const tieneReferencias = row.referencias.length > 0;

  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-haspopup="dialog"
      className={`group block w-full overflow-hidden rounded-xl border bg-surface text-left transition-colors active:bg-subtle ${
        enCurso ? 'border-brand ring-1 ring-brand' : 'border-hairline'
      } ${estado === 'terminado' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <span className="font-mono text-[15px] font-semibold leading-none text-content">{row.inicio}</span>

        {enCurso && <ChipEnCurso />}
        {row.escena && <Badge>ESC {row.escena}</Badge>}
        {row.plano && <Badge>PLANO {row.plano}</Badge>}

        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-content-subtle" aria-hidden />
        <span className="sr-only">Ver detalle completo</span>
      </div>

      <p className="px-3 pb-2 text-[13px] leading-snug text-content">{row.descripcion}</p>

      {(tieneMeta || tieneReferencias) && (
        <div className="flex items-stretch gap-2.5 border-t border-hairline px-3 py-2">
          {tieneMeta && (
            <div className="min-w-0 flex-1 space-y-1.5">
              {row.locacion && (
                <Meta Icono={MapPin}>
                  <span className="truncate text-content-secondary">{row.locacion}</span>
                </Meta>
              )}

              {row.cast.length > 0 && (
                <Meta Icono={Users}>
                  <span className="text-content-secondary">
                    {row.cast.map((persona, indice) => (
                      <span key={`${persona.nombre}-${indice}`}>
                        {indice > 0 && <span className="text-content-subtle">, </span>}
                        {persona.nombre}
                        {persona.rol && persona.rol !== persona.nombre && (
                          <span className="text-content-subtle"> ({persona.rol})</span>
                        )}
                      </span>
                    ))}
                  </span>
                </Meta>
              )}

              {row.notas && (
                <Meta Icono={StickyNote}>
                  <span className="text-content-muted">{row.notas}</span>
                </Meta>
              )}
            </div>
          )}

          {tieneReferencias && (
            <div className="ml-auto flex w-[22%] max-w-19 shrink-0 flex-col gap-1.5">
              {row.referencias.map((referencia, indice) => (
                <div
                  key={`${referencia.url}-${indice}`}
                  className="aspect-square w-full overflow-hidden rounded-lg border border-hairline bg-subtle"
                >
                  <img
                    src={referencia.url}
                    alt={referencia.alt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded border border-hairline bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-content-muted">
      {children}
    </span>
  );
}

/** Distintivo de la toma que se está rodando; el color no es el único indicador. */
function ChipEnCurso() {
  return (
    <span className="shrink-0 rounded border border-brand-border bg-brand-subtle px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-brand-content">
      EN CURSO
    </span>
  );
}

function Meta({ Icono, children }: { Icono: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 text-[11px] leading-snug">
      <Icono className="mt-0.5 h-3 w-3 shrink-0 text-content-subtle" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-5 py-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-content-subtle">
        <Clapperboard className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-[14px] font-semibold text-content">Sin plan de rodaje</h2>
      <p className="mx-auto mt-1 max-w-65 text-[12px] leading-relaxed text-content-muted">
        Producción todavía no cargó los planos de este llamado.
      </p>
    </div>
  );
}
