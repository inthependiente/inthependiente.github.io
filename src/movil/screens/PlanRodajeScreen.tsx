import { useMemo, useState } from 'react';
import { Clapperboard, MapPin, StickyNote, Users } from 'lucide-react';
import AppBar from '../components/AppBar';
import Lightbox, { type ImagenLightbox } from '../components/Lightbox';
import type { LlamadoData } from '../types';
import { buildTimeline, formatDuracion, type TimelineRow } from '../lib/pdr';

interface LightboxState {
  imagenes: ImagenLightbox[];
  indice: number;
  titulo: string;
}

export default function PlanRodajeScreen({ data }: { data: LlamadoData }) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const timeline = useMemo(
    () => buildTimeline(data.pdr ?? [], data.talento ?? [], data.llamado.llamado_hora),
    [data.pdr, data.talento, data.llamado.llamado_hora],
  );

  const abrirReferencia = (row: TimelineRow, indice: number) => {
    setLightbox({
      imagenes: row.referencias,
      indice,
      titulo: [row.escena ? `Escena ${row.escena}` : null, `Plano ${row.plano}`]
        .filter(Boolean)
        .join(' · '),
    });
  };

  return (
    <>
      <AppBar title="Plan de rodaje" />

      <div className="px-3 pt-3">
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
            <ol className="mt-3 space-y-2">
              {timeline.rows.map((row) =>
                row.especial ? (
                  <li key={row.id}>
                    <FilaEspecial row={row} />
                  </li>
                ) : (
                  <li key={row.id}>
                    <TarjetaPlano row={row} onAbrirReferencia={(indice) => abrirReferencia(row, indice)} />
                  </li>
                ),
              )}
            </ol>

            <p className="mt-4 pb-2 text-center text-[10px] text-content-subtle">
              Fin de jornada previsto: {timeline.cierre ?? timeline.fin} hrs
            </p>
          </>
        )}
      </div>

      {lightbox && (
        <Lightbox
          imagenes={lightbox.imagenes}
          indice={lightbox.indice}
          titulo={lightbox.titulo}
          onClose={() => setLightbox(null)}
          onIndiceChange={(indice) => setLightbox((actual) => (actual ? { ...actual, indice } : actual))}
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

function FilaEspecial({ row }: { row: TimelineRow }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-hairline-strong bg-subtle px-3 py-2.5">
      <span className="shrink-0 font-mono text-[11px] font-semibold text-content-secondary">
        {row.inicio}
      </span>
      <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-content-secondary">
        {row.descripcion}
      </p>
    </div>
  );
}

function TarjetaPlano({
  row,
  onAbrirReferencia,
}: {
  row: TimelineRow;
  onAbrirReferencia: (indice: number) => void;
}) {
  const tieneMeta = Boolean(row.locacion || row.cast.length || row.notas);
  const tieneReferencias = row.referencias.length > 0;

  return (
    <article className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <span className="font-mono text-[15px] font-semibold leading-none text-content">{row.inicio}</span>

        {row.escena && <Badge>ESC {row.escena}</Badge>}
        {row.plano && <Badge>PLANO {row.plano}</Badge>}
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
            <div className="ml-auto flex w-[22%] max-w-[76px] shrink-0 flex-col gap-1.5">
              {row.referencias.map((referencia, indice) => (
                <button
                  key={`${referencia.url}-${indice}`}
                  type="button"
                  onClick={() => onAbrirReferencia(indice)}
                  className="group relative aspect-square w-full overflow-hidden rounded-lg border border-hairline bg-subtle"
                  aria-label={`Ampliar referencia ${indice + 1} del plano ${row.plano}`}
                >
                  <img
                    src={referencia.url}
                    alt={referencia.alt}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-200 group-active:scale-105"
                  />
                  <span className="absolute inset-0 bg-black/0 transition-colors group-active:bg-black/10" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded border border-hairline bg-subtle px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-content-muted">
      {children}
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
      <p className="mx-auto mt-1 max-w-[260px] text-[12px] leading-relaxed text-content-muted">
        Producción todavía no cargó los planos de este llamado.
      </p>
    </div>
  );
}
