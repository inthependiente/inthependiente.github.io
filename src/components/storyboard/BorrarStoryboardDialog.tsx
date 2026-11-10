import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import type { StoryboardPanel } from './types';
import {
  borrarArchivos,
  formatearBytes,
  recolectarArchivos,
  type ArchivoBucket,
  type ResultadoBorrado,
} from './utils/borrado';

export interface StoryboardAEliminar {
  id: number;
  name: string;
  panel_count?: number | null;
  /** Viñetas ya cargadas; si falta, se piden a la base. */
  panels?: StoryboardPanel[] | null;
}

interface Props {
  storyboard: StoryboardAEliminar;
  onClose: () => void;
  /** Se llama solo cuando la fila y los archivos ya no existen. */
  onDeleted: (resumen: { archivos: number; bytes: number }) => void;
  onNotify: (texto: string, modo?: 'success' | 'error') => void;
}

type Fase = 'calculando' | 'listo' | 'borrando' | 'falloArchivos' | 'falloFila';

export default function BorrarStoryboardDialog({ storyboard, onClose, onDeleted, onNotify }: Props) {
  const [fase, setFase] = useState<Fase>('calculando');
  const [archivos, setArchivos] = useState<ArchivoBucket[]>([]);
  const [resultado, setResultado] = useState<ResultadoBorrado | null>(null);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);

  const cerrable = fase === 'listo' || fase === 'falloArchivos' || fase === 'falloFila';
  const cerrarRef = useRef<HTMLButtonElement>(null);

  const totalBytes = useMemo(
    () => archivos.reduce((suma, archivo) => suma + archivo.bytes, 0),
    [archivos],
  );

  // El padre re-renderiza en cada aviso y `onNotify` cambia de identidad: si
  // `medir` dependiera de ella, mediría de nuevo y borraría el mensaje de error
  // (o reiniciaría un borrado en curso).
  const notificarRef = useRef(onNotify);
  notificarRef.current = onNotify;
  const objetivo = useRef({ id: storyboard.id, panels: storyboard.panels ?? null });

  useEffect(() => {
    let vigente = true;

    const medir = async () => {
      setFase('calculando');
      setErrorLectura(null);
      try {
        let panels = objetivo.current.panels;

        if (!panels) {
          const { data, error } = await supabase
            .from('storyboards')
            .select('panels')
            .eq('id', objetivo.current.id)
            .maybeSingle();
          if (error) throw new Error(error.message);
          panels = ((data as { panels: StoryboardPanel[] } | null)?.panels ??
            []) as StoryboardPanel[];
        }

        const encontrados = await recolectarArchivos(objetivo.current.id, panels, supabase);
        if (!vigente) return;
        setArchivos(encontrados);
        setFase('listo');
      } catch (error) {
        if (!vigente) return;
        const mensaje = (error as Error).message;
        setErrorLectura(mensaje);
        setFase('listo');
        notificarRef.current(`No pudimos preparar el borrado: ${mensaje}`, 'error');
      }
    };

    void medir();

    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrarRef.current?.focus();

    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && cerrable) onClose();
    };
    document.addEventListener('keydown', alPresionar);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', alPresionar);
    };
  }, [cerrable, onClose]);

  /** Recibe el resultado por parámetro: el estado `resultado` todavía no se ha
   * aplicado cuando se llama desde `ejecutar` y daría un resumen desactualizado. */
  const borrarFila = async (borrado: ResultadoBorrado | null) => {
    const { error } = await supabase.from('storyboards').delete().eq('id', storyboard.id);
    if (error) {
      setFase('falloFila');
      onNotify(`Los dibujos se borraron, pero no la ficha: ${error.message}`, 'error');
      return;
    }

    onDeleted({
      archivos: borrado?.borrados.length ?? archivos.length,
      bytes: borrado?.bytes ?? totalBytes,
    });
  };

  const ejecutar = async () => {
    setFase('borrando');
    setProgreso({ hechos: 0, total: archivos.length });

    const resultadoArchivos = await borrarArchivos(storyboard.id, archivos, supabase, (hechos, total) =>
      setProgreso({ hechos, total }),
    );
    setResultado(resultadoArchivos);
    setProgreso(null);

    if (!resultadoArchivos.ok) {
      setFase('falloArchivos');
      setArchivos((previos) => previos.filter((archivo) => resultadoArchivos.restantes.includes(archivo.path)));
      onNotify(
        resultadoArchivos.restantes.length === 1
          ? 'No se borró el storyboard: queda 1 archivo en el almacenamiento.'
          : `No se borró el storyboard: quedan ${resultadoArchivos.restantes.length} archivos en el almacenamiento.`,
        'error',
      );
      return;
    }

    await borrarFila(resultadoArchivos);
  };

  const borrarSoloFila = async () => {
    setFase('borrando');
    await borrarFila(resultado);
  };

  const nombreLimitado = storyboard.name.length > 48 ? `${storyboard.name.slice(0, 48)}…` : storyboard.name;
  const hayArchivos = archivos.length > 0;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => (cerrable ? onClose() : undefined)}
        className="absolute inset-0 bg-black/50"
      />

      <div className="relative w-full max-w-sm rounded-xl border border-hairline bg-surface p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-subtle text-danger-content">
            <AlertTriangle className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-content">Borrar storyboard</h2>
            <p className="mt-1 text-xs leading-relaxed text-content-muted">
              Se eliminará «{nombreLimitado}» junto con todas sus viñetas y los dibujos del
              almacenamiento. Esta acción no se puede deshacer.
            </p>
          </div>

          <button
            ref={cerrarRef}
            type="button"
            onClick={onClose}
            disabled={!cerrable}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-content-subtle transition-colors hover:bg-subtle hover:text-content disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline">
          <div className="bg-surface px-2.5 py-2">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.1em] text-content-subtle">Viñetas</dt>
            <dd className="mt-0.5 font-mono text-[13px] font-semibold text-content">
              {storyboard.panel_count ?? storyboard.panels?.length ?? '—'}
            </dd>
          </div>
          <div className="bg-surface px-2.5 py-2">
            <dt className="text-[9px] font-semibold uppercase tracking-[0.1em] text-content-subtle">Archivos</dt>
            <dd className="mt-0.5 font-mono text-[13px] font-semibold text-content">
              {fase === 'calculando' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : archivos.length}
            </dd>
          </div>
        </dl>

        {fase !== 'calculando' && hayArchivos && (
          <p className="mt-2 text-[11px] leading-relaxed text-content-muted">
            {archivos.length === 1 ? 'Se borrará' : 'Se borrarán'}{' '}
            <span className="font-mono font-semibold text-content">{archivos.length}</span>{' '}
            archivo{archivos.length === 1 ? '' : 's'}
            {totalBytes > 0 && (
              <>
                {' '}
                (<span className="font-mono font-semibold text-content">{formatearBytes(totalBytes)}</span>)
              </>
            )}{' '}
            del bucket, incluidas las copias y versiones anteriores.
          </p>
        )}

        {fase === 'calculando' && (
          <p className="mt-2 text-[11px] text-content-muted">Revisando el almacenamiento…</p>
        )}

        {fase === 'listo' && !hayArchivos && !errorLectura && (
          <p className="mt-2 text-[11px] leading-relaxed text-content-muted">
            No encontramos archivos asociados en el bucket: solo se borrará la ficha.
          </p>
        )}

        {fase === 'borrando' && (
          <div className="mt-3 rounded-lg border border-info-border bg-info-subtle px-3 py-2 text-[11px] text-info-content">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {progreso
                ? `Eliminando ${progreso.hechos} de ${progreso.total} archivos…`
                : 'Eliminando el storyboard…'}
            </div>
            {progreso && progreso.total > 0 && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-info transition-[width] duration-200"
                  style={{ width: `${Math.round((progreso.hechos / progreso.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {fase === 'falloArchivos' && (
          <div className="mt-3 rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-[11px] leading-relaxed text-danger-content">
            <p className="font-semibold">No se borró el storyboard.</p>
            <p className="mt-0.5">
              {(resultado?.restantes.length ?? archivos.length) === 1
                ? 'Quedó 1 archivo en el almacenamiento'
                : `Quedaron ${resultado?.restantes.length ?? archivos.length} archivos en el almacenamiento`}{' '}
              y la ficha se mantuvo intacta para no dejarlos huérfanos. Puedes reintentar.
            </p>
            {resultado && resultado.fallos.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 font-mono text-[10px] opacity-90">
                {resultado.fallos.slice(0, 3).map((fallo) => (
                  <li key={fallo.path} className="truncate">
                    {fallo.path.split('/').pop()} — {fallo.mensaje}
                  </li>
                ))}
                {resultado.fallos.length > 3 && <li>y {resultado.fallos.length - 3} más…</li>}
              </ul>
            )}
          </div>
        )}

        {fase === 'falloFila' && (
          <div className="mt-3 rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-[11px] leading-relaxed text-warning-content">
            <p className="font-semibold">Los dibujos ya se borraron.</p>
            <p className="mt-0.5">
              Solo falta quitar la ficha, pero falló. Reintenta para no dejar un storyboard vacío en la
              lista.
            </p>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={!cerrable} className="btn btn-sm btn-secondary">
            {fase === 'falloFila' ? 'Cerrar' : 'Cancelar'}
          </button>

          {(fase === 'listo' || fase === 'falloArchivos') && (
            <button
              type="button"
              onClick={() => void ejecutar()}
              className="btn btn-sm btn-danger"
              disabled={fase === 'listo' && !hayArchivos && Boolean(errorLectura)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {fase === 'falloArchivos' ? 'Reintentar' : 'Borrar'}
            </button>
          )}

          {fase === 'falloFila' && (
            <button type="button" onClick={() => void borrarSoloFila()} className="btn btn-sm btn-danger">
              <Trash2 className="h-3.5 w-3.5" />
              Quitar la ficha
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
